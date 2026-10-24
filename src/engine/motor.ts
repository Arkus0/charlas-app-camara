// Motor de «176 · La Batalla del 29N».
// La partida es una pila de tareas: cada tarea avanza sola o se detiene en una Decision
// que responde un jugador (persona o IA). Todo el estado es serializable.
import { CARTAS, MAZO_IDS } from '../data/cartas';
import { AFINIDAD_INICIAL, CESIONES_CARAS, CORTO_BANDO, PARTIDOS, TERRITORIO } from '../data/partidos';
import { PRESENCIA_INICIAL, PROV, PROVINCIAS, ZONAS } from '../data/provincias';
import { controlDe, proyectar, REGIONALES } from './electoral';
import { aleatorio, barajar, d6 } from './rng';
import {
  CARRERA, controla, costePresencia, cumpleCond, cumpleFiltro, elegiblesPresencia, esEncuesta, eventoAjeno, eventoJugable,
  ladoEvento, objetivosAtaque, partidosNegociables, presenciaTotal, puntuarCIS, puntuarZona, rondasDe,
  tamanoMano, tieneVentajaCarrera, usosCarta, ZONA_IDS, zonasDominadas, FECHAS,
} from './reglas';
import type { Bando, Decision, Efecto, EntradaLog, Escenario, Estado, Negociable, Operacion, RegionalId, Respuesta, Tarea, Uso, ZonaId } from './tipos';
import { RIVAL } from './tipos';

const N = (b: Bando) => CORTO_BANDO[b];
const INCOMODOS: RegionalId[] = ['ERC', 'JUNTS', 'BILDU'];
export const TOPE_ENCUESTA = 5;
const nombreCarta = (id: number) => `«${CARTAS[id].nombre}»`;

// ————————————————————————————————————— utilidades
export function log(e: Estado, texto: string, tipo?: EntradaLog['tipo'], bando: Bando | null = null) {
  if (e.silencio) return;
  e.log.push({ turno: e.turno, ronda: e.ronda, bando, texto, tipo });
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
  e.ventaja = Math.max(-20, Math.min(20, e.ventaja + (b === 'C' ? n : -n)));
  log(e, `${N(n > 0 ? b : RIVAL[b])} gana ${Math.abs(n)} PV (Ventaja ${fmtVentaja(e.ventaja)})`, 'pv', n > 0 ? b : RIVAL[b]);
  if (Math.abs(e.ventaja) >= 20) {
    const g: Bando = e.ventaja > 0 ? 'C' : 'P';
    terminar(e, g, 'Vuelco irreversible: la Ventaja demoscópica llega a 20');
  }
}

export function fmtVentaja(v: number): string {
  return v === 0 ? '0' : v > 0 ? `+${v} Conservador` : `+${-v} Progresista`;
}

function cambiarClima(e: Estado, n: number, minimo = 1) {
  if (!n || e.ganador) return;
  const antes = e.clima;
  e.clima = Math.max(minimo, Math.min(5, e.clima + n));
  if (e.clima === antes) return;
  log(e, `Clima de campaña: ${antes} → ${e.clima} (${NOMBRES_CLIMA[e.clima]})`, 'clima');
  if (e.clima <= 1) {
    const culpable = e.enJuego ?? 'P';
    terminar(e, RIVAL[culpable], `Ruptura: ${N(culpable)} lleva la campaña a la guerra sucia y los votantes lo castigan`);
  }
}

export const NOMBRES_CLIMA: Record<number, string> = { 5: 'Sereno', 4: 'Tenso', 3: 'Bronco', 2: 'Guerra sucia', 1: 'Ruptura' };

