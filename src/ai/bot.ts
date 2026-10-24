// IA de «176»: voraz con simulación del resultado de cada jugada.
// No mira la mano del rival ni el orden del mazo (se barajan en cada simulación) ni los dados futuros.
import { CARTAS } from '../data/cartas';
import { CESIONES_CARAS } from '../data/partidos';
import { PROV, PROVINCIAS } from '../data/provincias';
import { REGIONALES } from '../engine/electoral';
import { clonar, ejecutarAislado, responder } from '../engine/motor';
import { aleatorio, barajar } from '../engine/rng';
import { CARRERA, costePresencia, esEncuesta, objetivosAtaque, puntuarZona, ZONA_IDS } from '../engine/reglas';
import type { Bando, Decision, Estado, Operacion, RegionalId, Respuesta, Tarea } from '../engine/tipos';
import { RIVAL } from '../engine/tipos';
import { ESCANOS_POR_PV, pesos, valorar, valorLocal, xDe, escanosSuaves } from './evaluar';

export type Nivel = 'facil' | 'normal' | 'dificil';

interface Ctx {
  nivel: Nivel;
  rng: { rng: number };
}

const VALOR_PV = 2 * ESCANOS_POR_PV; // unidades X por PV

export function decidirIA(e: Estado, nivel: Nivel = 'normal', semilla = (Math.random() * 2 ** 31) | 0): Respuesta {
  const ctx: Ctx = { nivel, rng: { rng: semilla } };
  return politica(e, e.pendiente!, ctx, true);
}

// ————————————————————————————————————— simulación
function copiaOculta(e: Estado, b: Bando, ctx: Ctx): Estado {
  const c = clonar({ ...e, silencio: true });
  // determinización: lo que b no ve (mano rival y mazo) se rebaraja
  const rv = RIVAL[b];
  if (!e.manoVista[b]) {
    const n = c.manos[rv].length;
    const bolsa = barajar(ctx.rng, [...c.manos[rv], ...c.mazo]);
    c.manos[rv] = bolsa.slice(0, n);
    c.mazo = bolsa.slice(n);
  } else c.mazo = barajar(ctx.rng, c.mazo);
  c.rng = (aleatorio(ctx.rng) * 2 ** 31) | 0;
  return c;
}

/** Sigue la partida simulada con respuestas voraces hasta la siguiente elección de carta. */
function continuar(c: Estado, ctx: Ctx, limite = 60) {
  let n = 0;
  while (c.pendiente && !c.ganador && n++ < limite) {
    const d = c.pendiente;
    if (d.tipo === 'carta') break;
    responder(c, politica(c, d, { ...ctx, nivel: 'normal' }, false));
  }
}

function simular(e: Estado, r: Respuesta, b: Bando, ctx: Ctx): number {
  const c = copiaOculta(e, b, ctx);
  responder(c, r);
  continuar(c, ctx);
  return valorar(c, b).valor;
}

function elegirConRuido<T>(cands: { v: number; r: T }[], ctx: Ctx, top: boolean): T {
  cands.sort((a, b) => b.v - a.v);
  if (!top || ctx.nivel === 'dificil' || cands.length === 1) return cands[0].r;
  const u = aleatorio(ctx.rng);
  if (ctx.nivel === 'normal') return u < 0.85 || cands.length < 2 ? cands[0].r : cands[1].r;
  const k = Math.min(cands.length, 4);
  return cands[Math.floor(u * k)].r;
}

// ————————————————————————————————————— política
function politica(e: Estado, d: Decision, ctx: Ctx, top: boolean): Respuesta {
  switch (d.tipo) {
    case 'carta':
      if (d.proposito === 'accion') return elegirAccion(e, d, ctx);
      if (d.proposito === 'portada') return elegirPortada(e, d, ctx);
      if (d.proposito === 'debate') return { tipo: 'carta', carta: elegirParaDebate(e, d.bando, d.opciones) };
      return { tipo: 'carta', carta: elegirDescarte(e, d.bando, d.opciones) };
    case 'provincia':
      return { tipo: 'provincia', id: elegirProvincia(e, d, ctx, top) };
    case 'operacion':
      return { tipo: 'operacion', op: elegirOperacion(e, d, ctx) };
    case 'partido':
      return { tipo: 'partido', id: elegirPartido(e, d.bando, d.opciones, d.opcional) };
    case 'opcion': {
      const cands = d.opciones.map((_, i) => ({ v: simular(e, { tipo: 'opcion', i }, d.bando, ctx), r: i }));
      return { tipo: 'opcion', i: elegirConRuido(cands, ctx, top) };
    }
  }
}

