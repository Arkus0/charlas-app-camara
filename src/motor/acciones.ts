// Las acciones: qué puede hacer cada bloque en su turno (las opciones de la decisión) y cómo se resuelve.
// Una acción es una sola respuesta: carta → modo → destino (y, si hace falta, el reparto de la presencia).
import { CARTAS } from '../data/mazos';
import { PARTIDOS } from '../data/partidos';
import { PROV, PROVINCIAS, ZONAS } from '../data/provincias';
import { RIVAL, type Bando, type Negociable, type RegionalId, type ZonaId } from './base';
import { REGIONALES } from './electoral';
import { NOMBRE_TEMA, TEMAS, DUENO_TEMA } from './agenda';
import { NOMBRE_RAMA, puedeSubir, PV_RAMA_COMPLETA, RAMAS, tiene } from './maquinaria';
import { soltarCarta } from './baraja';
import { calentar, cambiarClima, cambiarPodemos, cambiarPresencia, citar, log, moverAfinidad, N, pv, subirMaquinaria, suceso } from './cambios';
export { citar };
import { encolar } from './nucleo';
import { aleatorio } from './rng';
import { candidatas, tareaEfectos, validarReparto, provinciasDestino } from './efectos';
import {
  baseAtaque, CESIONES_CARAS, controla, cumpleCond, cumpleFiltro, DADO_ATAQUE, MAX_POR_PROVINCIA, objetivosAtaque,
  partidosNegociables, pcCarta, tieneEfecto, ZONA_IDS,
} from './reglas';
import { repartoSugerido } from './valor';
import type { Carta, Estado, IdCarta, Modo, OpcionAccion, Rama, Respuesta, Tema } from './tipos';

export const SIN_DESTINO = '-';

/** PC de la acción básica (sin carta) y de la pegada de carteles. */
export function pcBasica(e: Estado, b: Bando): number {
  return tiene(e, b, 'calle', 2) ? 2 : 1;
}
export const PC_PEGADA = 2;

/** El efecto de la carta que reparte presencia en el destino (como mucho uno por carta). */
export function efectoReparto(c: Carta) {
  const busca = (lista: Carta['efectos']): Extract<Carta['efectos'][number], { e: 'colocar' | 'retirar' }> | null => {
    for (const ef of lista) {
      if ((ef.e === 'colocar' || ef.e === 'retirar') && ef.reparto) return ef;
      if (ef.e === 'si') {
        const x = busca(ef.entonces) ?? busca(ef.sino ?? []);
        if (x) return x;
      }
    }
    return null;
  };
  return busca(c.efectos);
}

/** Destinos posibles del evento de una carta (o null si ahora no se puede jugar como evento). */
export function destinosEvento(e: Estado, b: Bando, id: number): string[] | null {
  const c = CARTAS[id];
  if (c.requisito && !cumpleCond(e, c.requisito, b)) return null;
  const d = c.destino;
  if (!d) return [SIN_DESTINO];
  let lista: string[] = [];
  switch (d.d) {
    case 'zona': {
      const rep = efectoReparto(c);
      lista = ZONA_IDS.filter((z) => {
        const provs = PROVINCIAS.filter((p) => p.zona === z && cumpleFiltro(e, p, d.filtro, b));
        if (!provs.length) return false;
        if (!rep) return true;
        return candidatas(e, rep, { yo: b, carta: id, destino: z }).length > 0;
      });
      break;
    }
    case 'provincia':
      lista = PROVINCIAS.filter((p) => cumpleFiltro(e, p, d.filtro, b)).map((p) => p.id);
      break;
    case 'partido':
      lista = d.partidos ?? REGIONALES;
      break;
    case 'tema':
      lista = TEMAS.filter((t) => !d.propio || DUENO_TEMA[t] === b);
      break;
  }
  return lista.length ? lista : null;
}

/** Coste de cada punto de presencia al Implantar: doble donde controla el rival. */
export function costeImplantar(e: Pick<Estado, 'presencia' | 'morado'>, b: Bando, id: string): number {
  return controla(e, id, RIVAL[b]) ? 2 : 1;
}

/** Zona en la que actúa una acción (para el bono de zona). */
function zonaDe(destino: string | undefined): ZonaId | null {
  if (!destino) return null;
  if (PROV[destino]) return PROV[destino].zona;
  return (ZONAS as Record<string, unknown>)[destino] ? (destino as ZonaId) : null;
}

/** PC de una acción concreta: los de la carta (o la básica), la Maquinaria y el bono de zona. */
export function pcAccion(e: Estado, b: Bando, carta: IdCarta, modo: Modo, destino?: string): number {
  let pc = carta === 'basica' ? pcBasica(e, b) : carta === 'pegada' ? PC_PEGADA : pcCarta(e, b, carta);
  if (modo === 'implantar' && carta !== 'pegada' && tiene(e, b, 'calle', 1)) pc++;
  const z = zonaDe(destino);
  if ((modo === 'implantar' || modo === 'atacar') && z && e.efectos.some((x) => x.tipo === 'bonoZona' && x.dueno === b && x.zona === z)) pc++;
  return pc;
}