function terminar(e: Estado, b: Bando | null, motivo: string) {
  if (e.ganador) return;
  e.ganador = { bando: b, motivo };
  e.fase = 'fin';
  e.pendiente = null;
  log(e, b ? `¡Gana el ${N(b) === 'Progresista' ? 'Bloque Progresista' : 'Bloque Conservador'}! ${motivo}` : `Empate. ${motivo}`, 'fase', b);
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

export const HUMOR_PODEMOS: Record<number, string> = {
  [-3]: 'en guerra con el PSOE', [-2]: 'ruptura', [-1]: 'enfadado', 0: 'exigente', 1: 'dispuesto', 2: 'socio', 3: 'socio firme',
};

/** Mueve los marcadores de Podemos (fuerza y humor, de −3 a +3). */
function cambiarPodemos(e: Estado, fuerza: number, humor: number) {
  const antes = { ...e.podemos };
  e.podemos.fuerza = Math.max(-3, Math.min(3, e.podemos.fuerza + fuerza));
  e.podemos.humor = Math.max(-3, Math.min(3, e.podemos.humor + humor));
  if (e.podemos.fuerza !== antes.fuerza) log(e, `Fuerza de Podemos: ${fmtSigno(antes.fuerza)} → ${fmtSigno(e.podemos.fuerza)}`);
  if (e.podemos.humor !== antes.humor) log(e, `Humor de Podemos: ${HUMOR_PODEMOS[antes.humor]} → ${HUMOR_PODEMOS[e.podemos.humor]} (${e.podemos.humor >= 1 ? 'votaría sí a Sánchez' : e.podemos.humor === 0 ? 'se abstendría con Sánchez' : 'votaría no a Sánchez'})`);
}

export function fmtAfin(a: number) {
  return a === 0 ? '0' : a < 0 ? `P${-a}` : `C${a}`;
}

function avanzarCarrera(e: Estado, b: Bando) {
  if (e.carrera[b] >= CARRERA.length) return;
  e.carrera[b]++;
  const casilla = CARRERA[e.carrera[b] - 1];
  const primero = e.carrera[RIVAL[b]] < e.carrera[b];
  log(e, `${N(b)} alcanza «${casilla.nombre}» en la Carrera Programática (casilla ${e.carrera[b]})`, undefined, b);
  pv(e, b, primero ? casilla.pv[0] : casilla.pv[1]);
}

function puntuarZonaYAplicar(e: Estado, z: ZonaId, ignorarVeda: boolean) {
  if (e.turno === 8 && !ignorarVeda) {
    log(e, `Veda demoscópica: la Encuesta de ${ZONAS[z].nombre} no se publica`, 'puntuacion');
    return;
  }
  const r = puntuarZona(e, z);
  const niveles = ['nada', 'presencia', 'dominio', 'control'];
  log(e, `Encuesta de ${ZONAS[z].nombre}: Progresista ${niveles[r.nivel.P]} (${r.pv.P} PV) · Conservador ${niveles[r.nivel.C]} (${r.pv.C} PV)`, 'puntuacion');
  const neto = Math.max(-TOPE_ENCUESTA, Math.min(TOPE_ENCUESTA, r.neto));
  if (neto > 0) pv(e, 'C', neto);
  else if (neto < 0) pv(e, 'P', -neto);
}

// ————————————————————————————————————— creación
/** Desplazamiento de partida (pp hacia el Conservador) de cada escenario. */
// Calibrado con partidas IA contra IA (nivel normal): el Progresista gana ~50% en «abierto»
export const SESGO_ESCENARIO: Record<Escenario, number> = { realista: 0, abierto: -7.75 };

export function crearPartida(semilla = Date.now(), escenario: Escenario = 'abierto'): Estado {
  const presencia: Estado['presencia'] = {};
  for (const p of PROVINCIAS) presencia[p.id] = { P: PRESENCIA_INICIAL[p.id]?.P ?? 0, C: PRESENCIA_INICIAL[p.id]?.C ?? 0 };
  const e: Estado = {
    version: 2,
    rng: semilla >>> 0 || 1,
    turno: 0,
    ronda: 0,
    fase: 'preparacion',
    enJuego: null,
    presencia,
    presencia0: {},
    control0: {},
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
    mazo: [],
    descarte: [],
    retiradas: [],
    manos: { P: [], C: [] },
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
  };
  fotoSalida(e);
  e.mazo = barajar(e, [...MAZO_IDS[1]]);
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
    e.control0[p.id] = controlDe(p, e.presencia[p.id]);
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
        if (dc.proposito === 'accion' && (!r.uso || !dc.usos[r.carta].includes(r.uso))) throw new Error('Uso no válido');
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
    exigencia: { ...e.exigencia },
    carrera: { ...e.carrera },
    carreraTurno: { ...e.carreraTurno },
    socio: { ...e.socio },
    afinidad: { ...e.afinidad },
    negociado: [...e.negociado],
    modsProv: { ...e.modsProv },
    modsPartido: { ...e.modsPartido },
    mazo: [...e.mazo],
    descarte: [...e.descarte],
    retiradas: [...e.retiradas],
    manos: { P: [...e.manos.P], C: [...e.manos.C] },
    votoUtil: { ...e.votoUtil },
    portada: { ...e.portada },
    rondasHechas: { ...e.rondasHechas },
    pila: e.pila.map(clonarTarea),
    pendiente: e.pendiente ? JSON.parse(JSON.stringify(e.pendiente)) : null,
    log: e.silencio ? e.log : [...e.log],
    manoVista: { ...e.manoVista },
    debate: { ...e.debate },
    ganador: e.ganador ? { ...e.ganador } : null,
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
      return true;

    case 'inicioTurno':
      return inicioTurno(e);

    case 'portada':
      return tareaPortada(e, t, r);

    case 'portadaResolver':
      return portadaResolver(e);

    case 'ronda':
      return tareaRonda(e, t, r);

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
      e.descarte.push(t.carta);
      return true;
    }

    case 'evento':
      return tareaEvento(e, t);

    case 'finEvento': {
      const c = CARTAS[t.carta];
      if (t.carta === 0) return true;
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
      const opciones = REGIONALES.filter((k) => !t.hechos.includes(k) && (yo === 'P' ? e.afinidad[k] > -3 : e.afinidad[k] < 3));
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
      const res = proyectar(PROVINCIAS, e);
      terminar(e, res.ganador, res.motivo);
      return true;
    }
  }
  throw new Error('Tarea desconocida: ' + t.t);
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
  e.portada = { P: null, C: null };
  e.manoVista = { P: false, C: false };
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
  tareas.push({ t: 'portadaResolver' });
  if (e.turno === 7) tareas.push({ t: 'debateTV', tipo: 'cara' });
  const maxR = Math.max(rondasDe(e, 'P'), rondasDe(e, 'C'));
  for (let r = 1; r <= maxR; r++) {
    tareas.push({ t: 'ronda', bando: 'P', r }, { t: 'ronda', bando: 'C', r });
    if (e.turno === 8 && r === 3) tareas.push({ t: 'debateTV', tipo: 'cuatro' });
  }
  tareas.push({ t: 'finTurno' });
  encolar(e, ...tareas);
  return true;
}