function elegirAccion(e: Estado, d: Extract<Decision, { tipo: 'carta' }>, ctx: Ctx): Respuesta {
  const b = d.bando;
  const cands: { v: number; r: Respuesta }[] = [];
  const muestras = ctx.nivel === 'dificil' ? 2 : 1;
  for (const carta of d.opciones) {
    for (const uso of d.usos[carta]) {
      const r: Respuesta = { tipo: 'carta', carta, uso };
      let v = 0;
      for (let i = 0; i < muestras; i++) v += simular(e, r, b, ctx);
      v /= muestras;
      // Las cartas propias valen más como evento más adelante: pequeña prima por conservarlas si se usan para PC
      const c = CARTAS[carta];
      if (uso !== 'evento' && c.lado === b) v -= 0.004 * c.ops;
      if (uso === 'carrera' && c.lado === RIVAL[b]) v += 0.002;
      cands.push({ v, r });
    }
  }
  return elegirConRuido(cands, ctx, true);
}

/** Valor (para b) de resolver el evento de una carta ahora mismo. */
function valorEvento(e: Estado, carta: number, jugador: Bando, b: Bando, ctx: Ctx): number {
  const c = copiaOculta(e, b, ctx);
  ejecutarAislado(c, [{ t: 'evento', carta, jugador } as Tarea]);
  let n = 0;
  while (c.pendiente && !c.ganador && n++ < 40) responder(c, politica(c, c.pendiente, { ...ctx, nivel: 'normal' }, false));
  return valorar(c, b).valor;
}

function elegirPortada(e: Estado, d: Extract<Decision, { tipo: 'carta' }>, ctx: Ctx): Respuesta {
  const b = d.bando;
  const base = valorar(e, b).valor;
  const cands = d.opciones.map((carta) => {
    const c = CARTAS[carta];
    let v = valorEvento(e, carta, b, b, ctx) - base;
    if (c.lado === 'E' && e.turno === 8) v -= 0.001;
    v += 0.0005 * c.ops; // jugar antes
    return { v, r: carta };
  });
  return { tipo: 'carta', carta: elegirConRuido(cands, ctx, true), uso: 'evento' };
}

function elegirParaDebate(e: Estado, b: Bando, opciones: number[]): number {
  let mejor = opciones[0];
  let mv = -Infinity;
  for (const id of opciones) {
    const c = CARTAS[id];
    const v = c.ops + (c.lado === RIVAL[b] ? 1.5 : c.lado === b ? -1.2 : 0) + (c.retirar && c.lado === b ? -0.5 : 0);
    if (v > mv) { mv = v; mejor = id; }
  }
  void e;
  return mejor;
}

function elegirDescarte(_e: Estado, b: Bando, opciones: number[]): number | null {
  const rivales = opciones.filter((id) => CARTAS[id].lado === RIVAL[b]).sort((x, y) => CARTAS[y].ops - CARTAS[x].ops);
  return rivales[0] ?? null;
}

// ————————————————————————————————————— provincias
function tareaActual(e: Estado): Tarea {
  return e.pila[e.pila.length - 1];
}

function elegirProvincia(e: Estado, d: Extract<Decision, { tipo: 'provincia' }>, ctx: Ctx, top: boolean): string | null {
  const b = d.bando;
  const t = tareaActual(e);
  const w = pesos(e);
  let cands: { v: number; r: string | null }[];
  switch (t.t) {
    case 'ofensiva':
      cands = d.opciones.map((id) => ({ v: evOfensiva(e, id, b, t.pc + (t.votoUtil && PROV[id].escanos <= 5 ? 1 : 0), w), r: id }));
      break;
    case 'debateLocal':
      cands = d.opciones.map((id) => ({ v: evDebate(e, id, b, w), r: id }));
      if (d.opcional) cands.push({ v: 0.05, r: null });
      break;
    case 'retirar':
      cands = d.opciones.map((id) => ({ v: deltaPresencia(e, id, b, t.de === 'ambos' ? { [b]: -1, [RIVAL[b]]: -1 } : { [RIVAL[b]]: -1 }, w), r: id }));
      break;
    case 'colocar': {
      const quien: Bando = t.yo;
      cands = d.opciones.map((id) => ({ v: deltaPresencia(e, id, quien, { [quien]: 1 }, w) + bonoAcceso(e, id, quien), r: id }));
      break;
    }
    default: {
      // colocarOps (operaciones, preparación, pegada)
      cands = d.opciones.map((id) => {
        const coste = costePresencia(e, id, b);
        return { v: (deltaPresencia(e, id, b, { [b]: 1 }, w) + bonoAcceso(e, id, b)) / coste, r: id };
      });
      if (d.opcional) cands.push({ v: -0.01, r: null });
    }
  }
  if (!top && ctx.nivel === 'facil' && aleatorio(ctx.rng) < 0.3) return cands[Math.floor(aleatorio(ctx.rng) * cands.length)].r;
  return elegirConRuido(cands, ctx, top && ctx.nivel !== 'normal');
}

