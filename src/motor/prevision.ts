// Previsión de jugadas para la interfaz: se calcula solo con la vista del jugador (sirve igual contra la IA
// y online). Reconstruye un estado jugable con lo que el jugador ve, aplica la jugada y resume qué cambia.
import { idsDeBloque, CARTAS } from '../data/mazos';
import { PROV, PROVINCIAS } from '../data/provincias';
import { RIVAL, type Bando } from './base';
import { proyectar, type Resultado } from './electoral';
import { costeImplantar, efectoReparto, pcAccion, provinciasZona, SIN_DESTINO } from './acciones';
import { candidatas } from './efectos';
import { responder } from './motor';
import { baseAtaque, controlador, DADO_ATAQUE, MAX_POR_PROVINCIA } from './reglas';
import { repartoSugerido } from './valor';
import { TEMAS } from './agenda';
import type { Estado, Ganador, Respuesta, Tema } from './tipos';
import type { Vista } from './vista';

type Accion = Extract<Respuesta, { tipo: 'accion' }>;

/** Un estado jugable a partir de la vista: las cartas ocultas del rival se rellenan con una cualquiera. */
export function estadoDesdeVista(v: Vista): Estado {
  const { yo, mano, manoRival, mazos: _m, pendiente, esperando: _e, proximaNoticia: _p, ...resto } = v;
  const rival = RIVAL[yo];
  const relleno = idsDeBloque(rival, 1)[0];
  const gratis = pendiente?.tipo === 'accion' && pendiente.opciones.some((o) => o.carta === 'pegada') ? 'pegada' : undefined;
  const manos = { P: [] as number[], C: [] as number[] };
  manos[yo] = [...mano];
  manos[rival] = Array(manoRival).fill(relleno);
  return {
    ...structuredClone(resto),
    rng: 12345,
    manos,
    mazos: { P: [], C: [], actualidad: [], podemos: [] },
    pendiente: pendiente ? structuredClone(pendiente) : null,
    pila: pendiente?.tipo === 'accion' ? [{ t: 'accion', b: yo, gratis }] : [],
    silencio: true,
  };
}

export interface Resumen {
  /** escaños de cada bloque (PSOE+FA y PP+Vox) antes y después */
  bloque: { antes: { P: number; C: number }; despues: { P: number; C: number } };
  /** síes posibles en la investidura de cada candidato */
  apoyos: { antes: { P: number; C: number }; despues: { P: number; C: number } };
  ventaja: number; // cambio, + a favor del Conservador
  clima: number;
  calor: Partial<Record<Tema, number>>;
  controles: { prov: string; antes: Bando | null; despues: Bando | null }[];
  presencia: { prov: string; P: number; C: number }[];
  ganador: Ganador | null;
  /** la jugada lleva a una elección (o depende del dado) y la previsión es parcial */
  incierta: boolean;
}

export function resumir(antes: Estado | Vista, despues: Estado, ra?: Resultado): Resumen {
  const a = ra ?? proyectar(PROVINCIAS, antes);
  const d = proyectar(PROVINCIAS, despues);
  const controles: Resumen['controles'] = [];
  const presencia: Resumen['presencia'] = [];
  for (const p of PROVINCIAS) {
    const ca = controlador(antes, p.id);
    const cd = controlador(despues, p.id);
    if (ca !== cd) controles.push({ prov: p.id, antes: ca, despues: cd });
    const dP = despues.presencia[p.id].P - antes.presencia[p.id].P;
    const dC = despues.presencia[p.id].C - antes.presencia[p.id].C;
    if (dP || dC) presencia.push({ prov: p.id, P: dP, C: dC });
  }
  const calor: Resumen['calor'] = {};
  for (const t of TEMAS) {
    const x = despues.agenda.calor[t] - antes.agenda.calor[t];
    if (x) calor[t] = x;
  }
  return {
    bloque: { antes: a.bloque, despues: d.bloque },
    apoyos: { antes: a.apoyos, despues: d.apoyos },
    ventaja: despues.ventaja - antes.ventaja,
    clima: despues.clima - antes.clima,
    calor,
    controles,
    presencia,
    ganador: despues.ganador,
    incierta: !!despues.pendiente,
  };
}