function tareaPortada(e: Estado, t: Tarea, r: Respuesta | undefined): boolean {
  const b: Bando = t.bando;
  if (e.manos[b].length === 0) return true;
  if (!r) return decidir(e, { tipo: 'carta', bando: b, texto: 'Elige tu Portada: el evento de esta carta abre la semana', proposito: 'portada', opciones: [...e.manos[b]], usos: {}, opcional: false });
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
  const orden: Bando[] = [];
  if (cp !== null && cc !== null) {
    orden.push(CARTAS[cc].ops > CARTAS[cp].ops ? 'C' : 'P');
    orden.push(RIVAL[orden[0]]);
  } else if (cp !== null) orden.push('P');
  else if (cc !== null) orden.push('C');
  encolar(e, ...orden.map((b) => ({ t: 'evento', carta: e.portada[b] as number, jugador: b, portada: true })));
  e.fase = 'acciones';
  return true;
}

function tareaRonda(e: Estado, t: Tarea, r: Respuesta | undefined): boolean {
  const b: Bando = t.bando;
  if (t.r > rondasDe(e, b)) return true;
  e.ronda = t.r;
  e.enJuego = b;
  const opciones = [...e.manos[b]];
  if (e.votoUtil.duenio === b && e.votoUtil.disponible) opciones.push(0);
  if (opciones.length === 0) {
    if (!r) log(e, `${N(b)} no tiene cartas y pasa`, undefined, b);
    return true;
  }
  const encuestas = e.manos[b].filter(esEncuesta);
  const quedan = rondasDe(e, b) - t.r + 1;
  const disponibles = encuestas.length >= quedan && encuestas.length > 0 ? encuestas : opciones;
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
  e.ultimaJugada = { bando: b, carta, uso };
  const c = CARTAS[carta];
  if (uso === 'evento') {
    log(e, `${N(b)} juega ${nombreCarta(carta)} como evento`, 'evento', b);
    encolar(e, { t: 'evento', carta, jugador: b });
  } else if (uso === 'carrera') {
    encolar(e, { t: 'carrera', bando: b, carta });
  } else {
    const pc = c.ops;
    log(e, `${N(b)} juega ${nombreCarta(carta)} por ${pc} PC`, 'evento', b);
    if (carta === 0) {
      encolar(e, { t: 'opsElegir', bando: b, carta, pc, votoUtil: true });
      log(e, 'El Voto Útil pasa boca abajo al rival', undefined, b);
    } else if (eventoAjeno(carta, b) && eventoJugable(e, carta, b)) {
      encolar(e, { t: 'ordenEvento', bando: b, carta, pc });
    } else {
      encolar(e, { t: 'opsElegir', bando: b, carta, pc }, { t: 'descartar', carta });
    }
  }
  return true;
}

