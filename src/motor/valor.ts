// Valor parlamentario de la presencia: lo usan el reparto sugerido (motor e interfaz), la previsión y la IA.
// Moneda común «X»: saldo de escaños a favor del Conservador, ponderando a cada partido por su voto probable
// en la investidura. Es lineal en los escaños, así que se calcula provincia a provincia.
import { PROV, PROVINCIAS } from '../data/provincias';
import type { Bando, PartidoId, Votos, ZonaId } from './base';
import { dhondt, posturaPodemos, vetoVoxActivo, votoPodemos, votosProvincia, type EntradaProyeccion } from './electoral';
import { controlador } from './reglas';

/** Lo que el valor necesita: el modelo electoral público, los marcadores morados y el calendario. */
export type EstadoValor = EntradaProyeccion & { morado: Record<string, number>; calendario: Record<number, ZonaId | null>; semana: number };

const DESVIOS = [-0.9, 0.9]; // pp de incertidumbre para suavizar el reparto

export function escanosSuaves(e: EntradaProyeccion, id: string): Votos {
  const p = PROV[id];
  const acc: Votos = {};
  for (const d of DESVIOS) {
    const r = dhondt(p.escanos, votosProvincia(p, e, d));
    for (const k in r) acc[k as PartidoId] = (acc[k as PartidoId] ?? 0) + (r[k as PartidoId] as number) / DESVIOS.length;
  }
  return acc;
}

export type Pesos = Partial<Record<PartidoId, number>>;

/** Peso de cada escaño en X (+1 suma al Conservador, −1 al Progresista). */
export function pesos(e: EntradaProyeccion): Pesos {
  const veto = vetoVoxActivo(e);
  const pod = posturaPodemos(e);
  const valor = { si: 1, abst: 0.5, no: 0 };
  const wPodemos = valor[votoPodemos('C', pod)] - valor[votoPodemos('P', pod)];
  const w: Pesos = { PP: 1, VOX: 1, PSOE: -1, SUMAR: -1, PODEMOS: wPodemos, SALF: 0.5 };
  for (const [k, a] of Object.entries(e.afinidad)) {
    let v = a >= 2 ? 1 : a === 1 ? 0.5 : a === 0 ? 0 : a === -1 ? -0.5 : -1;
    if (veto && v === 1 && (k === 'PNV' || k === 'JUNTS' || k === 'CC')) v = 0.5;
    w[k as PartidoId] = v;
  }
  return w;
}

export function xDe(esc: Votos, w: Pesos): number {
  let x = 0;
  for (const k in esc) x += (esc[k as PartidoId] as number) * (w[k as PartidoId] ?? 0);
  return x;
}

/** X de una provincia con una presencia distinta (sin tocar el estado). */
export function xProvincia(e: EntradaProyeccion, id: string, w: Pesos, pres?: { P: number; C: number }): number {
  const m = pres ? { ...e, presencia: { ...e.presencia, [id]: pres } } : e;
  return xDe(escanosSuaves(m, id), w);
}

/** Zonas que se encuestan esta semana o la siguiente: ahí el control vale más. */
function zonasCalientes(e: EstadoValor): ZonaId[] {
  return [e.calendario[e.semana], e.calendario[e.semana + 1]].filter((z): z is ZonaId => !!z);
}

/** Valor para b (en escaños) de pasar una provincia a otra presencia: escaños y, un poco, el control. */
export function valorCambio(e: EstadoValor, b: Bando, id: string, nueva: { P: number; C: number }, w = pesos(e)): number {
  const signo = b === 'C' ? 1 : -1;
  const antes = xProvincia(e, id, w);
  const despues = xProvincia(e, id, w, nueva);
  let v = signo * (despues - antes);
  const c0 = controlador(e, id);
  const c1 = controlador({ presencia: { ...e.presencia, [id]: nueva }, morado: e.morado }, id);
  if (c0 !== c1) {
    const peso = zonasCalientes(e).includes(PROV[id].zona) ? 1.5 : 0.6;
    const g = (c: Bando | null) => (c === b ? 1 : c === null ? 0 : -1);
    v += peso * (g(c1) - g(c0));
  }
  return v;
}

export interface OpcionesReparto {
  /** coste de cada punto en la provincia */
  coste?: (id: string) => number;
  maxPor?: number;
  /** quitar presencia al rival en lugar de colocar la propia */
  quitar?: boolean;
}

/** Reparto voraz: cada punto donde más escaños da por PC. Determinista. */
export function repartoSugerido(e: EstadoValor, b: Bando, candidatos: string[], presupuesto: number, o: OpcionesReparto = {}): Record<string, number> {
  const w = pesos(e);
  const coste = o.coste ?? (() => 1);
  const maxPor = o.maxPor ?? presupuesto;
  const quien: Bando = o.quitar ? (b === 'C' ? 'P' : 'C') : b;
  const reparto: Record<string, number> = {};
  const pres: Record<string, { P: number; C: number }> = {};
  for (const id of candidatos) pres[id] = { ...e.presencia[id] };
  let queda = presupuesto;
  const modelo = { ...e, presencia: { ...e.presencia } };
  while (queda > 0) {
    let mejor: string | null = null;
    let mv = -Infinity;
    for (const id of candidatos) {
      const ya = reparto[id] ?? 0;
      const c = coste(id);
      if (ya >= maxPor || c > queda) continue;
      if (o.quitar && pres[id][quien] <= 0) continue;
      const nueva = { ...pres[id], [quien]: pres[id][quien] + (o.quitar ? -1 : 1) };
      const v = valorCambio(modelo, b, id, nueva, w) / c + PROV[id].escanos * 1e-4;
      if (v > mv) { mv = v; mejor = id; }
    }
    if (!mejor) break;
    reparto[mejor] = (reparto[mejor] ?? 0) + 1;
    pres[mejor] = { ...pres[mejor], [quien]: pres[mejor][quien] + (o.quitar ? -1 : 1) };
    modelo.presencia[mejor] = pres[mejor];
    queda -= coste(mejor);
  }
  return reparto;
}

/** Saldo X total (lo usan la IA y la previsión). */
export function xTotal(e: EntradaProyeccion, w = pesos(e)): number {
  let x = 0;
  for (const p of PROVINCIAS) x += xProvincia(e, p.id, w);
  return x;
}
