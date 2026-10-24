// Evaluación de posiciones para la IA.
// Moneda común: «X», el saldo parlamentario a favor del Conservador (escaños que votarían sí a su
// candidato menos los que votarían sí al progresista, ponderando abstenciones). Es lineal en los escaños,
// así que se puede calcular provincia a provincia y actualizar solo lo que cambia.
import { CARTAS } from '../data/cartas';
import { PROV, PROVINCIAS } from '../data/provincias';
import { dhondt, investir, votosProvincia, vetoVoxActivo } from '../engine/electoral';
import { puntuarZona, ZONA_IDS, esEncuesta, rondasDe } from '../engine/reglas';
import type { Bando, Efecto, Estado, PartidoId, Votos, ZonaId } from '../engine/tipos';

const DESVIOS = [-0.9, 0.9]; // pp de incertidumbre para suavizar el reparto

export function escanosSuaves(e: Estado, id: string): Votos {
  const p = PROV[id];
  const acc: Votos = {};
  for (const d of DESVIOS) {
    const r = dhondt(p.escanos, votosProvincia(p, e, d));
    for (const k in r) acc[k as PartidoId] = (acc[k as PartidoId] ?? 0) + (r[k as PartidoId] as number) / DESVIOS.length;
  }
  return acc;
}

/** Peso de cada escaño en X (+1 suma al Conservador, −1 al Progresista). */
export function pesos(e: Estado): Partial<Record<PartidoId, number>> {
  const veto = vetoVoxActivo(e);
  // Podemos nunca vota a Feijóo; a Sánchez, según su humor (sí −1, abstención −0,5, no 0)
  const hp = e.podemos.humor;
  const w: Partial<Record<PartidoId, number>> = { PP: 1, VOX: 1, PSOE: -1, SUMAR: -1, PODEMOS: hp >= 1 ? -1 : hp === 0 ? -0.5 : 0, SALF: 0.5 };
  for (const [k, a] of Object.entries(e.afinidad)) {
    let v = a >= 2 ? 1 : a === 1 ? 0.5 : a === 0 ? 0 : a === -1 ? -0.5 : -1;
    if (veto && v === 1 && (k === 'PNV' || k === 'JUNTS' || k === 'CC')) v = 0.5;
    w[k as PartidoId] = v;
  }
  return w;
}

export function xDe(esc: Votos, w: Partial<Record<PartidoId, number>>): number {
  let x = 0;
  for (const k in esc) x += (esc[k as PartidoId] as number) * (w[k as PartidoId] ?? 0);
  return x;
}

/** PV que se esperan de las Encuestas aún por jugar (a favor del Conservador). */
export function pvFuturo(e: Estado, b: Bando): number {
  if (e.turno >= 8) return 0;
  let total = 0;
  const enMano = new Set(e.manos[b].filter(esEncuesta));
  for (const z of ZONA_IDS) {
    const id = encuestaDe(z);
    if (e.retiradas.includes(id)) continue;
    if (!disponibleYa(e, id)) continue;
    const neto = Math.max(-5, Math.min(5, puntuarZona(e, z).neto));
    const propio = b === 'C' ? neto : -neto;
    let p: number;
    // la que tengo en la mano se publicará esta semana sí o sí (jugarla ya si es favorable)
    if (enMano.has(id)) p = propio > 0 ? 0.95 : 1;
    else p = 0.35 * Math.min(1, (8 - e.turno) / 3);
    total += neto * p;
  }
  return total;
}

const ENCUESTA_ZONA: Record<ZonaId, number> = { AND: 101, CAT: 102, MAD: 103, LEV: 104, INT: 105, NOR: 106, CAN: 107 };
const encuestaDe = (z: ZonaId) => ENCUESTA_ZONA[z];
const disponibleYa = (e: Estado, id: number) => CARTAS[id].mazo === 1 || (CARTAS[id].mazo === 2 && e.turno >= 3);

/** PV que costará la Exigencia de las bases si no se hacen más ofensivas (a favor del Conservador). */
export function pvExigencia(e: Estado): number {
  let v = 0;
  for (const b of ['P', 'C'] as Bando[]) {
    const falta = Math.max(0, e.clima - e.exigencia[b]);
    if (!falta) continue;
    const quedan = Math.max(0, rondasDe(e, b) - e.rondasHechas[b]);
    const urgencia = quedan <= 1 ? 1 : quedan <= 2 ? 0.85 : quedan <= 4 ? 0.65 : 0.5;
    v += (b === 'P' ? 1 : -1) * falta * urgencia;
  }
  return v;
}