/** Valor de abrir una provincia nueva para colocar después (adyacencia). */
function bonoAcceso(e: Estado, id: string, b: Bando): number {
  if (e.presencia[id][b] > 0) return 0;
  const nuevos = PROV[id].vecinos.filter((v) => !PROVINCIAS.find((p) => p.id === v && (e.presencia[v][b] > 0 || p.vecinos.some((x) => e.presencia[x][b] > 0)))).length;
  return 0.08 * nuevos;
}

function deltaPresencia(e: Estado, id: string, b: Bando, cambio: Partial<Record<Bando, number>>, w = pesos(e)): number {
  const antes = valorLocal(e, id, b, w);
  const orig = { ...e.presencia[id] };
  e.presencia[id] = { P: Math.max(0, orig.P + (cambio.P ?? 0)), C: Math.max(0, orig.C + (cambio.C ?? 0)) };
  const despues = valorLocal(e, id, b, w);
  e.presencia[id] = orig;
  return despues - antes;
}

function evOfensiva(e: Estado, id: string, b: Bando, pc: number, w: ReturnType<typeof pesos>): number {
  const p = PROV[id];
  if (p.clave && e.clima <= 2) return -1000;
  const rv = RIVAL[b];
  const orig = { ...e.presencia[id] };
  const antes = valorLocal(e, id, b, w);
  let ev = 0;
  for (let d = 1; d <= 6; d++) {
    const res = d + pc - 2 * p.fidelidad;
    if (res <= 0) continue;
    const quita = Math.min(res, orig[rv]);
    e.presencia[id] = { ...orig, [rv]: orig[rv] - quita, [b]: orig[b] + res - quita } as { P: number; C: number };
    ev += (valorLocal(e, id, b, w) - antes) / 6;
  }
  e.presencia[id] = orig;
  // bajar el Clima tiene coste: deja menos margen y acerca la Ruptura
  if (p.clave) ev -= e.clima === 3 ? 1.2 : 0.4;
  return ev;
}

function evDebate(e: Estado, id: string, b: Bando, w: ReturnType<typeof pesos>): number {
  const rv = RIVAL[b];
  const orig = { ...e.presencia[id] };
  const antes = valorLocal(e, id, b, w);
  const mod = (x: Bando) => {
    let m = 0;
    for (const v of PROV[id].vecinos) {
      const pr = e.presencia[v];
      const f = PROV[v].fidelidad;
      if (x === 'C' ? pr.C - pr.P >= f : pr.P - pr.C >= f) m++;
    }
    if (orig[x] > orig[x === 'C' ? 'P' : 'C']) m++;
    if (PROV[id].feudo === x) m++;
    return m;
  };
  const mb = mod(b), mr = mod(rv);
  let ev = 0;
  for (let i = 1; i <= 6; i++) for (let j = 1; j <= 6; j++) {
    const dif = i + mb - (j + mr);
    if (dif === 0) continue;
    const nuevo = { ...orig };
    if (dif > 0) nuevo[rv] = Math.max(0, orig[rv] - dif);
    else nuevo[b] = Math.max(0, orig[b] + dif);
    e.presencia[id] = nuevo;
    ev += (valorLocal(e, id, b, w) - antes) / 36;
  }
  e.presencia[id] = orig;
  return ev;
}

// ————————————————————————————————————— operaciones y negociación
function elegirOperacion(e: Estado, d: Extract<Decision, { tipo: 'operacion' }>, ctx: Ctx): Operacion {
  const b = d.bando;
  const w = pesos(e);
  const cands: { v: number; r: Operacion }[] = [];
  const faltaExig = Math.max(0, e.clima - e.exigencia[b]);
  for (const op of d.opciones) {
    let v = 0;
    if (op === 'presencia') v = simularColocacion(e, b, d.pc, ctx);
    else if (op === 'ofensiva') {
      let mejor = -Infinity;
      const t = tareaActual(e);
      for (const id of objetivosAtaque(e, b)) {
        const pc = d.pc + (t.votoUtil && PROV[id].escanos <= 5 ? 1 : 0);
        mejor = Math.max(mejor, evOfensiva(e, id, b, pc, w));
      }
      const quedan = Math.max(1, 7 - e.rondasHechas[b]);
      v = mejor + Math.min(d.pc, faltaExig) * VALOR_PV * (quedan <= 2 ? 0.9 : 0.5);
    } else if (op === 'debate') {
      let mejor = 0;
      for (const id of objetivosAtaque(e, b)) mejor = Math.max(mejor, evDebate(e, id, b, w));
      v = mejor * d.pc * 0.8;
    } else {
      const pasos = Math.floor(d.pc / 2);
      const valores = REGIONALES.map((k) => valorNegociar(e, k, b)).sort((x, y) => y - x);
      v = valores.slice(0, pasos).reduce((a, x) => a + Math.max(0, x), 0);
    }
    cands.push({ v, r: op });
  }
  cands.sort((a, c) => c.v - a.v);
  return cands[0].r;
}

