// Motor de «176 · La Batalla del 29N».
// La partida es una pila de tareas: cada tarea avanza sola o se detiene en una Decision
// que responde un jugador (persona o IA). Todo el estado es serializable.
import { AGENDA_IDS, CARTAS, ID_JUNTA, MAZO_IDS } from '../data/cartas';
import { AFINIDAD_INICIAL, CESIONES_CARAS, CORTO_BANDO, PARTIDOS, TERRITORIO } from '../data/partidos';
import { MADRID, PRESENCIA_INICIAL, PROV, PROVINCIAS, ZONAS } from '../data/provincias';
import { controlDe, proyectar, REGIONALES, VETADOS_POR_VOX, vetoVoxActivo } from './electoral';
import { aleatorio, barajar, d6 } from './rng';
import {
  CARRERA, clavesControladas, controla, controlador, costePresencia, cumpleCond, cumpleFiltro, efectosDe, elegiblesPresencia,
  esEncuesta, eventoAjeno, eventoJugable, fidelidadEf, ladoEvento, modOfensiva, objetivosAtaque, opsEfectivos, partidosNegociables,
  presenciaTotal, puntuarCIS, puntuarVaciada, puntuarZona, rondasDe, tamanoMano, tieneEfecto, tieneVentajaCarrera, usosCarta,
  ZONA_IDS, zonasBono, zonasDominadas, FECHAS,
} from './reglas';
import type {
  Bando, Decision, Efecto, EfectoActivo, EntradaLog, Escenario, Estado, Filtro, FotoTurno, Negociable, Operacion, RegionalId,
  Respuesta, Suceso, Tarea, TipoEfectoActivo, Uso, ZonaId,
} from './tipos';
import { RIVAL } from './tipos';

const N = (b: Bando) => CORTO_BANDO[b];
export const TOPE_ENCUESTA = 5;
const nombreCarta = (id: number) => `«${CARTAS[id].nombre}»`;
const MAX_RONDAS = 9;

export const NOMBRES_CLIMA: Record<number, string> = { 5: 'Sereno', 4: 'Tenso', 3: 'Bronco', 2: 'Guerra sucia', 1: 'Ruptura' };

export const HUMOR_PODEMOS: Record<number, string> = {
  [-3]: 'en guerra con el PSOE', [-2]: 'ruptura', [-1]: 'enfadado', 0: 'exigente', 1: 'dispuesto', 2: 'socio', 3: 'socio firme',
};

export const NOMBRE_EFECTO: Record<TipoEfectoActivo, string> = {
  masOps: '+1 PC a sus operaciones',
  menosOpsRival: '−1 PC a las operaciones del rival',
  bonoZona: '+1 PC si opera solo en una zona',
  protegeZonas: 'zonas blindadas frente a ofensivas',
  bastion: 'bastión inexpugnable',
  campanaLimpia: 'sus ofensivas en claves no bajan el Clima',
  fontaneria: 'fontanería electoral',
  sombra: 'sombra de sospecha: −1 a los debates del rival',
  cerrojo: 'cerrojo: el rival no puede colocar en una zona',
  manifiesto: '+2 PV por cada batalla del rival',
  redAlerta: 'red de alerta con Clima 2',
  mediacion: 'mediación en la próxima Encuesta',
  plazaFuerte: 'plaza fuerte (cuenta como clave)',
  jovenes: '+1 PV por cada ofensiva del rival',
  tregua: 'tregua: −1 a todas las ofensivas',
  crisis: 'crisis institucional: el rival pierde si lanza una ofensiva',
  atasco: 'el rival está atascado en una guerra interna',
  cuentaAtras: 'cuenta atrás: 3 PV salvo Junta Electoral',
};

// ————————————————————————————————————— utilidades
export function log(e: Estado, texto: string, tipo?: EntradaLog['tipo'], bando: Bando | null = null) {
  if (e.silencio) return;
  e.log.push({ turno: e.turno, ronda: e.ronda, bando, texto, tipo });
}

function suceso(e: Estado, s: Suceso) {
  if (e.silencio) return;
  e.diario.push(s);
}

function encolar(e: Estado, ...tareas: Tarea[]) {
  for (let i = tareas.length - 1; i >= 0; i--) e.pila.push(tareas[i]);
}

function decidir(e: Estado, d: Decision): false {
  e.pendiente = d;
  return false;
}

export function pv(e: Estado, b: Bando, n: number) {
  if (!n || e.ganador) return;
  const g = n > 0 ? b : RIVAL[b];
  e.ventaja = Math.max(-20, Math.min(20, e.ventaja + (b === 'C' ? n : -n)));
  log(e, `${N(g)} gana ${Math.abs(n)} PV (Ventaja ${fmtVentaja(e.ventaja)})`, 'pv', g);
  suceso(e, { s: 'pv', bando: g, n: Math.abs(n) });
  if (Math.abs(e.ventaja) >= 20) {
    terminar(e, e.ventaja > 0 ? 'C' : 'P', 'Vuelco irreversible: la Ventaja demoscópica llega a 20');
  }
}

export function fmtVentaja(v: number): string {
  return v === 0 ? '0' : v > 0 ? `+${v} Conservador` : `+${-v} Progresista`;
}

/** Cambia el Clima. Si llega a 1 en la jugada de alguien, ese bloque pierde (sin culpable, no baja de 2). */
function cambiarClima(e: Estado, n: number, minimo = 1) {
  if (!n || e.ganador) return;
  const antes = e.clima;
  const tope = e.enJuego ? minimo : Math.max(minimo, 2);
  e.clima = Math.max(tope, Math.min(5, e.clima + n));
  if (e.clima === antes) return;
  log(e, `Clima de campaña: ${antes} → ${e.clima} (${NOMBRES_CLIMA[e.clima]})`, 'clima');
  suceso(e, { s: 'clima', antes, despues: e.clima, culpable: e.enJuego });
  if (e.clima <= 1) {
    const culpable = e.enJuego ?? 'P';
    terminar(e, RIVAL[culpable], `Ruptura: ${N(culpable)} lleva la campaña a la guerra sucia y los votantes lo castigan`);
    return;
  }
  // Red de alerta (NORAD): si el Clima cae a 2 en la ronda del rival, el dueño coloca 1 de presencia
  if (e.clima === 2 && antes > 2 && e.enJuego) {
    for (const x of efectosDe(e, 'redAlerta', RIVAL[e.enJuego])) {
      log(e, `Red de alerta: ${N(x.dueno)} reacciona y coloca 1 de presencia`, undefined, x.dueno);
      encolar(e, { t: 'colocar', yo: x.dueno, n: 1, filtro: { conPresencia: 'yo' }, puestas: {}, restante: 1 });
    }
  }
}

function fijarClima(e: Estado, valor: number) {
  const n = valor - e.clima;
  if (n) cambiarClima(e, n);
}

function terminar(e: Estado, b: Bando | null, motivo: string) {
  if (e.ganador) return;
  e.ganador = { bando: b, motivo };
  e.fase = 'fin';
  e.pendiente = null;
  log(e, b ? `¡Gana el ${b === 'P' ? 'Bloque Progresista' : 'Bloque Conservador'}! ${motivo}` : `Empate. ${motivo}`, 'fase', b);
  if (!e.silencio) cerrarHistoria(e);
}

function robar(e: Estado, b: Bando) {
  if (e.mazo.length === 0) {
    if (e.descarte.length === 0) return;
    e.mazo = barajar(e, e.descarte);
    e.descarte = [];
    log(e, 'Se baraja el descarte para formar un nuevo mazo', 'fase');
  }
  const c = e.mazo.pop();
  if (c !== undefined) e.manos[b].push(c);
}

function quitarDeMano(e: Estado, b: Bando, carta: number) {
  if (carta === 0) {
    e.votoUtil = { duenio: RIVAL[b], disponible: false };
    return;
  }
  const i = e.manos[b].indexOf(carta);
  if (i < 0) throw new Error(`La carta ${carta} no está en la mano de ${b}`);
  e.manos[b].splice(i, 1);
}

function moverAfinidad(e: Estado, k: RegionalId, hacia: Bando, n: number) {
  const antes = e.afinidad[k];
  e.afinidad[k] = Math.max(-3, Math.min(3, antes + (hacia === 'C' ? n : -n)));
  if (e.afinidad[k] !== antes) log(e, `${PARTIDOS[k].siglas}: afinidad ${fmtAfin(antes)} → ${fmtAfin(e.afinidad[k])}`, undefined, hacia);
}

/** Mueve los marcadores de Podemos (fuerza y humor, de −3 a +3). */
function cambiarPodemos(e: Estado, fuerza: number, humor: number) {
  const antes = { ...e.podemos };
  e.podemos.fuerza = Math.max(-3, Math.min(3, e.podemos.fuerza + fuerza));
  e.podemos.humor = Math.max(-3, Math.min(3, e.podemos.humor + humor));
  const df = e.podemos.fuerza - antes.fuerza;
  const dh = e.podemos.humor - antes.humor;
  if (df) log(e, `Fuerza de Podemos: ${fmtSigno(antes.fuerza)} → ${fmtSigno(e.podemos.fuerza)}`);
  if (dh) log(e, `Humor de Podemos: ${HUMOR_PODEMOS[antes.humor]} → ${HUMOR_PODEMOS[e.podemos.humor]} (${e.podemos.humor >= 1 ? 'votaría sí a Sánchez' : e.podemos.humor === 0 ? 'se abstendría con Sánchez' : 'votaría no a Sánchez'})`);
  if (df || dh) suceso(e, { s: 'podemos', fuerza: df, humor: dh });
}

function cambiarSocio(e: Estado, b: Bando, n: number) {
  const antes = e.socio[b];
  e.socio[b] = Math.max(-3, Math.min(3, antes + n));
  if (e.socio[b] !== antes) {
    log(e, `${b === 'C' ? 'Medidor de Vox' : 'Medidor de Frente Amplio'}: ${fmtSigno(antes)} → ${fmtSigno(e.socio[b])}`, undefined, b);
    suceso(e, { s: 'socio', bando: b, n: e.socio[b] - antes });
  }
}

export function fmtAfin(a: number) {
  return a === 0 ? '0' : a < 0 ? `P${-a}` : `C${a}`;
}

function fmtSigno(n: number) {
  return n > 0 ? `+${n}` : `${n}`;
}

function avanzarCarrera(e: Estado, b: Bando, conPv = true) {
  if (e.carrera[b] >= CARRERA.length) return;
  e.carrera[b]++;
  const casilla = CARRERA[e.carrera[b] - 1];
  const primero = e.carrera[RIVAL[b]] < e.carrera[b];
  log(e, `${N(b)} alcanza «${casilla.nombre}» en la Carrera Programática (casilla ${e.carrera[b]})`, undefined, b);
  suceso(e, { s: 'carrera', bando: b, casilla: e.carrera[b] });
  if (conPv) pv(e, b, primero ? casilla.pv[0] : casilla.pv[1]);
}

/** Líder en la Ventaja (empate: a dados). */
function lider(e: Estado): Bando {
  if (e.ventaja > 0) return 'C';
  if (e.ventaja < 0) return 'P';
  return d6(e) <= 3 ? 'P' : 'C';
}

function activarEfecto(e: Estado, x: EfectoActivo) {
  e.efectos.push(x);
  log(e, `En vigor para el ${N(x.dueno)}: ${NOMBRE_EFECTO[x.tipo]}${x.zona ? ` (${ZONAS[x.zona].nombre})` : ''}${x.prov ? ` (${PROV[x.prov].corto})` : ''}`, undefined, x.dueno);
  suceso(e, { s: 'efecto', bando: x.dueno, tipo: x.tipo, carta: x.carta });
}

function quitarEfectos(e: Estado, pred: (x: EfectoActivo) => boolean) {
  e.efectos = e.efectos.filter((x) => !pred(x));
}