function tareaOpsElegir(e: Estado, t: Tarea, r: Respuesta | undefined): boolean {
  const b: Bando = t.bando;
  const pc: number = t.pc;
  if (e.ganador) return true;
  const opciones: Operacion[] = [];
  const eleg = elegiblesPresencia(e, b);
  if (eleg.some((id) => costePresencia(e, id, b) <= pc)) opciones.push('presencia');
  if (objetivosAtaque(e, b).length) opciones.push('ofensiva', 'debate');
  if (pc >= 2 && partidosNegociables(e, b).length) opciones.push('negociacion');
  if (opciones.length === 0) {
    log(e, `${N(b)} no puede usar sus PC`, undefined, b);
    return true;
  }
  if (!r) return decidir(e, { tipo: 'operacion', bando: b, texto: `¿Cómo usas ${pc} PC${t.votoUtil ? ' (+1 en provincias de ≤5 escaños)' : ''}?`, carta: t.carta, pc, opciones });
  const op = (r as any).op as Operacion;
  if (op === 'presencia') encolar(e, { t: 'colocarOps', bando: b, pc, votoUtil: !!t.votoUtil });
  else if (op === 'ofensiva') encolar(e, { t: 'ofensiva', bando: b, pc, votoUtil: !!t.votoUtil });
  else if (op === 'debate') encolar(e, { t: 'debateLocal', bando: b, restantes: pc });
  else encolar(e, { t: 'negociacion', bando: b, pasos: Math.floor(pc / 2) });
  return true;
}

function tareaColocarOps(e: Estado, t: Tarea, r: Respuesta | undefined): boolean {
  const b: Bando = t.bando;
  if (t.restante === undefined) {
    if (t.votoUtil && t.modo === undefined) {
      if (!r) return decidir(e, { tipo: 'opcion', bando: b, texto: 'El Voto Útil: ¿cómo colocas la presencia?', opciones: ['4 PC en cualquier provincia', '5 PC solo en circunscripciones de 5 escaños o menos'] });
      t.modo = (r as any).i;
      r = undefined;
    }
    t.restante = t.pc + (t.modo === 1 ? 1 : 0);
    let eleg = t.ignorarAdy ? PROVINCIAS.map((p) => p.id) : elegiblesPresencia(e, b);
    if (t.filtro) eleg = eleg.filter((id) => cumpleFiltro(e, PROV[id], t.filtro, b));
    if (t.modo === 1) eleg = eleg.filter((id) => PROV[id].escanos <= 5);
    t.elegibles = eleg;
    t.puestas = 0;
  }
  if (r) {
    const id = (r as any).id as string | null;
    if (id === null) return true;
    const coste = costePresencia(e, id, b);
    e.presencia[id][b]++;
    t.restante -= coste;
    t.puestas++;
    log(e, `${N(b)} coloca presencia en ${PROV[id].corto}${coste > 1 ? ' (coste 2)' : ''}`, undefined, b);
  }
  if (e.ganador) return true;
  const ops = (t.elegibles as string[]).filter((id) => costePresencia(e, id, b) <= t.restante);
  if (t.restante <= 0 || ops.length === 0) return true;
  return decidir(e, { tipo: 'provincia', bando: b, texto: `${t.texto ?? 'Coloca presencia'} — quedan ${t.restante} PC`, opciones: ops, opcional: !t.inicial && t.puestas > 0, restantes: t.restante });
}