/** Aplica la jugada sobre lo que ve el jugador. Lanza un error si no es válida. */
export function simularJugada(v: Vista, r: Respuesta): Estado {
  const e = estadoDesdeVista(v);
  responder(e, r);
  return e;
}

/** Previsión de una jugada (o el motivo por el que no se puede hacer). */
export function previsualizar(v: Vista, r: Respuesta, ra?: Resultado): Resumen | { error: string } {
  try {
    const despues = simularJugada(v, r);
    const res = resumir(v, despues, ra);
    if (r.tipo === 'accion' && (r.modo === 'atacar' || (typeof r.carta === 'number' && r.modo === 'evento' && /"dado"|"duelo"/.test(JSON.stringify(CARTAS[r.carta].efectos))))) res.incierta = true;
    return res;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

// —— el reparto de la presencia ——
export interface DatosReparto {
  candidatas: string[];
  /** puntos disponibles (PC al Implantar) */
  total: number;
  maxPor: number;
  coste: Record<string, number>;
  sugerido: Record<string, number>;
  /** quita presencia al rival en lugar de colocar la propia */
  quitar: boolean;
}

/** Datos para repartir la presencia de una jugada (Implantar o un evento que reparte), o null si no reparte. */
export function datosReparto(v: Vista, r: Accion): DatosReparto | null {
  if (!r.destino || r.destino === SIN_DESTINO) return null;
  const e = estadoDesdeVista(v);
  const b = v.yo;
  if (r.modo === 'implantar') {
    const cands = provinciasZona(r.destino);
    const total = pcAccion(e, b, r.carta, 'implantar', r.destino);
    const coste = Object.fromEntries(cands.map((id) => [id, costeImplantar(e, b, id)]));
    return {
      candidatas: cands, total, maxPor: MAX_POR_PROVINCIA, coste, quitar: false,
      sugerido: repartoSugerido(e, b, cands, total, { maxPor: MAX_POR_PROVINCIA, coste: (id) => coste[id] }),
    };
  }
  if (r.modo === 'evento' && typeof r.carta === 'number') {
    const ef = efectoReparto(CARTAS[r.carta]);
    if (!ef) return null;
    const cands = candidatas(e, ef, { yo: b, carta: r.carta, destino: r.destino });
    const maxPor = ef.maxPor ?? ef.n;
    const quitar = ef.e === 'retirar';
    return {
      candidatas: cands, total: ef.n, maxPor, coste: Object.fromEntries(cands.map((id) => [id, 1])), quitar,
      sugerido: repartoSugerido(e, b, cands, ef.n, { maxPor, quitar }),
    };
  }
  return null;
}

// —— el ataque ——
export interface CaraAtaque {
  dado: number;
  resultado: number;
  quitado: number;
  ganado: number;
  control: Bando | null;
}

/** Los seis resultados posibles de un ataque (todos igual de probables). */
export function distribucionAtaque(v: Vista, carta: Accion['carta'], prov: string): { base: number; caras: CaraAtaque[]; exito: number; giro: number } {
  const e = estadoDesdeVista(v);
  const b = v.yo;
  const rv = RIVAL[b];
  const pc = pcAccion(e, b, carta, 'atacar', prov);
  const base = baseAtaque(e, b, prov, pc);
  const caras = DADO_ATAQUE.map((dado) => {
    const resultado = base + dado;
    const quitado = Math.max(0, Math.min(resultado, e.presencia[prov][rv]));
    const ganado = Math.max(0, resultado - quitado);
    const pres = { ...e.presencia[prov], [rv]: e.presencia[prov][rv] - quitado, [b]: e.presencia[prov][b] + ganado };
    return { dado, resultado, quitado, ganado, control: controlador({ presencia: { ...e.presencia, [prov]: pres }, morado: e.morado }, prov) };
  });
  const antes = controlador(e, prov);
  return {
    base,
    caras,
    exito: caras.filter((c) => c.resultado > 0).length / 6,
    giro: caras.filter((c) => c.control !== antes && c.control === b).length / 6,
  };
}

/** ¿Esta provincia baja el Clima si se ataca? */
export const atacarBajaClima = (prov: string) => !!PROV[prov]?.clave;