function puntuarZonaYAplicar(e: Estado, z: ZonaId, ignorarVeda: boolean) {
  if (e.turno === 8 && !ignorarVeda) {
    log(e, `Veda demoscópica: la Encuesta de ${ZONAS[z].nombre} no se publica`, 'puntuacion');
    suceso(e, { s: 'encuesta', zona: z, neto: 0, veda: true });
    return;
  }
  // Mediación: el bando afectado cuenta una provincia clave menos
  const med = e.efectos.find((x) => x.tipo === 'mediacion');
  const menos = med ? RIVAL[med.dueno] : null;
  if (med) {
    log(e, `Mediación del ${N(med.dueno)}: el ${N(RIVAL[med.dueno])} cuenta una provincia clave menos`, undefined, med.dueno);
    quitarEfectos(e, (x) => x === med);
  }
  const r = puntuarZona(e, z, menos);
  const niveles = ['nada', 'presencia', 'dominio', 'control'];
  log(e, `Encuesta de ${ZONAS[z].nombre}: Progresista ${niveles[r.nivel.P]} (${r.pv.P} PV) · Conservador ${niveles[r.nivel.C]} (${r.pv.C} PV)`, 'puntuacion');
  const neto = Math.max(-TOPE_ENCUESTA, Math.min(TOPE_ENCUESTA, r.neto));
  suceso(e, { s: 'encuesta', zona: z, neto, nivel: { P: r.nivel.P, C: r.nivel.C } });
  // Como Europa en TS, pero simétrico: controlar a la vez Madrid y Centro (feudo conservador) y Cataluña
  // (feudo progresista) cuando se publica cualquiera de sus dos Encuestas gana la partida
  if (z === 'MAD' || z === 'CAT') {
    const otra = puntuarZona(e, z === 'MAD' ? 'CAT' : 'MAD');
    for (const b of ['P', 'C'] as Bando[]) {
      if (r.nivel[b] === 3 && otra.nivel[b] === 3) {
        terminar(e, b, 'Asalto a la Moncloa: control de Madrid y Centro y de Cataluña a la vez');
        return;
      }
    }
  }
  if (neto > 0) pv(e, 'C', neto);
  else if (neto < 0) pv(e, 'P', -neto);
}

// ————————————————————————————————————— creación
/** Desplazamiento de partida (pp hacia el Conservador) de cada escenario. */
// Calibrado con partidas IA contra IA (nivel normal): cada bloque gana alrededor de la mitad en «abierto»
export const SESGO_ESCENARIO: Record<Escenario, number> = { realista: 0, abierto: -7.55 };

export function crearPartida(semilla = Date.now(), escenario: Escenario = 'abierto'): Estado {
  const presencia: Estado['presencia'] = {};
  const morado: Estado['morado'] = {};
  for (const p of PROVINCIAS) {
    presencia[p.id] = { P: PRESENCIA_INICIAL[p.id]?.P ?? 0, C: PRESENCIA_INICIAL[p.id]?.C ?? 0 };
    morado[p.id] = 0;
  }
  const e: Estado = {
    version: 3,
    rng: semilla >>> 0 || 1,
    turno: 0,
    ronda: 0,
    fase: 'preparacion',
    enJuego: null,
    presencia,
    presencia0: {},
    control0: {},
    morado,
    ventaja: 0,
    escenario,
    sesgo: SESGO_ESCENARIO[escenario],
    clima: 5,
    exigencia: { P: 0, C: 0 },
    carrera: { P: 0, C: 0 },
    carreraTurno: { P: 0, C: 0 },
    socio: { P: 0, C: 0 },
    podemos: { fuerza: 0, humor: 0 },
    afinidad: { ...AFINIDAD_INICIAL },
    negociado: [],
    modsProv: {},
    modsPartido: {},
    efectos: [],
    banderas: [],
    rondaExtra: { P: 0, C: 0 },
    mazo: [],
    descarte: [],
    retiradas: [],
    manos: { P: [], C: [] },
    agenda: [],
    agendaActual: null,
    votoUtil: { duenio: 'P', disponible: true },
    portada: { P: null, C: null },
    rondasHechas: { P: 0, C: 0 },
    pila: [],
    pendiente: null,
    log: [],
    ganador: null,
    manoVista: { P: false, C: false },
    debate: { P: null, C: null },
    ultimaJugada: null,
    diario: [],
    historia: [],
  };
  fotoSalida(e);
  e.mazo = barajar(e, [...MAZO_IDS[1]]);
  e.agenda = barajar(e, [...AGENDA_IDS]);
  encolar(e, { t: 'inicioPartida' });
  avanzar(e);
  return e;
}

/** La proyección de partida se calibra con la presencia del momento: la «foto» es la media de encuestas. */
function fotoSalida(e: Estado) {
  e.presencia0 = {};
  e.control0 = {};
  for (const p of PROVINCIAS) {
    e.presencia0[p.id] = { ...e.presencia[p.id] };
    e.control0[p.id] = controlDe(p, e.presencia[p.id], e.morado[p.id] ?? 0);
  }
}

// ————————————————————————————————————— bucle
export function avanzar(e: Estado) {
  let guard = 0;
  while (!e.pendiente && !e.ganador && e.pila.length > 0) {
    if (++guard > 20000) throw new Error('Bucle del motor sin salida');
    const t = e.pila[e.pila.length - 1];
    const hecho = paso(e, t, undefined);
    if (hecho) quitarTarea(e, t);
  }
}

function quitarTarea(e: Estado, t: Tarea) {
  const i = e.pila.lastIndexOf(t);
  if (i >= 0) e.pila.splice(i, 1);
}

/** Responde a la decisión pendiente. Muta el estado (usa `clonar` antes si necesitas inmutabilidad). */
export function responder(e: Estado, r: Respuesta): Estado {
  if (!e.pendiente) throw new Error('No hay ninguna decisión pendiente');
  validar(e.pendiente, r);
  const t = e.pila[e.pila.length - 1];
  e.pendiente = null;
  const hecho = paso(e, t, r);
  if (hecho) quitarTarea(e, t);
  avanzar(e);
  return e;
}

function validar(d: Decision, r: Respuesta) {
  if (d.tipo !== r.tipo) throw new Error(`Se esperaba una respuesta de tipo ${d.tipo}`);
  switch (r.tipo) {
    case 'provincia':
      if (r.id === null ? !(d as any).opcional : !(d as any).opciones.includes(r.id)) throw new Error('Provincia no válida');
      break;
    case 'carta': {
      const dc = d as Extract<Decision, { tipo: 'carta' }>;
      if (r.carta === null) {
        if (!dc.opcional) throw new Error('Debes elegir una carta');
      } else {
        if (!dc.opciones.includes(r.carta)) throw new Error('Carta no válida');
        if ((dc.proposito === 'accion' || dc.proposito === 'jugar') && (!r.uso || !dc.usos[r.carta].includes(r.uso))) throw new Error('Uso no válido');
      }
      break;
    }
    case 'operacion':
      if (!(d as any).opciones.includes(r.op)) throw new Error('Operación no válida');
      break;
    case 'opcion':
      if (r.i < 0 || r.i >= (d as any).opciones.length) throw new Error('Opción no válida');
      break;
    case 'partido':
      if (r.id === null ? !(d as any).opcional : !(d as any).opciones.includes(r.id)) throw new Error('Partido no válido');
      break;
  }
}

export function clonar(e: Estado): Estado {
  const presencia: Estado['presencia'] = {};
  for (const k in e.presencia) presencia[k] = { P: e.presencia[k].P, C: e.presencia[k].C };
  return {
    ...e,
    presencia,
    morado: { ...e.morado },
    exigencia: { ...e.exigencia },
    carrera: { ...e.carrera },
    carreraTurno: { ...e.carreraTurno },
    socio: { ...e.socio },
    podemos: { ...e.podemos },
    afinidad: { ...e.afinidad },
    negociado: [...e.negociado],
    modsProv: { ...e.modsProv },
    modsPartido: { ...e.modsPartido },
    efectos: e.efectos.map((x) => ({ ...x })),
    banderas: [...e.banderas],
    rondaExtra: { ...e.rondaExtra },
    mazo: [...e.mazo],
    descarte: [...e.descarte],
    retiradas: [...e.retiradas],
    manos: { P: [...e.manos.P], C: [...e.manos.C] },
    agenda: [...e.agenda],
    votoUtil: { ...e.votoUtil },
    portada: { ...e.portada },
    rondasHechas: { ...e.rondasHechas },
    pila: e.pila.map(clonarTarea),
    pendiente: e.pendiente ? JSON.parse(JSON.stringify(e.pendiente)) : null,
    log: e.silencio ? e.log : [...e.log],
    manoVista: { ...e.manoVista },
    debate: { ...e.debate },
    ganador: e.ganador ? { ...e.ganador } : null,
    diario: e.silencio ? e.diario : [...e.diario],
    historia: e.silencio ? e.historia : [...e.historia],
  };
}

function clonarTarea(t: Tarea): Tarea {
  const c: Tarea = { ...t };
  for (const k in c) {
    const v = c[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && k !== 'filtro' && k !== 'lista' && k !== 'opciones') c[k] = { ...v };
    else if (Array.isArray(v) && k !== 'lista' && k !== 'opciones') c[k] = [...v];
  }
  return c;
}

