// Evaluación de posiciones para la IA. Moneda común «X»: saldo de escaños a favor del Conservador ponderado
// por el voto probable de cada partido en la investidura. Se calcula provincia a provincia y solo se recalcula
// lo que cambia; la Ventaja se suma de forma lineal (1 PV ≈ 1,75 escaños que cambian de bloque).
import { CARTAS } from '../data/mazos';
import { PROVINCIAS } from '../data/provincias';
import { duenoTema, enAgenda, temasOrdenados } from '../motor/agenda';
import { PV_DOMINANTE, PV_SEGUNDO } from '../motor/semana';
import { RAMAS } from '../motor/maquinaria';
import { puntuarCIS, puntuarZona, TOPE_VENTAJA } from '../motor/reglas';
import { escanosSuaves, pesos, xDe, type Pesos } from '../motor/valor';
import type { Bando, Estado, Rama, Tema } from '../motor/tipos';

export const X_POR_PV = 3.5;

export interface Base {
  ventaja: number;
  w: Pesos;
  firma: string;
  x: Record<string, number>;
  claves: Record<string, string>;
}

const firmaGlobal = (e: Estado) => JSON.stringify([e.socio, e.podemos, e.modsPartido, e.afinidad, e.sesgo]);
const firmaProv = (e: Estado, id: string) => `${e.presencia[id].P},${e.presencia[id].C},${e.morado[id] ?? 0},${e.modsProv[id] ?? 0}`;

export function prepararBase(e: Estado): Base {
  const w = pesos(e);
  const x: Record<string, number> = {};
  const claves: Record<string, string> = {};
  for (const p of PROVINCIAS) {
    x[p.id] = xDe(escanosSuaves(e, p.id), w);
    claves[p.id] = firmaProv(e, p.id);
  }
  return { ventaja: e.ventaja, w, firma: firmaGlobal(e), x, claves };
}

/** X del estado, reutilizando las provincias que no han cambiado. */
export function xEstado(e: Estado, base: Base): number {
  const global = firmaGlobal(e) === base.firma;
  const w = global ? base.w : pesos(e);
  const modelo = { ...e, ventaja: base.ventaja };
  let x = 0;
  for (const p of PROVINCIAS) {
    if (global && firmaProv(e, p.id) === base.claves[p.id]) x += base.x[p.id];
    else x += xDe(escanosSuaves(modelo, p.id), w);
  }
  return x + X_POR_PV * (e.ventaja - base.ventaja);
}

/** PV que se esperan (a favor del Conservador) de las encuestas por venir y del tema dominante. */
export function pvEsperados(e: Estado): number {
  let pv = 0;
  for (let s = e.semana; s <= 7; s++) {
    const z = e.calendario[s];
    if (!z) continue;
    const peso = s === e.semana ? 0.85 : s === e.semana + 1 ? 0.55 : 0.3;
    pv += puntuarZona(e, z).neto * peso;
  }
  if (e.semana <= 4) pv += puntuarCIS(e) * (e.semana === 4 ? 0.85 : 0.4);
  // la Agenda al cerrar la semana: más segura cuanto más le saque cada tema al siguiente
  const [t1, t2, t3] = temasOrdenados(e);
  const calor = e.agenda.calor;
  const signo = (t: Tema) => {
    const d = duenoTema(e, t);
    return d === 'C' ? 1 : d === 'P' ? -1 : 0;
  };
  if (calor[t1] > 0) pv += signo(t1) * PV_DOMINANTE * Math.min(0.9, 0.45 + 0.15 * (calor[t1] - calor[t2]));
  if (calor[t2] > 0) pv += signo(t2) * PV_SEGUNDO * Math.min(0.9, 0.4 + 0.15 * (calor[t2] - calor[t3]));
  return pv;
}

/** Ajustes para calibrar la IA con simulaciones (escala del valor de la Maquinaria para cada bloque). */
export const AJUSTES_IA = { maquinaria: { P: 2, C: 2 } };

/** Lo que vale cada nivel de cada rama al principio de la campaña (en X). */
const VALOR_NIVEL: Record<Rama, number[]> = { calle: [0, 6, 12, 20], medios: [0, 4, 9, 13], datos: [0, 3, 8, 13] };

/** Valor (a favor del Conservador) de la Maquinaria y de la mano propia de b. */
function extras(e: Estado, b: Bando): number {
  let v = 0;
  for (const r of RAMAS) v += VALOR_NIVEL[r][e.maquinaria.C[r]] * AJUSTES_IA.maquinaria.C - VALOR_NIVEL[r][e.maquinaria.P[r]] * AJUSTES_IA.maquinaria.P;
  // las semanas que quedan multiplican lo que vale la Maquinaria
  v *= Math.max(0.3, (8 - e.semana) / 6);
  // la mano propia: cada carta vale por su fuerza, y un poco más si su tema está en agenda (+1 PC)
  const agenda = enAgenda(e);
  let mano = 0;
  for (const id of e.manos[b]) mano += 0.5 + 0.35 * CARTAS[id].fuerza + (agenda.includes(CARTAS[id].tema) ? 0.35 : 0);
  return v + (b === 'C' ? mano : -mano);
}

const sig = (x: number) => 1 / (1 + Math.exp(-x));

/** Probabilidad de victoria de b (±1000 si la partida ha terminado). */
export function valorar(e: Estado, b: Bando, base: Base): number {
  if (e.ganador) {
    // partida terminada: ganar (o perder) por más o por menos sigue importando, y nunca por ruptura
    if (/Ruptura/.test(e.ganador.motivo) && e.ganador.bando !== b) return -1100;
    const margen = (b === 'C' ? 1 : -1) * xEstado(e, base) / 1000;
    return (e.ganador.bando === b ? 1000 : e.ganador.bando === null ? 0 : -1000) + margen;
  }
  const pvF = pvEsperados(e);
  const x = xEstado(e, base) + X_POR_PV * pvF + extras(e, b);
  const quedan = Math.max(0, 8 - e.semana) + (e.acciones.P + e.acciones.C) / 8;
  const s = 6 + 2.2 * quedan;
  let ganaC = sig(x / s);
  // muerte súbita por la Ventaja
  const v = e.ventaja + pvF;
  const tope = TOPE_VENTAJA * 0.6;
  if (v > tope) ganaC += (1 - ganaC) * Math.min(1, ((v - tope) / (TOPE_VENTAJA - tope)) ** 2) * 0.6;
  if (v < -tope) ganaC -= ganaC * Math.min(1, ((-v - tope) / (TOPE_VENTAJA - tope)) ** 2) * 0.6;
  return b === 'C' ? ganaC : 1 - ganaC;
}