/** Cuánto cambia el calor al marcar agenda. */
export function deltaAgenda(e: Estado, b: Bando, carta: IdCarta, sentido: 'sube' | 'baja'): number {
  const base = carta === 'basica' || carta === 'pegada' ? 1 : 2;
  if (sentido === 'baja') return -base;
  return base + (tiene(e, b, 'medios', 1) ? 1 : 0);
}

/** Todas las jugadas posibles de b ahora mismo. */
export function opcionesAccion(e: Estado, b: Bando, gratis?: 'pegada'): OpcionAccion[] {
  if (gratis === 'pegada') return [{ carta: 'pegada', pc: PC_PEGADA, modos: { implantar: [...ZONA_IDS] } }];
  const ataques = objetivosAtaque(e, b);
  const negociables = partidosNegociables(e, b);
  const res: OpcionAccion[] = [];
  for (const id of e.manos[b]) {
    const c = CARTAS[id];
    const pc = pcCarta(e, b, id);
    const modos: OpcionAccion['modos'] = {};
    const ev = destinosEvento(e, b, id);
    if (ev) modos.evento = ev;
    modos.implantar = [...ZONA_IDS];
    if (ataques.length) modos.atacar = ataques;
    if (pc >= 2 && negociables.length) modos.negociar = negociables;
    modos.agenda = [...TEMAS];
    const ramas = RAMAS.filter((r) => puedeSubir(e, b, r, c.fuerza));
    if (ramas.length) modos.maquinaria = ramas;
    res.push({ carta: id, pc, modos });
  }
  res.push({ carta: 'basica', pc: pcBasica(e, b), modos: { implantar: [...ZONA_IDS], agenda: [...TEMAS] } });
  return res;
}

/** Provincias de una zona donde se puede implantar. */
export function provinciasZona(z: string): string[] {
  return PROVINCIAS.filter((p) => p.zona === z).map((p) => p.id);
}

/** Reparto de Implantar: el del jugador (validado) o el sugerido. */
export function repartoImplantar(e: Estado, b: Bando, zona: string, pc: number, dado?: Record<string, number>): Record<string, number> {
  const cands = provinciasZona(zona);
  const coste = (id: string) => costeImplantar(e, b, id);
  if (dado) {
    validarReparto(dado, cands, pc, MAX_POR_PROVINCIA, coste);
    return dado;
  }
  return repartoSugerido(e, b, cands, pc, { maxPor: MAX_POR_PROVINCIA, coste });
}

/** Valida una respuesta de acción contra el estado sin cambiar nada (lanza un error si no es válida). */
export function validarAccion(e: Estado, b: Bando, r: Extract<Respuesta, { tipo: 'accion' }>) {
  if (r.modo === 'implantar' && r.reparto) repartoImplantar(e, b, r.destino!, pcAccion(e, b, r.carta, 'implantar', r.destino), r.reparto);
  if (r.modo === 'evento' && typeof r.carta === 'number' && r.reparto) {
    const rep = efectoReparto(CARTAS[r.carta]);
    if (!rep) throw new Error('Esta carta no reparte presencia');
    validarReparto(r.reparto, candidatas(e, rep, { yo: b, carta: r.carta, destino: r.destino }), rep.n, rep.maxPor ?? rep.n);
  }
  if (r.modo === 'agenda' && r.sentido === 'baja' && e.agenda.calor[r.destino as Tema] <= 0) throw new Error('Ese tema ya está frío');
}

const NOMBRE_JUGADA: Record<Modo, string> = {
  evento: 'como evento', implantar: 'para implantarse', atacar: 'para atacar', negociar: 'para negociar', agenda: 'para marcar la agenda', maquinaria: 'para la Maquinaria',
};

function nombreDestino(modo: Modo, destino?: string): string {
  if (!destino || destino === SIN_DESTINO) return '';
  if (modo === 'agenda') return NOMBRE_TEMA[destino as Tema];
  if (modo === 'maquinaria') return NOMBRE_RAMA[destino as Rama];
  if (PROV[destino]) return PROV[destino].nombre;
  if ((ZONAS as Record<string, { nombre: string }>)[destino]) return (ZONAS as Record<string, { nombre: string }>)[destino].nombre;
  if ((PARTIDOS as Record<string, { siglas: string }>)[destino]) return (PARTIDOS as Record<string, { siglas: string }>)[destino].siglas;
  if ((NOMBRE_TEMA as Record<string, string>)[destino]) return NOMBRE_TEMA[destino as Tema];
  return destino;
}