/** ¿El evento de la carta baja el Clima? (si es del rival, jugarla por PC con Clima 2 es perder) */
export function bajaClima(id: number): boolean {
  const mira = (efs: Efecto[]): boolean => efs.some((f) => (f.e === 'clima' && f.n < 0) || ('efectos' in f && Array.isArray((f as any).efectos) && mira((f as any).efectos)));
  return mira(CARTAS[id].efectos);
}

/** Riesgo de verse obligado a jugar una «bomba» del rival con el Clima en 2. */
export function riesgoBombas(e: Estado, b: Bando): number {
  if (e.clima > 3 || e.turno === 0) return 0;
  const rv = b === 'C' ? 'P' : 'C';
  const mano = e.manos[b];
  const bombas = mano.filter((id) => (CARTAS[id].lado === rv || CARTAS[id].lado === 'W') && bajaClima(id)).length;
  if (!bombas) return 0;
  const quedan = Math.max(0, rondasDe(e, b) - e.rondasHechas[b]);
  const seguras = mano.length - bombas + (e.votoUtil.duenio === b && e.votoUtil.disponible ? 1 : 0);
  if (e.clima === 3) return 0.01 * bombas;
  return seguras < quedan ? 0.45 : 0.04 * bombas;
}

export const ESCANOS_POR_PV = 1.75;
const sig = (x: number) => 1 / (1 + Math.exp(-x));

export interface Valoracion {
  valor: number; // probabilidad de victoria del bando (0-1), ±1000 si terminal
  x: number;
  mC: number;
  mP: number;
}

export function valorar(e: Estado, b: Bando): Valoracion {
  if (e.ganador) {
    const v = e.ganador.bando === b ? 1000 : e.ganador.bando === null ? 0 : -1000;
    return { valor: v, x: 0, mC: 0, mP: 0 };
  }
  const esc: Votos = {};
  for (const p of PROVINCIAS) {
    const r = escanosSuaves(e, p.id);
    for (const k in r) esc[k as PartidoId] = (esc[k as PartidoId] ?? 0) + (r[k as PartidoId] as number);
  }
  const veto = vetoVoxActivo(e);
  const ic = investir(esc, 'C', e.afinidad, veto, e.podemos.humor);
  const ip = investir(esc, 'P', e.afinidad, veto, e.podemos.humor);
  const dpv = pvFuturo(e, b) + pvExigencia(e);
  const ajuste = 2 * ESCANOS_POR_PV * dpv;
  const mC = ic.si - ic.no + ajuste;
  const mP = ip.si - ip.no - ajuste;
  const s = 7 + 2.5 * Math.max(0, 8 - e.turno);
  const pC = sig(mC / s);
  const pP = sig(mP / s) * (1 - pC);
  const ventajaFinal = e.ventaja + dpv;
  const q = sig(ventajaFinal / 2.5);
  let ganaC = pC + (1 - pC - pP) * q;
  // muerte súbita por Ventaja
  const sdC = Math.max(0, (ventajaFinal - 12) / 8);
  const sdP = Math.max(0, (-ventajaFinal - 12) / 8);
  ganaC = Math.min(1, Math.max(0, ganaC + 0.5 * sdC * sdC * (1 - ganaC) - 0.5 * sdP * sdP * ganaC));
  const valor = (b === 'C' ? ganaC : 1 - ganaC) - riesgoBombas(e, b);
  return { valor, x: (mC - mP) / 4, mC, mP };
}

/** Evaluación local (en unidades X a favor de b) de una provincia y su zona: rápida para decisiones de colocación. */
export function valorLocal(e: Estado, id: string, b: Bando, w = pesos(e)): number {
  const x = xDe(escanosSuaves(e, id), w);
  const z = PROV[id].zona;
  const neto = puntuarZona(e, z).neto;
  const pz = e.turno >= 8 ? 0 : e.manos[b].includes(ENCUESTA_ZONA[z]) ? 1 : 0.45;
  const total = x + neto * pz * 2 * ESCANOS_POR_PV;
  return b === 'C' ? total : -total;
}