function tareaOfensiva(e: Estado, t: Tarea, r: Respuesta | undefined): boolean {
  const b: Bando = t.bando;
  const objetivos = objetivosAtaque(e, b, t.filtro);
  if (objetivos.length === 0) return true;
  if (!r) return decidir(e, { tipo: 'provincia', bando: b, texto: `Ofensiva con ${t.pc} PC: elige una provincia con presencia rival (tirada + PC − 2×Fidelidad)`, opciones: objetivos, opcional: false, restantes: t.pc });
  const id = (r as any).id as string;
  const p = PROV[id];
  const pc = t.pc + (t.votoUtil && p.escanos <= 5 ? 1 : 0);
  const dado = d6(e);
  const res = dado + pc - 2 * p.fidelidad;
  log(e, `${N(b)} lanza una ofensiva en ${p.corto}: dado ${dado} + ${pc} PC − ${2 * p.fidelidad} = ${res}`, 'dado', b);
  if (res > 0) {
    const rv = RIVAL[b];
    const quita = Math.min(res, e.presencia[id][rv]);
    e.presencia[id][rv] -= quita;
    e.presencia[id][b] += res - quita;
    log(e, `Éxito: −${quita} presencia ${N(rv).toLowerCase()}${res - quita > 0 ? `, +${res - quita} propia` : ''}`, undefined, b);
  } else log(e, 'La ofensiva no tiene efecto', undefined, b);
  e.exigencia[b] += pc;
  if (p.clave) cambiarClima(e, -1);
  return true;
}

function tiradaDebate(e: Estado, id: string, b: Bando): number {
  const p = PROV[id];
  let m = 0;
  for (const v of p.vecinos) if (controla(e, v, b)) m++;
  if (e.presencia[id][b] > e.presencia[id][RIVAL[b]]) m++;
  if (p.feudo === b) m++;
  return m;
}