/** Resuelve una acción ya validada (motor.ts valida antes de tocar nada). Puede encolar los efectos del evento. */
export function resolverAccion(e: Estado, b: Bando, r: Extract<Respuesta, { tipo: 'accion' }>, gratis: boolean) {
  const c = typeof r.carta === 'number' ? CARTAS[r.carta] : null;
  const pc = pcAccion(e, b, r.carta, r.modo, r.destino);
  const quien = c ? citar(c.nombre) : r.carta === 'pegada' ? 'la pegada de carteles' : 'una acción básica';
  const dest = nombreDestino(r.modo, r.destino);
  log(e, `El ${N(b)} juega ${quien} ${NOMBRE_JUGADA[r.modo]}${dest ? `: ${dest}` : ''}${r.modo !== 'evento' && r.modo !== 'maquinaria' ? ` (${pc} PC)` : ''}`, 'jugada', b);
  suceso(e, { s: 'jugada', bando: b, carta: r.carta, modo: r.modo, destino: r.destino, pc });
  if (c) soltarCarta(e, b, c.id, r.modo === 'evento' && !!c.retirar);
  if (!gratis) e.acciones[b]--;
  // hablar de algo lo calienta: la carta suma calor a su tema (salvo si va a la Maquinaria)
  if (c && r.modo !== 'maquinaria') calentar(e, c.tema, 1);

  switch (r.modo) {
    case 'evento':
      if (c && c.efectos.length) encolar(e, tareaEfectos(c.efectos, { yo: b, carta: c.id, destino: r.destino === SIN_DESTINO ? undefined : r.destino, reparto: r.reparto }));
      return;
    case 'implantar': {
      const reparto = repartoImplantar(e, b, r.destino!, pc, r.reparto);
      for (const [id, n] of Object.entries(reparto)) cambiarPresencia(e, id, b, n);
      return;
    }
    case 'atacar': atacar(e, b, r.destino!, pc); return;
    case 'negociar': negociar(e, b, r.destino as Negociable, pc); return;
    case 'agenda': calentar(e, r.destino as Tema, deltaAgenda(e, b, r.carta, r.sentido ?? 'sube')); return;
    case 'maquinaria': {
      const rama = r.destino as Rama;
      subirMaquinaria(e, b, rama);
      e.maquinariaUsada[b] = true;
      log(e, `El ${N(b)} sube ${NOMBRE_RAMA[rama]} al nivel ${e.maquinaria[b][rama]}`, undefined, b);
      if (e.maquinaria[b][rama] === 3 && !e.completadas[rama]) {
        e.completadas[rama] = b;
        log(e, `El ${N(b)} es el primero en completar ${NOMBRE_RAMA[rama]}`, undefined, b);
        pv(e, b, PV_RAMA_COMPLETA);
      }
      return;
    }
  }
}

export function atacar(e: Estado, b: Bando, id: string, pc: number) {
  const rv = RIVAL[b];
  const base = baseAtaque(e, b, id, pc);
  const cara = 1 + Math.floor(aleatorio(e) * 6);
  const resultado = base + DADO_ATAQUE[cara - 1];
  const quitado = Math.max(0, Math.min(resultado, e.presencia[id][rv]));
  const ganado = Math.max(0, resultado - quitado);
  log(e, `Ataque en ${PROV[id].nombre}: ${base} ${DADO_ATAQUE[cara - 1] >= 0 ? '+' : '−'} ${Math.abs(DADO_ATAQUE[cara - 1])} = ${resultado}`, 'dado', b);
  suceso(e, { s: 'ataque', bando: b, prov: id, dado: DADO_ATAQUE[cara - 1], resultado, quitado, ganado });
  cambiarPresencia(e, id, rv, -quitado);
  cambiarPresencia(e, id, b, ganado);
  if (PROV[id].clave && !tieneEfecto(e, 'campanaLimpia', b)) cambiarClima(e, -1);
}

export function negociar(e: Estado, b: Bando, partido: Negociable, pc: number) {
  e.negociado[b].push(partido);
  if (partido === 'PODEMOS') {
    // el Progresista lo corteja y desarma la pinza; el Conservador solo puede tejerla con Podemos en guerra con el PSOE
    if (b === 'P') cambiarPodemos(e, 0, 1, -1);
    else cambiarPodemos(e, 0, 0, 1);
    suceso(e, { s: 'negocia', bando: b, partido, pasos: 1 });
    pv(e, RIVAL[b], 1);
    return;
  }
  const pasos = Math.min(2, Math.floor(pc / 2));
  moverAfinidad(e, partido as RegionalId, b, pasos);
  suceso(e, { s: 'negocia', bando: b, partido, pasos });
  if (b === 'P' && CESIONES_CARAS.includes(partido as RegionalId)) {
    log(e, `Cesiones a ${PARTIDOS[partido].siglas}: el Conservador lo explota`, undefined, 'C');
    pv(e, 'C', pasos);
  }
}

export { provinciasDestino };