// ————————————————————————————————————— tareas
function paso(e: Estado, t: Tarea, r: Respuesta | undefined): boolean {
  switch (t.t) {
    case 'inicioPartida':
      log(e, 'Lunes 5 de octubre: el presidente disuelve las Cortes. Elecciones generales el 29 de noviembre.', 'fase');
      encolar(e,
        { t: 'colocarOps', bando: 'P', pc: 6, inicial: true, texto: 'Preparación: coloca 6 de presencia (adyacencia o Madrid)' },
        { t: 'colocarOps', bando: 'C', pc: 6, inicial: true, texto: 'Preparación: coloca 6 de presencia (adyacencia o Madrid)' },
        { t: 'foto' },
        { t: 'inicioTurno' });
      return true;

    case 'foto':
      fotoSalida(e);
      if (!e.silencio) cerrarHistoria(e, true); // la foto de salida, para que el plató compare
      return true;

    case 'inicioTurno':
      return inicioTurno(e);

    case 'portada':
      return tareaPortada(e, t, r);

    case 'portadaResolver':
      return portadaResolver(e);

    case 'agendaPodemos':
      return tareaAgenda(e);

    case 'ronda':
      return tareaRonda(e, t, r);

    case 'postRonda':
      return postRonda(e, t.bando);

    case 'jugarCarta': {
      const b: Bando = t.bando;
      if (!r) return decidir(e, { tipo: 'carta', bando: b, texto: `Juega ${nombreCarta(t.carta)} como si fuera tuya`, proposito: 'jugar', opciones: [t.carta], usos: { [t.carta]: usosCarta(e, b, t.carta) }, opcional: false });
      encolar(e, ...jugarCartaUso(e, b, t.carta, (r as any).uso as Uso));
      return true;
    }

    case 'ordenEvento': {
      if (!r) {
        const quien = CARTAS[t.carta].lado === 'W' ? 'de Podemos' : 'del rival';
        return decidir(e, { tipo: 'opcion', bando: t.bando, texto: `Has jugado ${nombreCarta(t.carta)}: su evento ${quien} se activa igualmente. ¿Qué va primero?`, opciones: [`Primero el evento ${quien} y después mis operaciones`, `Primero mis operaciones y después el evento ${quien}`] });
      }
      const ev = { t: 'evento', carta: t.carta, jugador: t.bando };
      const ops = { t: 'opsElegir', bando: t.bando, carta: t.carta, pc: t.pc };
      if ((r as any).i === 0) encolar(e, ev, ops);
      else encolar(e, ops, ev);
      return true;
    }

    case 'opsElegir':
      return tareaOpsElegir(e, t, r);

    case 'colocarOps':
      return tareaColocarOps(e, t, r);

    case 'ofensiva':
      return tareaOfensiva(e, t, r);

    case 'debateLocal':
      return tareaDebateLocal(e, t, r);

    case 'negociacion':
      return tareaNegociacion(e, t, r);

    case 'carrera': {
      const b: Bando = t.bando;
      const sig = CARRERA[e.carrera[b]];
      const dado = d6(e);
      e.carreraTurno[b]++;
      log(e, `${N(b)} intenta «${sig.nombre}» con ${nombreCarta(t.carta)}: saca ${dado} (necesita ${sig.tirada} o menos)`, 'dado', b);
      if (dado <= sig.tirada) avanzarCarrera(e, b);
      else log(e, 'La propuesta no cala: la Carrera no avanza', undefined, b);
      if (t.carta !== 0) e.descarte.push(t.carta);
      return true;
    }

    case 'evento':
      return tareaEvento(e, t);

    case 'finEvento': {
      const c = CARTAS[t.carta];
      if (t.carta === 0 || t.sinDescarte) return true;
      if (c.retirar) e.retiradas.push(t.carta);
      else e.descarte.push(t.carta);
      return true;
    }

    case 'descartar':
      if (t.carta !== 0) e.descarte.push(t.carta);
      return true;

    case 'efectos':
      return tareaEfectos(e, t);

    case 'colocar':
      return tareaColocarEvento(e, t, r);

    case 'retirar':
      return tareaRetirarEvento(e, t, r);

    case 'elegir': {
      const quien: Bando = t.quien;
      if (!r) return decidir(e, { tipo: 'opcion', bando: quien, texto: t.texto, opciones: t.opciones.map((o: any) => o.texto) });
      const o = t.opciones[(r as any).i];
      log(e, `${N(quien)} elige: ${o.texto}`, undefined, quien);
      if (o.efectos.length) encolar(e, { t: 'efectos', lista: o.efectos, i: 0, yo: t.yo });
      return true;
    }

    case 'elegirZona': {
      if (!r) return decidir(e, { tipo: 'opcion', bando: t.yo, texto: 'Elige la zona que se puntúa', opciones: ZONA_IDS.map((z) => ZONAS[z].nombre) });
      puntuarZonaYAplicar(e, ZONA_IDS[(r as any).i], !!t.ignorarVeda);
      return true;
    }

    case 'afinElegir': {
      const yo: Bando = t.yo;
      const veto = t.sinVetados && vetoVoxActivo(e);
      const opciones = REGIONALES.filter((k) => !t.hechos.includes(k) && (yo === 'P' ? e.afinidad[k] > -3 : e.afinidad[k] < 3) && !(veto && VETADOS_POR_VOX.includes(k)));
      if (t.veces <= 0 || opciones.length === 0) return true;
      if (!r) return decidir(e, { tipo: 'partido', bando: yo, texto: `Elige una fuerza que se acerque a ti (${t.veces} restante${t.veces > 1 ? 's' : ''})`, opciones, opcional: false });
      const k = (r as any).id as RegionalId;
      moverAfinidad(e, k, yo, t.n);
      t.hechos.push(k);
      t.veces--;
      return t.veces <= 0;
    }

    case 'fuga': {
      const yo: Bando = t.yo;
      const opciones = REGIONALES.filter((k) => e.afinidad[k] !== undefined);
      if (!r) return decidir(e, { tipo: 'partido', bando: yo, texto: 'Elige la fuerza nacionalista que pierde voto', opciones, opcional: false });
      const k = (r as any).id as RegionalId;
      e.modsPartido[k] = (e.modsPartido[k] ?? 0) - t.pct;
      log(e, `${PARTIDOS[k].siglas} pierde un ${Math.round(t.pct * 100)}% de su voto en favor de los grandes bloques`, undefined, yo);
      encolar(e, { t: 'colocar', yo, n: 1, filtro: { provs: TERRITORIO[k] }, puestas: {}, restante: 1 });
      return true;
    }

    case 'debateTV':
      log(e, t.tipo === 'cara' ? 'Lunes 16 de noviembre: cara a cara Sánchez–Feijóo' : 'Jueves 26 de noviembre: debate a cuatro', 'fase');
      e.debate = { P: null, C: null };
      encolar(e, { t: 'debateCarta', bando: 'P', tipo: t.tipo }, { t: 'debateCarta', bando: 'C', tipo: t.tipo }, { t: 'debateResolver', tipo: t.tipo });
      return true;

    case 'debateCarta': {
      const b: Bando = t.bando;
      const opciones = e.manos[b].filter((c) => !esEncuesta(c));
      if (opciones.length === 0) return true;
      if (!r) return decidir(e, { tipo: 'carta', bando: b, texto: `Prepara el ${t.tipo === 'cara' ? 'cara a cara' : 'debate a cuatro'}: sacrifica una carta (cuentan sus PC, el evento no se juega)`, proposito: 'debate', opciones, usos: {}, opcional: false });
      const c = (r as any).carta as number;
      quitarDeMano(e, b, c);
      e.debate[b] = c;
      return true;
    }

    case 'debateResolver':
      return debateResolver(e, t.tipo);

    case 'pegada':
      log(e, 'Viernes 13 de noviembre: arranca la campaña oficial. Pegada de carteles: cada bloque coloca 2 de presencia', 'fase');
      encolar(e,
        { t: 'colocarOps', bando: 'P', pc: 2, texto: 'Pegada de carteles: coloca 2 de presencia' },
        { t: 'colocarOps', bando: 'C', pc: 2, texto: 'Pegada de carteles: coloca 2 de presencia' });
      return true;

    case 'finTurno':
      return finTurno(e);

    case 'descarteOpcional': {
      const b: Bando = t.bando;
      const opciones = e.manos[b].filter((c) => !esEncuesta(c));
      if (opciones.length === 0) return true;
      if (!r) return decidir(e, { tipo: 'carta', bando: b, texto: 'Maquinaria territorial: puedes descartar una carta que te quedes', proposito: 'descarte', opciones, usos: {}, opcional: true });
      const c = (r as any).carta as number | null;
      if (c !== null) {
        quitarDeMano(e, b, c);
        e.descarte.push(c);
        log(e, `${N(b)} descarta una carta retenida`, undefined, b);
      }
      return true;
    }

    case 'cierreListas': {
      const dado = d6(e);
      log(e, `Lunes 26 de octubre, cierre de listas: Podemos va en solitario y decide su estrategia (dado ${dado})`, 'fase');
      suceso(e, { s: 'listas', dado });
      e.enJuego = null;
      if (dado <= 2) {
        log(e, 'Podemos va a por todas contra el PSOE y contra la derecha', 'evento');
        cambiarPodemos(e, 1, -1);
      } else if (dado >= 5) {
        log(e, 'Podemos guiña al PSOE: «Estaremos para frenar a la derecha»', 'evento');
        cambiarPodemos(e, 0, 1);
      } else log(e, 'Podemos mantiene su estrategia', 'evento');
      return true;
    }

    case 'nocheElectoral': {
      e.fase = 'fin';
      log(e, 'Domingo 29 de noviembre: noche electoral', 'fase');
      e.enJuego = null;
      // Como la carta China en TS: quien tenga El Voto Útil al final suma 1 PV
      log(e, `${N(e.votoUtil.duenio)} conserva El Voto Útil al cierre de la campaña`, undefined, e.votoUtil.duenio);
      pv(e, e.votoUtil.duenio, 1);
      if (e.ganador) return true;
      const res = proyectar(PROVINCIAS, e);
      terminar(e, res.ganador, res.motivo);
      return true;
    }

    // —— mecánicas de TS ——
    case 'batalla':
      return tareaBatalla(e, t, r);

    case 'provinciaUnica':
      return tareaProvinciaUnica(e, t, r);

    case 'mover':
      return tareaMover(e, t, r);

    case 'bloqueo': {
      const rv: Bando = RIVAL[t.yo as Bando];
      const opciones = e.manos[rv].filter((c) => !esEncuesta(c) && CARTAS[c].ops >= t.minOps);
      if (!r) {
        if (opciones.length === 0) {
          perderTodo(e, t.prov, rv, t.motivo ?? 'Bloqueo');
          return true;
        }
        return decidir(e, { tipo: 'carta', bando: rv, texto: `${t.motivo}: descarta una carta de ${t.minOps} o más PC o pierdes toda tu presencia en ${PROV[t.prov].corto}`, proposito: 'bloqueo', opciones, usos: {}, opcional: true });
      }
      const c = (r as any).carta as number | null;
      if (c === null) perderTodo(e, t.prov, rv, t.motivo);
      else {
        quitarDeMano(e, rv, c);
        e.descarte.push(c);
        log(e, `${N(rv)} descarta ${nombreCarta(c)} para evitar el bloqueo`, undefined, rv);
      }
      return true;
    }

    case 'duplicar': {
      const yo: Bando = t.yo;
      const rv = RIVAL[yo];
      if (t.fase === undefined) {
        const opciones = e.manos[rv].filter((c) => !esEncuesta(c) && CARTAS[c].ops >= 3);
        if (opciones.length && !r) return decidir(e, { tipo: 'carta', bando: rv, texto: 'Descarta una carta de 3 o más PC o tu rival duplicará su presencia en dos provincias', proposito: 'bloqueo', opciones, usos: {}, opcional: true });
        const c = r ? ((r as any).carta as number | null) : null;
        if (c !== null && c !== undefined) {
          quitarDeMano(e, rv, c);
          e.descarte.push(c);
          log(e, `${N(rv)} descarta ${nombreCarta(c)}`, undefined, rv);
          return true;
        }
        t.fase = 'elegir';
        t.hechas = [];
        r = undefined;
      }
      const ops = PROVINCIAS.filter((p) => e.presencia[p.id][yo] > 0 && !t.hechas.includes(p.id) && cumpleFiltro(e, p, t.filtro, yo)).map((p) => p.id);
      if (t.hechas.length >= t.n || ops.length === 0) return true;
      if (!r) return decidir(e, { tipo: 'provincia', bando: yo, texto: `Duplica tu presencia en una provincia (${t.n - t.hechas.length} restante${t.n - t.hechas.length > 1 ? 's' : ''})`, opciones: ops, opcional: false, restantes: t.n - t.hechas.length });
      const id = (r as any).id as string;
      e.presencia[id][yo] *= 2;
      t.hechas.push(id);
      log(e, `${N(yo)} duplica su presencia en ${PROV[id].corto}`, undefined, yo);
      return t.hechas.length >= t.n;
    }

    case 'fijarClima': {
      const yo: Bando = t.yo;
      const niveles = [2, 3, 4, 5];
      if (!r) return decidir(e, { tipo: 'opcion', bando: yo, texto: 'Fija el Clima de campaña en el nivel que quieras', opciones: niveles.map((n) => `Clima ${n} (${NOMBRES_CLIMA[n]})`) });
      fijarClima(e, niveles[(r as any).i]);
      e.exigencia[yo] += 5;
      log(e, `${N(yo)} suma 5 PC de ofensiva para la Exigencia`, undefined, yo);
      return true;
    }

    case 'olimpiadas': {
      const yo: Bando = t.yo;
      const rv = RIVAL[yo];
      if (!r) return decidir(e, { tipo: 'opcion', bando: rv, texto: 'Te retan a un debate en las redes: ¿participas o lo boicoteas?', opciones: ['Participar (dado contra dado; el que reta suma +2; el ganador se lleva 2 PV)', 'Boicotear (el Clima baja 1 y el rival hace 4 PC de operaciones)'] });
      if ((r as any).i === 0) {
        let a = 0, b = 0;
        while (a === b) { a = d6(e) + 2; b = d6(e); }
        log(e, `Debate en las redes: ${N(yo)} ${a} · ${N(rv)} ${b}`, 'dado');
        pv(e, a > b ? yo : rv, 2);
      } else {
        log(e, `${N(rv)} boicotea el debate`, undefined, rv);
        const antes = e.enJuego;
        e.enJuego = rv;
        cambiarClima(e, -1);
        e.enJuego = antes;
        if (!e.ganador) encolar(e, { t: 'opsElegir', bando: yo, carta: -1, pc: 4 });
      }
      return true;
    }

    case 'cumbre': {
      if (t.ganador === undefined) {
        const a = d6(e) + zonasDominadas(e, 'P');
        const b = d6(e) + zonasDominadas(e, 'C');
        log(e, `Cumbre: Progresista ${a} · Conservador ${b}`, 'dado');
        if (a === b) { log(e, 'La cumbre acaba sin acuerdo'); return true; }
        t.ganador = a > b ? 'P' : 'C';
        pv(e, t.ganador, 2);
        if (e.ganador) return true;
      }
      if (!r) return decidir(e, { tipo: 'opcion', bando: t.ganador, texto: 'Has ganado la cumbre: puedes mover el Clima', opciones: ['Subir el Clima 1', 'Bajar el Clima 1', 'Dejarlo como está'] });
      const i = (r as any).i;
      const antes = e.enJuego;
      e.enJuego = t.ganador;
      if (i === 0) cambiarClima(e, 1);
      else if (i === 1) cambiarClima(e, -1);
      e.enJuego = antes;
      return true;
    }

    case 'recuperar': {
      const yo: Bando = t.yo;
      const opciones = e.descarte.filter((c) => !esEncuesta(c) && (!t.jugar || (CARTAS[c].lado !== RIVAL[yo] && eventoJugable(e, c, yo))));
      if (opciones.length === 0) return true;
      if (!r) return decidir(e, { tipo: 'carta', bando: yo, texto: t.jugar ? 'Elige una carta del descarte: jugarás su evento' : 'Elige una carta del descarte para recuperarla', proposito: 'recuperar', opciones, usos: {}, opcional: false });
      const c = (r as any).carta as number;
      e.descarte.splice(e.descarte.indexOf(c), 1);
      if (t.jugar) {
        log(e, `${N(yo)} rescata ${nombreCarta(c)} del descarte y juega su evento`, 'evento', yo);
        encolar(e, { t: 'evento', carta: c, jugador: yo });
      } else {
        e.manos[yo].push(c);
        log(e, `${N(yo)} recupera ${nombreCarta(c)} del descarte`, undefined, yo);
      }
      return true;
    }

    case 'intercambio': {
      const yo: Bando = t.yo;
      const rv = RIVAL[yo];
      if (t.recibida === undefined) {
        const candidatas = e.manos[rv].filter((c) => !esEncuesta(c));
        if (candidatas.length === 0) { log(e, `${N(rv)} no tiene cartas que entregar`); return true; }
        const max = Math.max(...candidatas.map((c) => CARTAS[c].ops));
        const c = candidatas.find((x) => CARTAS[x].ops === max)!;
        quitarDeMano(e, rv, c);
        e.manos[yo].push(c);
        t.recibida = c;
        log(e, `${N(rv)} entrega ${nombreCarta(c)} (${max} PC) al ${N(yo)}`, undefined, yo);
      }
      const opciones = e.manos[yo].filter((c) => c !== t.recibida && !esEncuesta(c));
      if (opciones.length === 0) return true;
      if (!r) return decidir(e, { tipo: 'carta', bando: yo, texto: 'Entrega al rival una carta de tu mano a cambio', proposito: 'entregar', opciones, usos: {}, opcional: false });
      const c = (r as any).carta as number;
      quitarDeMano(e, yo, c);
      e.manos[rv].push(c);
      log(e, `${N(yo)} entrega a cambio ${nombreCarta(c)}`, undefined, yo);
      return true;
    }

    case 'fichaje': {
      const yo: Bando = t.yo;
      const rv = RIVAL[yo];
      if (t.carta === undefined) {
        if (e.manos[rv].length === 0) { encolar(e, { t: 'opsElegir', bando: yo, carta: -1, pc: 2 }); return true; }
        const c = e.manos[rv][Math.floor(aleatorio(e) * e.manos[rv].length)];
        quitarDeMano(e, rv, c);
        t.carta = c;
        log(e, `${N(yo)} se lleva ${nombreCarta(c)} de la mano del rival`, 'evento', yo);
        if (esEncuesta(c)) {
          e.manos[rv].push(c);
          log(e, 'Es una Encuesta: vuelve a su dueño y se usan 2 PC', undefined, yo);
          encolar(e, { t: 'opsElegir', bando: yo, carta: -1, pc: 2 });
          return true;
        }
      }
      if (!r) return decidir(e, { tipo: 'opcion', bando: yo, texto: `Te has llevado ${nombreCarta(t.carta)}`, opciones: [`Jugar ${nombreCarta(t.carta)} ahora`, 'Devolverla y usar 2 PC de operaciones'] });
      if ((r as any).i === 0) encolar(e, { t: 'jugarCarta', bando: yo, carta: t.carta });
      else {
        e.manos[rv].push(t.carta);
        encolar(e, { t: 'opsElegir', bando: yo, carta: -1, pc: 2 });
      }
      return true;
    }

    case 'topo': {
      const yo: Bando = t.yo;
      const rv = RIVAL[yo];
      e.manoVista[yo] = true;
      const opciones = e.manos[rv].filter((c) => !esEncuesta(c));
      if (opciones.length === 0) return true;
      if (!r) return decidir(e, { tipo: 'carta', bando: yo, texto: 'Ves la mano del rival: elige la carta que descarta', proposito: 'topo', opciones, usos: {}, opcional: false });
      const c = (r as any).carta as number;
      quitarDeMano(e, rv, c);
      e.descarte.push(c);
      log(e, `${N(rv)} pierde ${nombreCarta(c)}`, undefined, yo);
      return true;
    }

    case 'redibujar': {
      const yo: Bando = t.yo;
      const opciones = e.manos[yo].filter((c) => !esEncuesta(c));
      if (r) {
        const c = (r as any).carta as number | null;
        if (c === null) {
          for (let i = 0; i < t.n; i++) robar(e, yo);
          log(e, `${N(yo)} cambia ${t.n} carta${t.n === 1 ? '' : 's'}`, undefined, yo);
          return true;
        }
        quitarDeMano(e, yo, c);
        e.descarte.push(c);
        t.n++;
      }
      const quedan = e.manos[yo].filter((c) => !esEncuesta(c));
      if (quedan.length === 0) {
        for (let i = 0; i < t.n; i++) robar(e, yo);
        return true;
      }
      void opciones;
      return decidir(e, { tipo: 'carta', bando: yo, texto: `Descarta las cartas que quieras cambiar (${t.n} descartada${t.n === 1 ? '' : 's'}). Termina para robar las nuevas`, proposito: 'descarte', opciones: quedan, usos: {}, opcional: true });
    }

    case 'junta': {
      const yo: Bando = t.yo;
      const opciones = e.manos[yo].filter((c) => CARTAS[c].lado === RIVAL[yo] || CARTAS[c].lado === 'W');
      if (opciones.length === 0) return true;
      if (!r) return decidir(e, { tipo: 'carta', bando: yo, texto: 'Junta Electoral Central: elige una carta del rival o de Podemos de tu mano; usarás sus PC sin activar su evento', proposito: 'junta', opciones, usos: {}, opcional: false });
      const c = (r as any).carta as number;
      quitarDeMano(e, yo, c);
      e.descarte.push(c);
      log(e, `La Junta Electoral neutraliza ${nombreCarta(c)}: ${N(yo)} usa sus PC sin su evento`, 'evento', yo);
      encolar(e, { t: 'opsElegir', bando: yo, carta: c, pc: opsEfectivos(e, yo, c) });
      return true;
    }

    case 'granCoalicion': {
      const yo: Bando = t.yo;
      if (!r) return decidir(e, { tipo: 'opcion', bando: yo, texto: 'Con el Clima en 2 puedes forzar una gran coalición y acabar la campaña ahora', opciones: ['Forzarla: la campaña termina ya y el rival gana 6 PV', 'No forzarla'] });
      if ((r as any).i === 0) {
        log(e, `${N(yo)} fuerza el final de la campaña`, 'fase', yo);
        pv(e, RIVAL[yo], 6);
        if (!e.ganador) e.pila = [{ t: 'nocheElectoral' }];
      }
      return true;
    }

    case 'crisisDesactivar': {
      const b: Bando = t.bando;
      if (!r) return decidir(e, { tipo: 'opcion', bando: b, texto: 'Crisis institucional: si lanzas una ofensiva este turno, pierdes. Puedes desactivarla retirando 2 de tu presencia', opciones: t.opciones });
      const elegido = t.opciones[(r as any).i] as string;
      const prov = elegido.includes('Madrid') ? MADRID : elegido.includes('Barcelona') ? '08' : null;
      if (prov) {
        e.presencia[prov][b] -= 2;
        quitarEfectos(e, (x) => x.tipo === 'crisis' && x.dueno === RIVAL[b]);
        log(e, `${N(b)} desactiva la crisis institucional retirando 2 de presencia en ${PROV[prov].corto}`, undefined, b);
      }
      return true;
    }

    case 'activarElegir': {
      const yo: Bando = t.yo;
      if (t.elegirZona) {
        if (!r) return decidir(e, { tipo: 'opcion', bando: yo, texto: 'Elige la zona', opciones: ZONA_IDS.map((z) => ZONAS[z].nombre) });
        activarEfecto(e, { tipo: t.tipo, dueno: yo, hasta: t.hasta, carta: t.carta, zona: ZONA_IDS[(r as any).i] });
        return true;
      }
      const ops = PROVINCIAS.filter((p) => cumpleFiltro(e, p, t.filtro, yo)).map((p) => p.id);
      if (ops.length === 0) return true;
      if (!r) return decidir(e, { tipo: 'provincia', bando: yo, texto: 'Elige la provincia', opciones: ops, opcional: false, restantes: 1 });
      activarEfecto(e, { tipo: t.tipo, dueno: yo, hasta: t.hasta, carta: t.carta, prov: (r as any).id });
      return true;
    }

    case 'morado': {
      const yo: Bando = t.yo;
      if (r) {
        const id = (r as any).id as string;
        e.morado[id] = Math.max(0, Math.min(2, e.morado[id] + (t.n > 0 ? 1 : -1)));
        t.hechos++;
        log(e, t.n > 0 ? `Podemos planta un marcador morado en ${PROV[id].corto}` : `Se retira un marcador morado de ${PROV[id].corto}`, undefined, null);
      }
      if (t.hechos >= Math.abs(t.n)) return true;
      const ops = PROVINCIAS.filter((p) => cumpleFiltro(e, p, t.filtro, yo) && (t.n > 0 ? e.morado[p.id] < 2 : e.morado[p.id] > 0)).map((p) => p.id);
      if (ops.length === 0) return true;
      if (ops.length === 1) return paso(e, t, { tipo: 'provincia', id: ops[0] });
      return decidir(e, { tipo: 'provincia', bando: yo, texto: t.n > 0 ? 'Elige dónde planta Podemos un marcador morado' : 'Elige de dónde se retira un marcador morado', opciones: ops, opcional: false, restantes: Math.abs(t.n) - t.hechos });
    }
  }
  throw new Error('Tarea desconocida: ' + t.t);
}