function tareaDebateLocal(e: Estado, t: Tarea, r: Respuesta | undefined): boolean {
  const b: Bando = t.bando;
  if (e.ganador || t.restantes <= 0) return true;
  const objetivos = objetivosAtaque(e, b);
  if (objetivos.length === 0) return true;
  if (!r) return decidir(e, { tipo: 'provincia', bando: b, texto: `Debate local (${t.restantes} restante${t.restantes > 1 ? 's' : ''}): elige una provincia con presencia rival`, opciones: objetivos, opcional: true, restantes: t.restantes });
  const id = (r as any).id as string | null;
  if (id === null) return true;
  const rv = RIVAL[b];
  const mb = tiradaDebate(e, id, b);
  const mr = tiradaDebate(e, id, rv);
  const db = d6(e) + mb;
  const dr = d6(e) + mr;
  log(e, `Debate local en ${PROV[id].corto}: ${N(b)} ${db} (mod +${mb}) contra ${N(rv)} ${dr} (mod +${mr})`, 'dado', b);
  if (db > dr) {
    const q = Math.min(db - dr, e.presencia[id][rv]);
    e.presencia[id][rv] -= q;
    if (q) log(e, `${N(rv)} pierde ${q} de presencia`, undefined, b);
  } else if (dr > db) {
    const q = Math.min(dr - db, e.presencia[id][b]);
    e.presencia[id][b] -= q;
    if (q) log(e, `${N(b)} pierde ${q} de presencia`, undefined, rv);
  } else log(e, 'Empate: nadie se mueve', undefined, b);
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
  e.negociado.push(k);
  if (k === 'PODEMOS') {
    cambiarPodemos(e, 0, 1);
    log(e, 'Las concesiones a Podemos tienen coste', undefined, 'C');
    pv(e, 'C', 1);
  } else {
    moverAfinidad(e, k, b, 1);
  }
  if (b === 'P' && k !== 'PODEMOS' && CESIONES_CARAS.includes(k)) {
    log(e, 'Las cesiones tienen coste fuera de su territorio', undefined, 'C');
    pv(e, 'C', 1);
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
  encolar(e, { t: 'efectos', lista: c.efectos, i: 0, yo }, { t: 'finEvento', carta: t.carta });
  return true;
}

function tareaEfectos(e: Estado, t: Tarea): boolean {
  while (t.i < t.lista.length) {
    if (e.ganador) return true;
    const ef = t.lista[t.i++] as Efecto;
    if (aplicarEfecto(e, ef, t.yo)) return false;
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
    e.presencia[id][yo]++;
    t.puestas[id] = (t.puestas[id] ?? 0) + 1;
    t.restante--;
    log(e, `${N(yo)} coloca presencia en ${PROV[id].corto}`, undefined, yo);
  }
  if (t.restante <= 0) return true;
  const ops = opcionesColocarEvento(e, t);
  if (ops.length === 0) return true;
  return decidir(e, { tipo: 'provincia', bando: yo, texto: `Coloca presencia — quedan ${t.restante}`, opciones: ops, opcional: false, restantes: t.restante });
}

function tareaRetirarEvento(e: Estado, t: Tarea, r: Respuesta | undefined): boolean {
  const yo: Bando = t.yo;
  const rv = RIVAL[yo];
  if (r) {
    const id = (r as any).id as string;
    if (t.de === 'ambos') {
      if (e.presencia[id].P > 0) e.presencia[id].P--;
      if (e.presencia[id].C > 0) e.presencia[id].C--;
      log(e, `Ambos bloques pierden presencia en ${PROV[id].corto}`, undefined, yo);
    } else {
      e.presencia[id][rv]--;
      log(e, `${N(rv)} pierde presencia en ${PROV[id].corto}`, undefined, yo);
    }
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
  return decidir(e, { tipo: 'provincia', bando: yo, texto: t.de === 'ambos' ? `Elige provincia: cada bloque pierde 1 — quedan ${t.restante}` : `Retira presencia rival — quedan ${t.restante}`, opciones: ops, opcional: false, restantes: t.restante });
}

/** Aplica un efecto. Devuelve true si ha encolado tareas (hay que esperar a que terminen). */
function aplicarEfecto(e: Estado, ef: Efecto, yo: Bando): boolean {
  const rv = RIVAL[yo];
  switch (ef.e) {
    case 'pv': pv(e, yo, ef.n); return false;
    case 'clima': cambiarClima(e, ef.n); return false;
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
      encolar(e, { t: 'efectos', lista: ef.efectos, i: 0, yo: ef.bando === 'rival' ? rv : ef.bando });
      return true;
    case 'alQueMenosPresencia': {
      const p = presenciaTotal(e, 'P'), c = presenciaTotal(e, 'C');
      const b: Bando = p < c ? 'P' : c < p ? 'C' : yo;
      log(e, `${N(b)} tiene menos presencia en el mapa`, undefined, b);
      encolar(e, { t: 'efectos', lista: ef.efectos, i: 0, yo: b });
      return true;
    }
    case 'alQueControlaMas': {
      const p = ef.provs.filter((id) => controla(e, id, 'P')).length;
      const c = ef.provs.filter((id) => controla(e, id, 'C')).length;
      if (p === c) { log(e, 'Empate en control: sin efecto'); return false; }
      const b: Bando = p > c ? 'P' : 'C';
      encolar(e, { t: 'efectos', lista: ef.efectos, i: 0, yo: b });
      return true;
    }
    case 'alQueVaDetras': {
      const b: Bando = e.ventaja > 0 ? 'P' : e.ventaja < 0 ? 'C' : yo;
      encolar(e, { t: 'efectos', lista: ef.efectos, i: 0, yo: b });
      return true;
    }
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
      const antes = e.socio[b];
      e.socio[b] = Math.max(-3, Math.min(3, antes + ef.n));
      if (e.socio[b] !== antes) log(e, `${b === 'C' ? 'Medidor de Vox' : 'Medidor de Frente Amplio'}: ${fmtSigno(antes)} → ${fmtSigno(e.socio[b])}`, undefined, b);
      return false;
    }
    case 'podemos':
      cambiarPodemos(e, ef.fuerza ?? 0, ef.humor ?? 0);
      return false;
    case 'afinidad': moverAfinidad(e, ef.partido, yo, ef.n); return false;
    case 'afinidadElegir':
      encolar(e, { t: 'afinElegir', yo, n: ef.n, veces: ef.veces, hechos: [] });
      return true;
    case 'carrera':
      for (let i = 0; i < ef.n; i++) avanzarCarrera(e, yo);
      return false;
    case 'exigencia': e.exigencia[yo] += ef.n; return false;
    case 'ops':
      if (ef.tipo === 'presencia') encolar(e, { t: 'colocarOps', bando: yo, pc: ef.pc, filtro: ef.filtro, ignorarAdy: ef.ignorarAdy });
      else if (ef.tipo === 'ofensiva') encolar(e, { t: 'ofensiva', bando: yo, pc: ef.pc, filtro: ef.filtro });
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
      const ok = cumpleCond(e, ef.cond, yo);
      const lista = ok ? ef.entonces : ef.sino ?? [];
      if (!lista.length) return false;
      encolar(e, { t: 'efectos', lista, i: 0, yo });
      return true;
    }
    case 'elegir': {
      const quien = ef.quien === 'rival' ? rv : yo;
      encolar(e, { t: 'elegir', yo, quien, opciones: ef.opciones, texto: 'Elige una opción' });
      return true;
    }
    case 'dado': {
      const d = d6(e);
      log(e, `Dado: ${d}`, 'dado');
      const fila = ef.tabla.find((f) => d <= f.hasta);
      if (!fila || !fila.efectos.length) return false;
      encolar(e, { t: 'efectos', lista: fila.efectos, i: 0, yo });
      return true;
    }
    case 'puntuar':
      if (ef.zona) { puntuarZonaYAplicar(e, ef.zona, !!ef.ignorarVeda); return false; }
      encolar(e, { t: 'elegirZona', yo, ignorarVeda: ef.ignorarVeda });
      return true;
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
      const n = INCOMODOS.filter((k) => (rv === 'P' ? -e.afinidad[k] : e.afinidad[k]) >= ef.minAfinRival).length;
      pv(e, yo, Math.min(n, ef.max));
      return false;
    }
    case 'cis': {
      if (e.turno === 8) { log(e, 'Veda demoscópica: el Barómetro del CIS no se publica', 'puntuacion'); return false; }
      const n = puntuarCIS(e);
      log(e, `Barómetro del CIS: balance de provincias clave ${n > 0 ? '+' + n + ' Conservador' : n < 0 ? '+' + -n + ' Progresista' : 'igualado'}`, 'puntuacion');
      if (n > 0) pv(e, 'C', n);
      else if (n < 0) pv(e, 'P', -n);
      return false;
    }
  }
}