function simularColocacion(e: Estado, b: Bando, pc: number, ctx: Ctx): number {
  const c = copiaOculta(e, b, ctx);
  const w = pesos(c);
  let total = 0;
  let restante = pc;
  const t = tareaActual(e);
  const soloPeq = t.votoUtil;
  if (soloPeq) restante = pc + 1;
  for (let i = 0; i < 6 && restante > 0; i++) {
    let mejor: string | null = null;
    let mv = -Infinity;
    for (const p of PROVINCIAS) {
      if (soloPeq && p.escanos > 5) continue;
      const ok = p.id === '28' || c.presencia[p.id][b] > 0 || p.vecinos.some((v) => c.presencia[v][b] > 0);
      if (!ok) continue;
      const coste = costePresencia(c, p.id, b);
      if (coste > restante) continue;
      const v = deltaPresencia(c, p.id, b, { [b]: 1 }, w) / coste;
      if (v > mv) { mv = v; mejor = p.id; }
    }
    if (!mejor) break;
    total += mv * costePresencia(c, mejor, b);
    restante -= costePresencia(c, mejor, b);
    c.presencia[mejor][b]++;
  }
  return total;
}

function valorNegociar(e: Estado, k: RegionalId, b: Bando): number {
  const a = e.afinidad[k];
  if (b === 'P' ? a <= -3 : a >= 3) return -Infinity;
  if (e.negociado.includes(k)) return -Infinity;
  const w0 = pesos(e);
  const orig = e.afinidad[k];
  e.afinidad[k] = orig + (b === 'C' ? 1 : -1);
  const w1 = pesos(e);
  e.afinidad[k] = orig;
  let esc = 0;
  for (const id of territorioDe(k)) esc += escanosSuaves(e, id)[k] ?? 0;
  const dx = esc * ((w1[k] ?? 0) - (w0[k] ?? 0));
  let v = b === 'C' ? dx : -dx;
  if (b === 'P' && CESIONES_CARAS.includes(k)) v -= VALOR_PV;
  return v;
}

const TERR_CACHE: Partial<Record<RegionalId, string[]>> = {};
function territorioDe(k: RegionalId): string[] {
  if (!TERR_CACHE[k]) TERR_CACHE[k] = PROVINCIAS.filter((p) => (p.base[k] ?? 0) > 0).map((p) => p.id);
  return TERR_CACHE[k]!;
}

function elegirPartido(e: Estado, b: Bando, opciones: RegionalId[], opcional: boolean): RegionalId | null {
  const t = tareaActual(e);
  if (t.t === 'fuga') {
    // que pierda voto la fuerza más alejada de mí, con más escaños en juego
    let mejor = opciones[0];
    let mv = -Infinity;
    for (const k of opciones) {
      let esc = 0;
      for (const id of territorioDe(k)) esc += escanosSuaves(e, id)[k] ?? 0;
      const lejania = b === 'C' ? -e.afinidad[k] : e.afinidad[k];
      const v = esc * (lejania + 0.5);
      if (v > mv) { mv = v; mejor = k; }
    }
    return mejor;
  }
  const cands = opciones.map((k) => ({ v: valorNegociar(e, k, b), r: k }));
  cands.sort((x, y) => y.v - x.v);
  if (opcional && cands[0].v <= 0) return null;
  return cands[0].r;
}

// utilidades exportadas para la interfaz (pistas)
export function mejorZonaParaPuntuar(e: Estado, b: Bando): number {
  let mejor = 0;
  let mv = -Infinity;
  ZONA_IDS.forEach((z, i) => {
    const n = puntuarZona(e, z).neto;
    const v = b === 'C' ? n : -n;
    if (v > mv) { mv = v; mejor = i; }
  });
  return mejor;
}

export { xDe, esEncuesta, CARRERA };