function perderTodo(e: Estado, prov: string, b: Bando, motivo: string) {
  const n = e.presencia[prov][b];
  e.presencia[prov][b] = 0;
  log(e, `${motivo}: ${N(b)} pierde toda su presencia en ${PROV[prov].corto} (${n})`, undefined, RIVAL[b]);
}

function inicioTurno(e: Estado): boolean {
  e.turno++;
  e.ronda = 0;
  e.fase = 'portada';
  e.enJuego = null;
  log(e, `— Semana ${e.turno} (${FECHAS[e.turno]}) —`, 'fase');
  if (e.turno > 1) cambiarClima(e, 1);
  e.exigencia = { P: 0, C: 0 };
  e.carreraTurno = { P: 0, C: 0 };
  e.negociado = [];
  e.rondasHechas = { P: 0, C: 0 };
  e.rondaExtra = { P: 0, C: 0 };
  e.portada = { P: null, C: null };
  e.manoVista = { P: false, C: false };
  e.agendaActual = null;
  if (e.turno === 4 || e.turno === 7) {
    const nuevo = MAZO_IDS[e.turno === 4 ? 2 : 3];
    e.mazo = barajar(e, [...e.mazo, ...nuevo]);
    log(e, e.turno === 4 ? 'Entra en juego el mazo de Campaña' : 'Entra en juego el mazo de Recta final', 'fase');
  }
  const tam = tamanoMano(e.turno);
  for (let i = 0; i < 12; i++) {
    for (const b of ['P', 'C'] as Bando[]) if (e.manos[b].length < tam) robar(e, b);
  }
  const tareas: Tarea[] = [];
  if (e.turno === 6) tareas.push({ t: 'pegada' });
  // Portada: si un bando tiene el Gabinete de prensa, el rival elige (y muestra) primero
  const orden: Bando[] = tieneVentajaCarrera(e, 'P', 'portada') ? ['C', 'P'] : ['P', 'C'];
  for (const b of orden) tareas.push({ t: 'portada', bando: b, visible: tieneVentajaCarrera(e, RIVAL[b], 'portada') });
  tareas.push({ t: 'portadaResolver' }, { t: 'agendaPodemos' });
  if (e.turno === 7) tareas.push({ t: 'debateTV', tipo: 'cara' });
  for (let r = 1; r <= MAX_RONDAS; r++) {
    tareas.push({ t: 'ronda', bando: 'P', r }, { t: 'ronda', bando: 'C', r });
    if (e.turno === 8 && r === 3) tareas.push({ t: 'debateTV', tipo: 'cuatro' });
  }
  tareas.push({ t: 'finTurno' });
  encolar(e, ...tareas);
  return true;
}

function tareaPortada(e: Estado, t: Tarea, r: Respuesta | undefined): boolean {
  const b: Bando = t.bando;
  const opciones = e.manos[b].filter((c) => c !== ID_JUNTA);
  if (opciones.length === 0) return true;
  if (!r) return decidir(e, { tipo: 'carta', bando: b, texto: 'Elige tu Portada: el evento de esta carta abre la semana', proposito: 'portada', opciones, usos: {}, opcional: false });
  const c = (r as any).carta as number;
  quitarDeMano(e, b, c);
  e.portada[b] = c;
  log(e, `${N(b)} elige su Portada${t.visible ? `: ${nombreCarta(c)}` : ''}`, undefined, b);
  return true;
}