function fmtSigno(n: number) {
  return n > 0 ? `+${n}` : `${n}`;
}

function debateResolver(e: Estado, tipo: 'cara' | 'cuatro'): boolean {
  if (tipo === 'cuatro') {
    e.socio.P = Math.min(3, e.socio.P + 1);
    e.socio.C = Math.min(3, e.socio.C + 1);
    log(e, 'Vox y Frente Amplio ganan foco: ambos medidores de socios suben 1');
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
    return true;
  }
  const g: Bando = dif > 0 ? 'C' : 'P';
  log(e, `${g === 'C' ? 'Feijóo' : 'Sánchez'}${tipo === 'cuatro' ? ' y su bloque' : ''} gana el debate`, 'evento', g);
  e.enJuego = null;
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
      pv(e, RIVAL[b], falta);
    }
  }
  if (e.ganador) return true;
  e.votoUtil.disponible = true;
  const tareas: Tarea[] = [];
  for (const b of ['P', 'C'] as Bando[]) if (tieneVentajaCarrera(e, b, 'descarte')) tareas.push({ t: 'descarteOpcional', bando: b });
  if (e.turno === 3) tareas.push({ t: 'cierreListas' });
  tareas.push(e.turno >= 8 ? { t: 'nocheElectoral' } : { t: 'inicioTurno' });
  encolar(e, ...tareas);
  return true;
}

/** Ejecuta unas tareas aisladas sobre el estado (para que la IA estime el valor de un evento). */
export function ejecutarAislado(e: Estado, tareas: Tarea[]) {
  e.pila = [];
  e.pendiente = null;
  encolar(e, ...tareas);
  avanzar(e);
}