function portadaResolver(e: Estado): boolean {
  const cp = e.portada.P;
  const cc = e.portada.C;
  log(e, `Portadas: Progresista ${cp !== null ? nombreCarta(cp) : '—'} · Conservador ${cc !== null ? nombreCarta(cc) : '—'}`, 'evento');
  const anulada: Record<Bando, boolean> = { P: false, C: false };
  // Tránsfuga (Defectors): como Portada de su dueño, anula la Portada del rival
  for (const b of ['P', 'C'] as Bando[]) {
    const c = e.portada[b];
    const rc = e.portada[RIVAL[b]];
    if (c !== null && CARTAS[c].transfuga && CARTAS[c].lado === b && rc !== null) {
      anulada[RIVAL[b]] = true;
      log(e, `${nombreCarta(c)}: la Portada del ${N(RIVAL[b])} queda anulada`, 'evento', b);
    }
  }
  for (const b of ['P', 'C'] as Bando[]) {
    const c = e.portada[b];
    if (c !== null) suceso(e, { s: 'portada', bando: b, carta: c, anulada: anulada[b] });
  }
  const orden: Bando[] = [];
  if (cp !== null && cc !== null) {
    orden.push(CARTAS[cc].ops > CARTAS[cp].ops ? 'C' : 'P');
    orden.push(RIVAL[orden[0]]);
  } else if (cp !== null) orden.push('P');
  else if (cc !== null) orden.push('C');
  const tareas: Tarea[] = [];
  for (const b of orden) {
    const c = e.portada[b] as number;
    const transfugaPropia = CARTAS[c].transfuga && CARTAS[c].lado === b && e.portada[RIVAL[b]] !== null;
    if (anulada[b] || transfugaPropia) {
      e.descarte.push(c);
      continue;
    }
    castigoBatalla(e, b, c);
    tareas.push({ t: 'evento', carta: c, jugador: b, portada: true });
  }
  encolar(e, ...tareas);
  e.fase = 'acciones';
  return true;
}

/** Agenda de Podemos: cada semana Podemos destapa una carta que desestabiliza a los dos bloques. */
function tareaAgenda(e: Estado): boolean {
  if (e.agenda.length === 0) e.agenda = barajar(e, [...AGENDA_IDS]);
  const id = e.agenda.pop() as number;
  const c = CARTAS[id];
  e.agendaActual = id;
  e.enJuego = null;
  const l = lider(e);
  log(e, `Podemos marca la agenda: «${c.nombre}». ${c.texto}`, 'evento');
  suceso(e, { s: 'agenda', carta: id, lider: l });
  encolar(e, { t: 'efectos', lista: c.efectos, i: 0, yo: l });
  return true;
}

/** Manifiestos (Flower Power): el rival cobra 2 PV cada vez que juegas una carta de batalla. */
function castigoBatalla(e: Estado, b: Bando, carta: number) {
  if (!CARTAS[carta].batalla) return;
  for (const x of efectosDe(e, 'manifiesto', RIVAL[b])) {
    log(e, `Manifiesto en vigor: el ${N(x.dueno)} capitaliza la batalla`, undefined, x.dueno);
    pv(e, x.dueno, 2);
  }
}

function tareaRonda(e: Estado, t: Tarea, r: Respuesta | undefined): boolean {
  const b: Bando = t.bando;
  if (t.r > rondasDe(e, b)) return true;
  e.ronda = t.r;
  e.enJuego = b;
  // Crisis institucional: el bando amenazado puede desactivarla al empezar su ronda
  if (!t.crisisVista) {
    t.crisisVista = true;
    if (tieneEfecto(e, 'crisis', RIVAL[b])) {
      const opciones: string[] = [];
      if (e.presencia[MADRID][b] >= 2) opciones.push('Retirar 2 de mi presencia en Madrid');
      if (e.presencia['08'][b] >= 2) opciones.push('Retirar 2 de mi presencia en Barcelona');
      if (opciones.length) {
        opciones.push('Mantener la crisis (no lanzaré ofensivas)');
        encolar(e, { t: 'crisisDesactivar', bando: b, opciones });
        return false;
      }
    }
  }
  const opciones = [...e.manos[b]];
  if (e.votoUtil.duenio === b && e.votoUtil.disponible) opciones.push(0);
  if (opciones.length === 0) {
    if (!r) log(e, `${N(b)} no tiene cartas y pasa`, undefined, b);
    return true;
  }
  // Atasco (Quagmire / Bear Trap): descarta una carta de 2+ PC y saca 1-4 para salir
  const encuestas = e.manos[b].filter(esEncuesta);
  const quedan = rondasDe(e, b) - t.r + 1;
  const forzadas = encuestas.length >= quedan && encuestas.length > 0;
  const atasco = e.efectos.find((x) => x.tipo === 'atasco' && x.dueno === RIVAL[b]);
  const paraAtasco = e.manos[b].filter((c) => !esEncuesta(c) && CARTAS[c].ops >= 2);
  if (atasco && paraAtasco.length && !forzadas) {
    if (!r) return decidir(e, { tipo: 'carta', bando: b, texto: 'Estás atascado en una guerra interna: descarta una carta de 2 o más PC y saca 1-4 para salir', proposito: 'atasco', opciones: paraAtasco, usos: {}, opcional: false });
    const c = (r as any).carta as number;
    quitarDeMano(e, b, c);
    e.descarte.push(c);
    e.rondasHechas[b]++;
    const dado = d6(e);
    const sale = dado <= 4;
    log(e, `${N(b)} descarta ${nombreCarta(c)} intentando salir de la guerra interna: dado ${dado}${sale ? ' — ¡sale!' : ' — sigue atascado'}`, 'dado', b);
    suceso(e, { s: 'atasco', bando: b, sale });
    if (sale) quitarEfectos(e, (x) => x === atasco);
    encolar(e, { t: 'postRonda', bando: b });
    return true;
  }
  const disponibles = forzadas ? encuestas : opciones;
  if (!r) {
    const usos: Record<number, Uso[]> = {};
    for (const c of disponibles) usos[c] = usosCarta(e, b, c);
    return decidir(e, {
      tipo: 'carta', bando: b, proposito: 'accion', opciones: disponibles, usos, opcional: false,
      texto: disponibles === encuestas && encuestas.length < opciones.length ? 'Ronda de acción: debes publicar tus Encuestas antes de que acabe la semana' : 'Ronda de acción: juega una carta',
    });
  }
  const carta = (r as any).carta as number;
  const uso = (r as any).uso as Uso;
  quitarDeMano(e, b, carta);
  e.rondasHechas[b]++;
  encolar(e, ...jugarCartaUso(e, b, carta, uso), { t: 'postRonda', bando: b });
  return true;
}

/** Tareas para jugar una carta (que ya no está en la mano) con un uso concreto. */
function jugarCartaUso(e: Estado, b: Bando, carta: number, uso: Uso): Tarea[] {
  e.ultimaJugada = { bando: b, carta, uso };
  suceso(e, { s: 'carta', bando: b, carta, uso });
  const c = CARTAS[carta];
  if (uso !== 'carrera') castigoBatalla(e, b, carta);
  if (uso === 'evento') {
    log(e, `${N(b)} juega ${nombreCarta(carta)} como evento`, 'evento', b);
    return [{ t: 'evento', carta, jugador: b }];
  }
  if (uso === 'carrera') return [{ t: 'carrera', bando: b, carta }];
  const pc = opsEfectivos(e, b, carta);
  log(e, `${N(b)} juega ${nombreCarta(carta)} por ${pc} PC`, 'evento', b);
  if (carta === 0) {
    log(e, 'El Voto Útil pasa boca abajo al rival', undefined, b);
    return [{ t: 'opsElegir', bando: b, carta, pc, votoUtil: true }];
  }
  if (eventoAjeno(carta, b) && eventoJugable(e, carta, b)) return [{ t: 'ordenEvento', bando: b, carta, pc }];
  void c;
  return [{ t: 'opsElegir', bando: b, carta, pc }, { t: 'descartar', carta }];
}

/** Tras la ronda de b: la cuenta atrás del rival se cobra salvo que b haya jugado la Junta Electoral. */
function postRonda(e: Estado, b: Bando): boolean {
  const ca = e.efectos.find((x) => x.tipo === 'cuentaAtras' && x.dueno === RIVAL[b]);
  if (!ca) return true;
  quitarEfectos(e, (x) => x === ca);
  const u = e.ultimaJugada;
  if (u && u.bando === b && u.carta === ID_JUNTA && u.uso === 'evento') {
    log(e, `La Junta Electoral desactiva la cuenta atrás del ${N(ca.dueno)}`, undefined, b);
    return true;
  }
  log(e, `La cuenta atrás se cumple: el ${N(b)} no la ha frenado`, undefined, ca.dueno);
  e.enJuego = null;
  pv(e, ca.dueno, 3);
  return true;
}

/** Modos de colocación con bonos: Voto Útil (provincias pequeñas) y bonos de zona. */
function modosBono(e: Estado, b: Bando, votoUtil: boolean): { texto: string; extra: number; filtro?: Filtro }[] {
  const modos: { texto: string; extra: number; filtro?: Filtro }[] = [{ texto: 'Sin restricciones', extra: 0 }];
  if (votoUtil) modos.push({ texto: '+1 PC solo en circunscripciones de 5 escaños o menos', extra: 1, filtro: { maxEscanos: 5 } });
  for (const z of zonasBono(e, b)) modos.push({ texto: `+1 PC solo en ${ZONAS[z].nombre}`, extra: 1, filtro: { zonas: [z] } });
  return modos;
}

function tareaOpsElegir(e: Estado, t: Tarea, r: Respuesta | undefined): boolean {
  const b: Bando = t.bando;
  const pc: number = t.pc;
  if (e.ganador) return true;
  const opciones: Operacion[] = [];
  const eleg = elegiblesPresencia(e, b);
  if (eleg.some((id) => costePresencia(e, id, b) <= pc + (modosBono(e, b, !!t.votoUtil).length > 1 ? 1 : 0))) opciones.push('presencia');
  if (objetivosAtaque(e, b).length) opciones.push('ofensiva', 'debate');
  if (pc >= 2 && partidosNegociables(e, b).length) opciones.push('negociacion');
  if (opciones.length === 0) {
    log(e, `${N(b)} no puede usar sus PC`, undefined, b);
    return true;
  }
  if (!r) return decidir(e, { tipo: 'operacion', bando: b, texto: `¿Cómo usas ${pc} PC?`, carta: t.carta, pc, opciones });
  const op = (r as any).op as Operacion;
  if (op === 'presencia') encolar(e, { t: 'colocarOps', bando: b, pc, votoUtil: !!t.votoUtil });
  else if (op === 'ofensiva') encolar(e, { t: 'ofensiva', bando: b, pc, votoUtil: !!t.votoUtil });
  else if (op === 'debate') encolar(e, { t: 'debateLocal', bando: b, restantes: pc, votoUtil: !!t.votoUtil });
  else encolar(e, { t: 'negociacion', bando: b, pasos: Math.floor(pc / 2) });
  return true;
}

function tareaColocarOps(e: Estado, t: Tarea, r: Respuesta | undefined): boolean {
  const b: Bando = t.bando;
  if (t.restante === undefined) {
    const modos = t.inicial ? [{ texto: '', extra: 0 }] : modosBono(e, b, !!t.votoUtil);
    if (modos.length > 1 && t.modo === undefined) {
      if (!r) return decidir(e, { tipo: 'opcion', bando: b, texto: `¿Cómo colocas ${t.pc} PC de presencia?`, opciones: modos.map((m) => (m.extra ? m.texto : `${t.pc} PC sin restricciones`)) });
      t.modo = (r as any).i;
      r = undefined;
    }
    const modo = modos[t.modo ?? 0];
    t.restante = t.pc + modo.extra;
    let eleg = t.ignorarAdy ? PROVINCIAS.map((p) => p.id) : elegiblesPresencia(e, b);
    if (t.filtro) eleg = eleg.filter((id) => cumpleFiltro(e, PROV[id], t.filtro, b));
    if (modo.filtro) eleg = eleg.filter((id) => cumpleFiltro(e, PROV[id], modo.filtro, b));
    t.elegibles = eleg;
    t.puestas = 0;
  }
  if (r) {
    const id = (r as any).id as string | null;
    if (id === null) return true;
    const coste = costePresencia(e, id, b);
    const antes = controlador(e, id);
    e.presencia[id][b]++;
    t.restante -= coste;
    t.puestas++;
    log(e, `${N(b)} coloca presencia en ${PROV[id].corto}${coste > 1 ? ' (coste 2)' : ''}`, undefined, b);
    registrarControl(e, id, antes);
  }
  if (e.ganador) return true;
  const ops = (t.elegibles as string[]).filter((id) => costePresencia(e, id, b) <= t.restante);
  if (t.restante <= 0 || ops.length === 0) return true;
  return decidir(e, { tipo: 'provincia', bando: b, texto: `${t.texto ?? 'Coloca presencia'} — quedan ${t.restante} PC`, opciones: ops, opcional: !t.inicial && t.puestas > 0, restantes: t.restante });
}

function registrarControl(e: Estado, id: string, antes: Bando | null) {
  if (e.silencio) return;
  const despues = controlador(e, id);
  if (despues !== antes) suceso(e, { s: 'control', prov: id, antes, despues });
}

function tareaOfensiva(e: Estado, t: Tarea, r: Respuesta | undefined): boolean {
  const b: Bando = t.bando;
  const objetivos = objetivosAtaque(e, b, t.filtro, !!t.ignorarClima);
  if (objetivos.length === 0) return true;
  if (!r) return decidir(e, { tipo: 'provincia', bando: b, texto: `Ofensiva con ${t.pc} PC: elige una provincia con presencia rival (dado + PC − 2×Fidelidad)`, opciones: objetivos, opcional: false, restantes: t.pc });
  const id = (r as any).id as string;
  const p = PROV[id];
  const rv = RIVAL[b];
  // Crisis institucional: lanzar una ofensiva con la crisis del rival en vigor es perder
  const crisis = e.efectos.find((x) => x.tipo === 'crisis' && x.dueno === rv);
  if (crisis) {
    terminar(e, rv, `Crisis institucional: el ${N(b)} lanza una ofensiva en plena crisis y lo paga en las urnas`);
    return true;
  }
  const bono = (t.votoUtil && p.escanos <= 5) || zonasBono(e, b).includes(p.zona) ? 1 : 0;
  const pc = t.pc + bono;
  const mod = modOfensiva(e, id, b);
  const dado = d6(e);
  const fid = fidelidadEf(e, id);
  const res = dado + pc + mod - 2 * fid;
  const antes = controlador(e, id);
  log(e, `${N(b)} lanza una ofensiva en ${p.corto}: dado ${dado} + ${pc} PC${mod ? ` ${mod > 0 ? '+' : '−'} ${Math.abs(mod)}` : ''} − ${2 * fid} = ${res}`, 'dado', b);
  if (res > 0) {
    const quita = Math.min(res, e.presencia[id][rv]);
    e.presencia[id][rv] -= quita;
    e.presencia[id][b] += res - quita;
    log(e, `Éxito: −${quita} presencia ${N(rv).toLowerCase()}${res - quita > 0 ? `, +${res - quita} propia` : ''}`, undefined, b);
  } else log(e, 'La ofensiva no tiene efecto', undefined, b);
  suceso(e, { s: 'ofensiva', bando: b, prov: id, exito: res > 0 });
  registrarControl(e, id, antes);
  e.exigencia[b] += pc;
  for (const x of efectosDe(e, 'jovenes', rv)) {
    log(e, `La campaña del ${N(x.dueno)} capitaliza la ofensiva`, undefined, x.dueno);
    pv(e, x.dueno, 1);
  }
  if (p.clave && !t.sinClima && !tieneEfecto(e, 'campanaLimpia', b)) cambiarClima(e, -1);
  return true;
}

function tiradaDebate(e: Estado, id: string, b: Bando): number {
  const p = PROV[id];
  let m = 0;
  for (const v of p.vecinos) if (controla(e, v, b)) m++;
  if (e.presencia[id][b] > e.presencia[id][RIVAL[b]]) m++;
  if (p.feudo === b) m++;
  if (tieneEfecto(e, 'sombra', RIVAL[b])) m--;
  return m;
}

function tareaDebateLocal(e: Estado, t: Tarea, r: Respuesta | undefined): boolean {
  const b: Bando = t.bando;
  if (e.ganador) return true;
  if (t.modo === undefined) {
    const modos = modosBono(e, b, !!t.votoUtil);
    if (modos.length > 1) {
      if (!r) return decidir(e, { tipo: 'opcion', bando: b, texto: `¿Cómo usas ${t.restantes} intentos de debate local?`, opciones: modos.map((m) => (m.extra ? m.texto.replace('PC', 'intento') : `${t.restantes} intentos sin restricciones`)) });
      t.modo = (r as any).i;
      t.restantes += modos[t.modo].extra;
      t.filtroModo = modos[t.modo].filtro;
      r = undefined;
    } else t.modo = 0;
  }
  if (t.restantes <= 0) return true;
  const objetivos = objetivosAtaque(e, b, t.filtroModo);
  if (objetivos.length === 0) return true;
  if (!r) return decidir(e, { tipo: 'provincia', bando: b, texto: `Debate local (${t.restantes} restante${t.restantes > 1 ? 's' : ''}): elige una provincia con presencia rival`, opciones: objetivos, opcional: true, restantes: t.restantes });
  const id = (r as any).id as string | null;
  if (id === null) return true;
  const rv = RIVAL[b];
  const mb = tiradaDebate(e, id, b);
  const mr = tiradaDebate(e, id, rv);
  const db = d6(e) + mb;
  const dr = d6(e) + mr;
  const antes = controlador(e, id);
  log(e, `Debate local en ${PROV[id].corto}: ${N(b)} ${db} (mod ${fmtSigno(mb)}) contra ${N(rv)} ${dr} (mod ${fmtSigno(mr)})`, 'dado', b);
  if (db > dr) {
    const q = Math.min(db - dr, e.presencia[id][rv]);
    e.presencia[id][rv] -= q;
    if (q) log(e, `${N(rv)} pierde ${q} de presencia`, undefined, b);
  } else if (dr > db) {
    const q = Math.min(dr - db, e.presencia[id][b]);
    e.presencia[id][b] -= q;
    if (q) log(e, `${N(b)} pierde ${q} de presencia`, undefined, rv);
  } else log(e, 'Empate: nadie se mueve', undefined, b);
  registrarControl(e, id, antes);
  t.restantes--;
  return t.restantes <= 0;
}

function tareaNegociacion(e: Estado, t: Tarea, r: Respuesta | undefined): boolean {
  const b: Bando = t.bando;
  if (e.ganador || t.pasos <= 0) return true;
  const opciones = partidosNegociables(e, b);
  if (opciones.length === 0) return true;
  if (!r) return decidir(e, { tipo: 'partido', bando: b, texto: `Negociación (${t.pasos} paso${t.pasos > 1 ? 's' : ''}): elige una fuerza con la que tengas presencia en su territorio`, opciones, opcional: true });
  const k = (r as any).id as Negociable | null;
  if (k === null) return true;
  log(e, `${N(b)} negocia con ${PARTIDOS[k].siglas}`, undefined, b);
  suceso(e, { s: 'negocia', bando: b, partido: k });
  e.negociado.push(k);
  if (k === 'PODEMOS') {
    cambiarPodemos(e, 0, 1);
    log(e, 'Las concesiones a Podemos tienen coste', undefined, 'C');
    pv(e, 'C', 1);
  } else {
    moverAfinidad(e, k, b, 1);
    if (b === 'P' && CESIONES_CARAS.includes(k)) {
      log(e, 'Las cesiones tienen coste fuera de su territorio', undefined, 'C');
      pv(e, 'C', 1);
    }
  }
  t.pasos--;
  return t.pasos <= 0;
}

function tareaEvento(e: Estado, t: Tarea): boolean {
  const c = CARTAS[t.carta];
  const jugador: Bando = t.jugador;
  e.enJuego = jugador;
  const yo = ladoEvento(c, jugador);
  if (!eventoJugable(e, t.carta, jugador)) {
    log(e, `${nombreCarta(t.carta)}: el evento no tiene efecto`, 'evento', yo);
    encolar(e, { t: 'finEvento', carta: t.carta });
    return true;
  }
  if (c.lado !== 'E') log(e, `Evento ${nombreCarta(t.carta)}${c.lado === 'N' ? '' : c.lado === 'W' ? ' (comodín de Podemos)' : ` (${N(c.lado as Bando)})`}: ${c.texto}`, 'evento', yo);
  encolar(e, { t: 'efectos', lista: c.efectos, i: 0, yo, carta: t.carta }, { t: 'finEvento', carta: t.carta });
  return true;
}

function tareaEfectos(e: Estado, t: Tarea): boolean {
  while (t.i < t.lista.length) {
    if (e.ganador) return true;
    const ef = t.lista[t.i++] as Efecto;
    if (aplicarEfecto(e, ef, t.yo, t.carta ?? -1)) return false;
  }
  return true;
}

function opcionesColocarEvento(e: Estado, t: Tarea): string[] {
  const yo: Bando = t.yo;
  return PROVINCIAS.filter((p) => {
    if (!cumpleFiltro(e, p, t.filtro, yo)) return false;
    const n = t.puestas[p.id] ?? 0;
    if (t.maxPor && n >= t.maxPor) return false;
    if (t.unaSola && Object.keys(t.puestas).length > 0 && n === 0) return false;
    return true;
  }).map((p) => p.id);
}

function tareaColocarEvento(e: Estado, t: Tarea, r: Respuesta | undefined): boolean {
  const yo: Bando = t.yo;
  if (r) {
    const id = (r as any).id as string;
    const antes = controlador(e, id);
    e.presencia[id][yo]++;
    t.puestas[id] = (t.puestas[id] ?? 0) + 1;
    t.restante--;
    log(e, `${N(yo)} coloca presencia en ${PROV[id].corto}`, undefined, yo);
    registrarControl(e, id, antes);
  }
  if (t.restante <= 0) return true;
  const ops = opcionesColocarEvento(e, t);
  if (ops.length === 0) return true;
  if (ops.length === 1) return tareaColocarEvento(e, t, { tipo: 'provincia', id: ops[0] });
  return decidir(e, { tipo: 'provincia', bando: yo, texto: `Coloca presencia — quedan ${t.restante}`, opciones: ops, opcional: false, restantes: t.restante });
}

function tareaRetirarEvento(e: Estado, t: Tarea, r: Respuesta | undefined): boolean {
  const yo: Bando = t.yo;
  const rv = RIVAL[yo];
  if (r) {
    const id = (r as any).id as string;
    const antes = controlador(e, id);
    if (t.de === 'ambos') {
      if (e.presencia[id].P > 0) e.presencia[id].P--;
      if (e.presencia[id].C > 0) e.presencia[id].C--;
      log(e, `Ambos bloques pierden presencia en ${PROV[id].corto}`, undefined, yo);
    } else {
      e.presencia[id][rv]--;
      log(e, `${N(rv)} pierde presencia en ${PROV[id].corto}`, undefined, yo);
    }
    registrarControl(e, id, antes);
    t.quitadas[id] = (t.quitadas[id] ?? 0) + 1;
    t.restante--;
  }
  if (t.restante <= 0) return true;
  const ops = PROVINCIAS.filter((p) => {
    if (!cumpleFiltro(e, p, t.filtro, yo)) return false;
    const tiene = t.de === 'ambos' ? e.presencia[p.id].P + e.presencia[p.id].C > 0 : e.presencia[p.id][rv] > 0;
    if (!tiene) return false;
    const n = t.quitadas[p.id] ?? 0;
    if (t.maxPor && n >= t.maxPor) return false;
    if (t.unaSola && Object.keys(t.quitadas).length > 0 && n === 0) return false;
    return true;
  }).map((p) => p.id);
  if (ops.length === 0) return true;
  if (ops.length === 1) return tareaRetirarEvento(e, t, { tipo: 'provincia', id: ops[0] });
  return decidir(e, { tipo: 'provincia', bando: yo, texto: t.de === 'ambos' ? `Elige provincia: cada bloque pierde 1 — quedan ${t.restante}` : `Retira presencia rival — quedan ${t.restante}`, opciones: ops, opcional: false, restantes: t.restante });
}

/** Batalla (las guerras de TS): dado − vecinas que controla el rival; con 4 o más, la provincia es tuya y +2 PV. */
function tareaBatalla(e: Estado, t: Tarea, r: Respuesta | undefined): boolean {
  const yo: Bando = t.yo;
  const rv = RIVAL[yo];
  const ops = PROVINCIAS.filter((p) => e.presencia[p.id][rv] > 0 && cumpleFiltro(e, p, t.filtro, yo)).map((p) => p.id);
  if (ops.length === 0) {
    log(e, 'No hay ninguna provincia donde librar la batalla');
    return true;
  }
  if (!r) return decidir(e, { tipo: 'provincia', bando: yo, texto: 'Elige dónde se libra la batalla (dado − vecinas que controle el rival; éxito con 4 o más)', opciones: ops, opcional: false, restantes: 1 });
  const id = (r as any).id as string;
  const mod = PROV[id].vecinos.filter((v) => controla(e, v, rv)).length;
  const dado = d6(e);
  const res = dado - mod;
  const exito = res >= 4;
  const antes = controlador(e, id);
  log(e, `Batalla en ${PROV[id].corto}: dado ${dado} − ${mod} vecinas del rival = ${res}${exito ? ' — ¡victoria!' : ' — fracaso'}`, 'dado', yo);
  e.exigencia[yo] += 2;
  if (exito) {
    e.presencia[id][yo] += e.presencia[id][rv];
    e.presencia[id][rv] = 0;
    pv(e, yo, 2);
  }
  suceso(e, { s: 'batalla', bando: yo, prov: id, exito });
  registrarControl(e, id, antes);
  return true;
}

/** Decisiones de una provincia con un efecto inmediato: tomar, igualar, escándalo, retirar todo, controlar. */
function tareaProvinciaUnica(e: Estado, t: Tarea, r: Respuesta | undefined): boolean {
  const yo: Bando = t.yo;
  const rv = RIVAL[yo];
  if (t.hechos >= t.n) return true;
  const ops = PROVINCIAS.filter((p) => {
    if (t.hechas.includes(p.id) || !cumpleFiltro(e, p, t.filtro, yo)) return false;
    if (t.provs && !t.provs.includes(p.id)) return false;
    if (t.accion === 'igualar') return e.presencia[p.id][rv] > e.presencia[p.id][yo];
    if (t.accion === 'tomar' || t.accion === 'escandalo' || t.accion === 'retirarTodo') return e.presencia[p.id][rv] > 0;
    return true;
  }).map((p) => p.id);
  if (ops.length === 0) return true;
  if (!r) return decidir(e, { tipo: 'provincia', bando: yo, texto: t.texto, opciones: ops, opcional: false, restantes: t.n - t.hechos });
  const id = (r as any).id as string;
  const antes = controlador(e, id);
  const pr = e.presencia[id];
  switch (t.accion) {
    case 'tomar':
      pr[rv] = 0;
      pr[yo] = Math.max(pr[yo], fidelidadEf(e, id));
      log(e, `${N(yo)} se hace con ${PROV[id].corto}`, undefined, yo);
      break;
    case 'igualar':
      pr[yo] = pr[rv];
      log(e, `${N(yo)} iguala la presencia rival en ${PROV[id].corto}`, undefined, yo);
      break;
    case 'escandalo':
      pr[rv] = 0;
      pr[yo] += t.poner;
      log(e, `${N(rv)} pierde toda su presencia en ${PROV[id].corto}; ${N(yo)} coloca ${t.poner}`, undefined, yo);
      break;
    case 'retirarTodo':
      log(e, `${N(rv)} pierde toda su presencia en ${PROV[id].corto} (${pr[rv]})`, undefined, yo);
      pr[rv] = 0;
      break;
  }
  registrarControl(e, id, antes);
  t.hechas.push(id);
  t.hechos++;
  return t.hechos >= t.n;
}

/** Relevo (De-Stalinization): mueve presencia propia a provincias que el rival no controla. */
function tareaMover(e: Estado, t: Tarea, r: Respuesta | undefined): boolean {
  const yo: Bando = t.yo;
  if (r) {
    const id = (r as any).id as string | null;
    if (t.origen === null) {
      if (id === null) return true;
      e.presencia[id][yo]--;
      t.origen = id;
    } else {
      e.presencia[id as string][yo]++;
      t.puestas[id as string] = (t.puestas[id as string] ?? 0) + 1;
      log(e, `${N(yo)} traslada presencia de ${PROV[t.origen].corto} a ${PROV[id as string].corto}`, undefined, yo);
      t.origen = null;
      t.restantes--;
    }
  }
  if (t.restantes <= 0) return true;
  if (t.origen === null) {
    const ops = PROVINCIAS.filter((p) => e.presencia[p.id][yo] > 0).map((p) => p.id);
    if (ops.length === 0) return true;
    return decidir(e, { tipo: 'provincia', bando: yo, texto: `Relevo: elige de dónde sacas 1 de presencia (${t.restantes} restante${t.restantes > 1 ? 's' : ''}) o termina`, opciones: ops, opcional: true, restantes: t.restantes });
  }
  const destinos = PROVINCIAS.filter((p) => p.id !== t.origen && !controla(e, p.id, RIVAL[yo]) && (t.puestas[p.id] ?? 0) < t.maxPor).map((p) => p.id);
  if (destinos.length === 0) {
    e.presencia[t.origen][yo]++;
    return true;
  }
  return decidir(e, { tipo: 'provincia', bando: yo, texto: 'Relevo: elige adónde llevas esa presencia (que no controle el rival)', opciones: destinos, opcional: false, restantes: t.restantes });
}

/** Aplica un efecto. Devuelve true si ha encolado tareas (hay que esperar a que terminen). */
function aplicarEfecto(e: Estado, ef: Efecto, yo: Bando, carta: number): boolean {
  const rv = RIVAL[yo];
  const sub = (lista: Efecto[], quien: Bando) => {
    encolar(e, { t: 'efectos', lista, i: 0, yo: quien, carta });
    return true;
  };
  switch (ef.e) {
    case 'pv': pv(e, yo, ef.n); return false;
    case 'clima': cambiarClima(e, ef.n, ef.minimo ?? 1); return false;
    case 'colocar':
      encolar(e, { t: 'colocar', yo, n: ef.n, maxPor: ef.maxPor, filtro: ef.filtro, unaSola: ef.unaSola, puestas: {}, restante: ef.n });
      return true;
    case 'retirar':
      encolar(e, { t: 'retirar', yo, n: ef.n, maxPor: ef.maxPor, filtro: ef.filtro, de: ef.de ?? 'rival', unaSola: ef.unaSola, quitadas: {}, restante: ef.n });
      return true;
    case 'retirarTodo':
      for (const id of ef.provs) e.presencia[id] = { P: 0, C: 0 };
      log(e, `Se retira toda la presencia de ${ef.provs.map((id) => PROV[id].corto).join(', ')}`);
      return false;
    case 'como':
      return sub(ef.efectos, ef.bando === 'rival' ? rv : ef.bando);
    case 'aLider':
      return sub(ef.efectos, lider(e));
    case 'aRezagado':
      return sub(ef.efectos, RIVAL[lider(e)]);
    case 'aCadaBloque': {
      const l = lider(e);
      encolar(e, { t: 'efectos', lista: ef.efectos, i: 0, yo: RIVAL[l], carta }, { t: 'efectos', lista: ef.efectos, i: 0, yo: l, carta });
      return true;
    }
    case 'alQueMenosPresencia': {
      const p = presenciaTotal(e, 'P'), c = presenciaTotal(e, 'C');
      const b: Bando = p < c ? 'P' : c < p ? 'C' : yo;
      log(e, `${N(b)} tiene menos presencia en el mapa`, undefined, b);
      return sub(ef.efectos, b);
    }
    case 'alQueControlaMas': {
      const p = ef.provs.filter((id) => controla(e, id, 'P')).length;
      const c = ef.provs.filter((id) => controla(e, id, 'C')).length;
      if (p === c) { log(e, 'Empate en control: sin efecto'); return false; }
      return sub(ef.efectos, p > c ? 'P' : 'C');
    }
    case 'alQueVaDetras':
      return sub(ef.efectos, e.ventaja > 0 ? 'P' : e.ventaja < 0 ? 'C' : yo);
    case 'duelo': {
      const a = d6(e), b = d6(e);
      log(e, `Dados: Progresista ${a} · Conservador ${b}`, 'dado');
      if (a > b) pv(e, 'P', ef.pv);
      else if (b > a) pv(e, 'C', ef.pv);
      return false;
    }
    case 'fugaNacionalista':
      encolar(e, { t: 'fuga', yo, pct: ef.pct });
      return true;
    case 'afinidadNeutral': {
      const a = e.afinidad[ef.partido];
      if (a !== 0) moverAfinidad(e, ef.partido, a > 0 ? 'P' : 'C', 1);
      return false;
    }
    case 'socio': {
      const b: Bando = ef.bloque === 'yo' ? yo : ef.bloque === 'rival' ? rv : ef.bloque;
      cambiarSocio(e, b, ef.n);
      return false;
    }
    case 'podemos':
      cambiarPodemos(e, ef.fuerza ?? 0, ef.humor ?? 0);
      return false;
    case 'morado': {
      const quien = ef.quien === 'rival' ? rv : yo;
      encolar(e, { t: 'morado', yo: quien, n: ef.n, filtro: ef.filtro, hechos: 0 });
      return true;
    }
    case 'moradoAuto': {
      const objetivos: Bando[] = ef.de === 'ambos' ? ['P', 'C'] : ef.de === 'lider' ? [lider(e)] : [RIVAL[lider(e)]];
      for (const b of objetivos) {
        for (let i = 0; i < ef.n; i++) {
          const cands = PROVINCIAS.filter((p) => controla(e, p.id, b) && e.morado[p.id] < 2 && (!ef.zona || p.zona === ef.zona)).sort((x, y) => y.escanos - x.escanos);
          const p = cands[0];
          if (!p) break;
          e.morado[p.id]++;
          log(e, `Podemos planta un marcador morado en ${p.corto}, plaza del ${N(b)}`);
        }
      }
      return false;
    }
    case 'afinidad': moverAfinidad(e, ef.partido, yo, ef.n); return false;
    case 'afinidadElegir':
      encolar(e, { t: 'afinElegir', yo, n: ef.n, veces: ef.veces, hechos: [], sinVetados: !!ef.sinVetados });
      return true;
    case 'carrera':
      for (let i = 0; i < ef.n; i++) avanzarCarrera(e, yo, !(ef.sinPvPrimera && i === 0 && ef.n > 1));
      return false;
    case 'carreraSiDetras':
      if (e.carrera[yo] < e.carrera[rv]) for (let i = 0; i < ef.n; i++) avanzarCarrera(e, yo, i === ef.n - 1);
      else log(e, 'No va por detrás en la Carrera: sin efecto');
      return false;
    case 'exigencia': e.exigencia[yo] += ef.n; return false;
    case 'ops':
      if (ef.tipo === 'presencia') encolar(e, { t: 'colocarOps', bando: yo, pc: ef.pc, filtro: ef.filtro, ignorarAdy: ef.ignorarAdy });
      else if (ef.tipo === 'ofensiva') encolar(e, { t: 'ofensiva', bando: yo, pc: ef.pc, filtro: ef.filtro, ignorarClima: ef.ignorarClima, sinClima: ef.ignorarClima });
      else if (ef.tipo === 'debate') encolar(e, { t: 'debateLocal', bando: yo, restantes: ef.pc });
      else encolar(e, { t: 'opsElegir', bando: yo, carta: -1, pc: ef.pc });
      return true;
    case 'swing':
      for (const p of PROVINCIAS) if (cumpleFiltro(e, p, ef.filtro, yo)) e.modsProv[p.id] = (e.modsProv[p.id] ?? 0) + (yo === 'C' ? ef.pp : -ef.pp);
      return false;
    case 'regional':
      e.modsPartido[ef.partido] = (e.modsPartido[ef.partido] ?? 0) + ef.pct;
      log(e, `${PARTIDOS[ef.partido].siglas} ${ef.pct > 0 ? 'crece' : 'cae'} un ${Math.round(Math.abs(ef.pct) * 100)}%`);
      return false;
    case 'si': {
      const lista = cumpleCond(e, ef.cond, yo) ? ef.entonces : ef.sino ?? [];
      if (!lista.length) return false;
      return sub(lista, yo);
    }
    case 'elegir':
      encolar(e, { t: 'elegir', yo, quien: ef.quien === 'rival' ? rv : yo, opciones: ef.opciones, texto: 'Elige una opción' });
      return true;
    case 'dado': {
      const d = d6(e);
      log(e, `Dado: ${d}`, 'dado');
      const fila = ef.tabla.find((f) => d <= f.hasta);
      if (!fila || !fila.efectos.length) return false;
      return sub(fila.efectos, yo);
    }
    case 'puntuar':
      if (ef.zona) { puntuarZonaYAplicar(e, ef.zona, !!ef.ignorarVeda); return false; }
      encolar(e, { t: 'elegirZona', yo, ignorarVeda: ef.ignorarVeda });
      return true;
    case 'espanaVaciada': {
      if (e.turno === 8) { log(e, 'Veda demoscópica: la Encuesta de la España vaciada no se publica', 'puntuacion'); suceso(e, { s: 'encuesta', zona: 'VAC', neto: 0, veda: true }); return false; }
      const r = puntuarVaciada(e);
      const neto = Math.max(-TOPE_ENCUESTA, Math.min(TOPE_ENCUESTA, r.C - r.P));
      log(e, `Encuesta de la España vaciada: Progresista ${r.P} · Conservador ${r.C}`, 'puntuacion');
      suceso(e, { s: 'encuesta', zona: 'VAC', neto });
      if (neto > 0) pv(e, 'C', neto);
      else if (neto < 0) pv(e, 'P', -neto);
      return false;
    }
    case 'descarteAzar': {
      const opts = e.manos[rv].filter((c) => !esEncuesta(c));
      if (!opts.length) return false;
      const c = opts[Math.floor(aleatorio(e) * opts.length)];
      quitarDeMano(e, rv, c);
      e.descarte.push(c);
      log(e, `${N(rv)} descarta ${nombreCarta(c)}`, undefined, yo);
      return false;
    }
    case 'verMano':
      e.manoVista[yo] = true;
      log(e, `${N(yo)} ve la mano del rival este turno`, undefined, yo);
      return false;
    case 'robar':
      for (let i = 0; i < ef.n; i++) robar(e, yo);
      return false;
    case 'texto': log(e, ef.s); return false;
    case 'pvPorRegionales': {
      const n = (['ERC', 'JUNTS', 'BILDU'] as RegionalId[]).filter((k) => (rv === 'P' ? -e.afinidad[k] : e.afinidad[k]) >= ef.minAfinRival).length;
      pv(e, yo, Math.min(n, ef.max));
      return false;
    }
    case 'cis': {
      if (e.turno === 8) { log(e, 'Veda demoscópica: el Barómetro del CIS no se publica', 'puntuacion'); suceso(e, { s: 'encuesta', zona: 'CIS', neto: 0, veda: true }); return false; }
      const n = puntuarCIS(e);
      log(e, `Barómetro del CIS: balance de provincias clave ${n > 0 ? '+' + n + ' Conservador' : n < 0 ? '+' + -n + ' Progresista' : 'igualado'}`, 'puntuacion');
      suceso(e, { s: 'encuesta', zona: 'CIS', neto: n });
      if (n > 0) pv(e, 'C', n);
      else if (n < 0) pv(e, 'P', -n);
      return false;
    }
    // —— mecánicas de TS ——
    case 'activar':
      if (ef.elegirProv || ef.elegirZona) {
        encolar(e, { t: 'activarElegir', yo, tipo: ef.tipo, hasta: ef.hasta, carta, filtro: ef.elegirProv, elegirZona: !!ef.elegirZona });
        return true;
      }
      activarEfecto(e, { tipo: ef.tipo, dueno: yo, hasta: ef.hasta, carta, zona: ef.zona, zonas: ef.zonas, prov: ef.prov });
      return false;
    case 'cancelarEfecto': {
      const dueno = ef.de === 'yo' ? yo : rv;
      const habia = e.efectos.some((x) => x.tipo === ef.tipo && x.dueno === dueno);
      quitarEfectos(e, (x) => x.tipo === ef.tipo && x.dueno === dueno);
      if (habia) log(e, `Se anula «${NOMBRE_EFECTO[ef.tipo]}» del ${N(dueno)}`);
      return false;
    }
    case 'bandera':
      if (!e.banderas.includes(ef.k)) e.banderas.push(ef.k);
      return false;
    case 'batalla':
      encolar(e, { t: 'batalla', yo, filtro: ef.filtro });
      return true;
    case 'tomar':
      encolar(e, { t: 'provinciaUnica', yo, accion: 'tomar', filtro: ef.filtro, n: 1, hechos: 0, hechas: [], texto: 'Elige la provincia que tomas: retiras la presencia rival y colocas la necesaria para controlarla' });
      return true;
    case 'igualar':
      encolar(e, { t: 'provinciaUnica', yo, accion: 'igualar', provs: ef.provs, n: 1, hechos: 0, hechas: [], texto: 'Elige dónde igualas la presencia del rival' });
      return true;
    case 'retirarTodoN':
      encolar(e, { t: 'provinciaUnica', yo, accion: 'retirarTodo', filtro: ef.filtro, n: ef.n, hechos: 0, hechas: [], texto: 'Elige una provincia: el rival pierde allí toda su presencia' });
      return true;
    case 'escandalo':
      encolar(e, { t: 'provinciaUnica', yo, accion: 'escandalo', filtro: ef.filtro, poner: ef.poner, n: 1, hechos: 0, hechas: [], texto: `Elige una provincia: el rival pierde allí toda su presencia y tú colocas ${ef.poner}` });
      return true;
    case 'controlar': {
      const pr = e.presencia[ef.prov];
      const necesaria = pr[rv] + fidelidadEf(e, ef.prov);
      if (pr[yo] < necesaria) {
        pr[yo] = necesaria;
        log(e, `${N(yo)} toma el control de ${PROV[ef.prov].corto}`, undefined, yo);
      }
      return false;
    }
    case 'mover':
      encolar(e, { t: 'mover', yo, restantes: ef.n, maxPor: ef.maxPor, origen: null, puestas: {} });
      return true;
    case 'comision': {
      const opts = e.manos[rv].filter((c) => !esEncuesta(c));
      if (!opts.length) return false;
      const c = opts[Math.floor(aleatorio(e) * opts.length)];
      quitarDeMano(e, rv, c);
      log(e, `${N(rv)} descarta al azar ${nombreCarta(c)}`, undefined, yo);
      if (CARTAS[c].lado === yo) {
        log(e, `Es un evento del ${N(yo)}: se activa`, 'evento', yo);
        encolar(e, { t: 'evento', carta: c, jugador: yo });
        return true;
      }
      e.descarte.push(c);
      return false;
    }
    case 'bloqueo':
      encolar(e, { t: 'bloqueo', yo, prov: ef.prov, minOps: ef.minOps, motivo: carta >= 0 ? CARTAS[carta].nombre : 'Bloqueo' });
      return true;
    case 'pvMenosClima': {
      const n = ef.base - e.clima;
      if (n > 0) pv(e, yo, n);
      return false;
    }
    case 'pactoNoAgresion': {
      const n = e.clima - 2;
      if (n > 0) pv(e, yo, n);
      cambiarClima(e, 2);
      return false;
    }
    case 'fijarClima':
      encolar(e, { t: 'fijarClima', yo });
      return true;
    case 'olimpiadas':
      encolar(e, { t: 'olimpiadas', yo });
      return true;
    case 'cumbre':
      encolar(e, { t: 'cumbre' });
      return true;
    case 'recuperar':
      encolar(e, { t: 'recuperar', yo, jugar: ef.jugar });
      return true;
    case 'intercambio':
      encolar(e, { t: 'intercambio', yo });
      return true;
    case 'fichaje':
      encolar(e, { t: 'fichaje', yo });
      return true;
    case 'topo':
      encolar(e, { t: 'topo', yo });
      return true;
    case 'redibujar':
      encolar(e, { t: 'redibujar', yo, n: 0 });
      return true;
    case 'juntaElectoral':
      encolar(e, { t: 'junta', yo });
      return true;
    case 'votoUtilAMi':
      if (e.votoUtil.duenio === rv) {
        e.votoUtil = { duenio: yo, disponible: false };
        log(e, `El Voto Útil pasa al ${N(yo)}, boca abajo`, undefined, yo);
      } else pv(e, yo, 1);
      return false;
    case 'pvPorControl': {
      const n = ef.provs.filter((id) => controla(e, id, yo)).length;
      pv(e, yo, Math.min(n, ef.max ?? n));
      return false;
    }
    case 'pvSiMasClaves':
      if (clavesControladas(e, yo) > clavesControladas(e, rv)) pv(e, yo, ef.n);
      else log(e, 'No controla más provincias clave: sin PV');
      return false;
    case 'duplicar':
      encolar(e, { t: 'duplicar', yo, filtro: ef.filtro, n: ef.n });
      return true;
    case 'rondaExtra':
      e.rondaExtra[yo]++;
      log(e, `${N(yo)} gana una ronda de acción extra esta semana`, undefined, yo);
      return false;
    case 'granCoalicion':
      if (e.clima !== 2) { log(e, 'Sin el Clima en 2 no hay gran coalición posible'); return false; }
      encolar(e, { t: 'granCoalicion', yo });
      return true;
    case 'crisisInstitucional':
      if (e.clima > 2) fijarClima(e, 2);
      activarEfecto(e, { tipo: 'crisis', dueno: yo, hasta: 'turno', carta });
      return false;
    case 'castigoCapitales':
      for (const b of ['P', 'C'] as Bando[]) {
        const p = PROVINCIAS.filter((x) => controla(e, x.id, b)).sort((x, y) => y.escanos - x.escanos)[0];
        if (p && e.presencia[p.id][b] > 0) {
          e.presencia[p.id][b]--;
          log(e, `${N(b)} pierde 1 de presencia en ${p.corto}`);
        }
      }
      return false;
  }
}

function debateResolver(e: Estado, tipo: 'cara' | 'cuatro'): boolean {
  e.enJuego = null;
  if (tipo === 'cuatro') {
    cambiarSocio(e, 'P', 1);
    cambiarSocio(e, 'C', 1);
    log(e, 'Vox y Frente Amplio ganan foco en el debate a cuatro');
    log(e, 'Podemos, fuera del debate, lo hace estallar en redes');
    cambiarPodemos(e, 1, 0);
  }
  const tot: Record<Bando, number> = { P: 0, C: 0 };
  for (const b of ['P', 'C'] as Bando[]) {
    const c = e.debate[b];
    const ops = c !== null ? CARTAS[c].ops : 0;
    const mod = (e.carrera[b] > e.carrera[RIVAL[b]] ? 1 : 0) + Math.min(2, zonasDominadas(e, b));
    const dado = d6(e);
    tot[b] = ops + dado + mod;
    log(e, `${N(b)}: ${c !== null ? nombreCarta(c) : 'sin carta'} (${ops} PC) + dado ${dado} + preparación ${mod} = ${tot[b]}`, 'dado', b);
    if (c !== null) e.descarte.push(c);
  }
  e.debate = { P: null, C: null };
  const dif = tot.C - tot.P;
  if (dif === 0) {
    log(e, 'El debate acaba en tablas', 'evento');
    suceso(e, { s: 'debateTV', tipo, ganador: null, dif: 0 });
    return true;
  }
  const g: Bando = dif > 0 ? 'C' : 'P';
  log(e, `${g === 'C' ? 'Feijóo' : 'Sánchez'}${tipo === 'cuatro' ? ' y su bloque' : ''} gana el debate`, 'evento', g);
  suceso(e, { s: 'debateTV', tipo, ganador: g, dif: Math.abs(dif) });
  pv(e, g, Math.min(tipo === 'cara' ? 3 : 2, Math.abs(dif)));
  if (tipo === 'cara' && Math.abs(dif) >= 4) cambiarClima(e, -1, 2);
  return true;
}

function finTurno(e: Estado): boolean {
  e.enJuego = null;
  for (const b of ['P', 'C'] as Bando[]) {
    const falta = Math.max(0, e.clima - e.exigencia[b]);
    if (falta > 0) {
      log(e, `Exigencia de las bases: ${N(b)} solo ha hecho ${e.exigencia[b]} de ${e.clima} PC de ofensiva`, 'aviso', b);
      suceso(e, { s: 'exigencia', bando: b, falta });
      pv(e, RIVAL[b], falta);
    }
  }
  if (e.ganador) return true;
  // Los efectos de una semana caducan; la crisis también
  quitarEfectos(e, (x) => x.hasta === 'turno');
  e.votoUtil.disponible = true;
  if (!e.silencio) cerrarHistoria(e);
  const tareas: Tarea[] = [];
  for (const b of ['P', 'C'] as Bando[]) if (tieneVentajaCarrera(e, b, 'descarte')) tareas.push({ t: 'descarteOpcional', bando: b });
  if (e.turno === 3) tareas.push({ t: 'cierreListas' });
  tareas.push(e.turno >= 8 ? { t: 'nocheElectoral' } : { t: 'inicioTurno' });
  encolar(e, ...tareas);
  return true;
}

/** Guarda la foto de la semana para el plató y vacía el diario. */
function cerrarHistoria(e: Estado, inicial = false) {
  if (e.turno === 0 && !inicial) return;
  const res = proyectar(PROVINCIAS, e);
  const controles: Record<string, Bando | null> = {};
  for (const p of PROVINCIAS) controles[p.id] = controlador(e, p.id);
  const foto: FotoTurno = {
    turno: e.turno,
    ventaja: e.ventaja,
    clima: e.clima,
    escanos: res.escanos,
    bloque: res.bloque,
    apoyos: res.apoyos,
    ganadorProyectado: res.investiduras.find((i) => i.exito)?.candidato ?? null,
    controles,
    morado: { ...e.morado },
    podemos: { ...e.podemos },
    socio: { ...e.socio },
    carrera: { ...e.carrera },
    afinidad: { ...e.afinidad },
    sucesos: e.diario,
  };
  const ultima = e.historia[e.historia.length - 1];
  if (ultima && ultima.turno === e.turno) e.historia[e.historia.length - 1] = { ...foto, sucesos: [...ultima.sucesos, ...foto.sucesos] };
  else e.historia = [...e.historia, foto];
  e.diario = [];
}

/** Ejecuta unas tareas aisladas sobre el estado (para que la IA estime el valor de un evento). */
export function ejecutarAislado(e: Estado, tareas: Tarea[]) {
  e.pila = [];
  e.pendiente = null;
  encolar(e, ...tareas);
  avanzar(e);
}
