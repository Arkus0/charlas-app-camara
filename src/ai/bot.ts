// IA de «176»: voraz con simulación del resultado de cada jugada.
// No mira la mano del rival ni el orden del mazo (se barajan en cada simulación) ni los dados futuros.
import { CARTAS } from '../data/cartas';
import { CESIONES_CARAS } from '../data/partidos';
import { PROV, PROVINCIAS } from '../data/provincias';
import { REGIONALES } from '../engine/electoral';
import { clonar, ejecutarAislado, responder } from '../engine/motor';
import { aleatorio, barajar } from '../engine/rng';
import {
  CARRERA, controla, costePresencia, esEncuesta, fidelidadEf, modOfensiva, objetivosAtaque, puntuarZona, tieneEfecto, ZONA_IDS, zonasBono,
} from '../engine/reglas';
import type { Bando, Decision, Estado, Negociable, Operacion, Respuesta, Tarea } from '../engine/tipos';
import { RIVAL } from '../engine/tipos';
import { ESCANOS_POR_PV, pesos, valorar, valorLocal, xDe, escanosSuaves } from './evaluar';

export type Nivel = 'facil' | 'normal' | 'dificil';

interface Ctx {
  nivel: Nivel;
  rng: { rng: number };
  /** profundidad de simulación: dentro de una simulación no se abren otras (sería exponencial) */
  prof: number;
}

const VALOR_PV = 2 * ESCANOS_POR_PV; // unidades X por PV
const MAX_PROF = 1;

export function decidirIA(e: Estado, nivel: Nivel = 'normal', semilla = (Math.random() * 2 ** 31) | 0): Respuesta {
  const ctx: Ctx = { nivel, rng: { rng: semilla }, prof: 0 };
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
  c.agenda = barajar(ctx.rng, c.agenda);
  c.rng = (aleatorio(ctx.rng) * 2 ** 31) | 0;
  return c;
}

/** Sigue la partida simulada con respuestas voraces hasta la siguiente elección de carta. */
function continuar(c: Estado, ctx: Ctx, limite = 60) {
  let n = 0;
  const sub: Ctx = { ...ctx, nivel: 'normal', prof: ctx.prof + 1 };
  while (c.pendiente && !c.ganador && n++ < limite) {
    const d = c.pendiente;
    if (d.tipo === 'carta' && (d.proposito === 'accion' || d.proposito === 'portada')) break;
    responder(c, politica(c, d, sub, false));
  }
}

function simular(e: Estado, r: Respuesta, b: Bando, ctx: Ctx): number {
  const c = copiaOculta(e, b, ctx);
  responder(c, r);
  continuar(c, ctx);
  return valorar(c, b).valor;
}

const puedeSimular = (ctx: Ctx) => ctx.prof < MAX_PROF;

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
      if (d.proposito === 'accion' || d.proposito === 'jugar') return elegirAccion(e, d, ctx);
      if (d.proposito === 'portada') return elegirPortada(e, d, ctx);
      if (d.proposito === 'debate') return { tipo: 'carta', carta: elegirParaDebate(e, d.bando, d.opciones) };
      if (d.proposito === 'descarte') return { tipo: 'carta', carta: elegirDescarte(e, d.bando, d.opciones) };
      return { tipo: 'carta', carta: elegirCarta(e, d, ctx, top) };
    case 'provincia':
      return { tipo: 'provincia', id: elegirProvincia(e, d, ctx, top) };
    case 'operacion':
      return { tipo: 'operacion', op: elegirOperacion(e, d, ctx) };
    case 'partido':
      return { tipo: 'partido', id: elegirPartido(e, d.bando, d.opciones, d.opcional) };
    case 'opcion': {
      if (!puedeSimular(ctx)) return { tipo: 'opcion', i: opcionSinSimular(e, d) };
      const cands = d.opciones.map((_, i) => ({ v: simular(e, { tipo: 'opcion', i }, d.bando, ctx), r: i }));
      return { tipo: 'opcion', i: elegirConRuido(cands, ctx, top) };
    }
  }
}

/** Respuesta rápida a una opción dentro de una simulación. */
function opcionSinSimular(e: Estado, d: Extract<Decision, { tipo: 'opcion' }>): number {
  const t = tareaActual(e);
  // con un bono de PC, tomarlo si hay sitio donde usarlo; jamás forzar una gran coalición a ciegas
  if (t.t === 'colocarOps' || t.t === 'debateLocal') return d.opciones.length > 1 ? 1 : 0;
  if (t.t === 'granCoalicion') return 1;
  if (t.t === 'olimpiadas') return e.clima <= 2 ? 0 : 0;
  if (t.t === 'crisisDesactivar') return 0;
  if (t.t === 'fijarClima') return e.clima <= 2 ? 3 : Math.max(0, e.clima - 2);
  return 0;
}

function elegirAccion(e: Estado, d: Extract<Decision, { tipo: 'carta' }>, ctx: Ctx): Respuesta {
  const b = d.bando;
  if (!puedeSimular(ctx)) {
    // dentro de una simulación: la carta de más PC por sus PC, salvo que el evento sea propio
    let mejor: Respuesta = { tipo: 'carta', carta: d.opciones[0], uso: d.usos[d.opciones[0]][0] };
    let mv = -Infinity;
    for (const carta of d.opciones) {
      const c = CARTAS[carta];
      for (const uso of d.usos[carta]) {
        const v = uso === 'evento' ? (c.lado === b ? 2.5 : 0.5) : uso === 'ops' ? c.ops - (c.lado === RIVAL[b] || c.lado === 'W' ? 1.5 : 0) : 0.8;
        if (v > mv) { mv = v; mejor = { tipo: 'carta', carta, uso }; }
      }
    }
    return mejor;
  }
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
      if (uso === 'carrera' && (c.lado === RIVAL[b] || c.lado === 'W')) v += 0.002;
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
  const sub: Ctx = { ...ctx, nivel: 'normal', prof: ctx.prof + 1 };
  while (c.pendiente && !c.ganador && n++ < 40) responder(c, politica(c, c.pendiente, sub, false));
  return valorar(c, b).valor;
}

function elegirPortada(e: Estado, d: Extract<Decision, { tipo: 'carta' }>, ctx: Ctx): Respuesta {
  const b = d.bando;
  if (!puedeSimular(ctx)) {
    const propias = d.opciones.filter((id) => CARTAS[id].lado === b || CARTAS[id].lado === 'E');
    const lista = propias.length ? propias : d.opciones;
    return { tipo: 'carta', carta: lista.sort((x, y) => CARTAS[y].ops - CARTAS[x].ops)[0] };
  }
  const base = valorar(e, b).valor;
  const cands = d.opciones.map((carta) => {
    const c = CARTAS[carta];
    let v = valorEvento(e, carta, b, b, ctx) - base;
    if (c.lado === 'E' && e.turno === 8) v -= 0.001;
    if (c.transfuga && c.lado === b) v += 0.02; // anular la Portada rival
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
    const v = c.ops + (c.lado === RIVAL[b] ? 1.5 : c.lado === 'W' ? 0.8 : c.lado === b ? -1.2 : 0) + (c.retirar && c.lado === b ? -0.5 : 0);
    if (v > mv) { mv = v; mejor = id; }
  }
  void e;
  return mejor;
}

function elegirDescarte(_e: Estado, b: Bando, opciones: number[]): number | null {
  const peso = (id: number) => (CARTAS[id].lado === RIVAL[b] ? 10 : 0) + CARTAS[id].ops;
  const molestas = opciones.filter((id) => CARTAS[id].lado === RIVAL[b] || CARTAS[id].lado === 'W').sort((x, y) => peso(y) - peso(x));
  return molestas[0] ?? null;
}

/** Cartas para atascos, la Junta, el topo, bloqueos, intercambios y rescates del descarte. */
function elegirCarta(e: Estado, d: Extract<Decision, { tipo: 'carta' }>, ctx: Ctx, top: boolean): number | null {
  const b = d.bando;
  const opciones: (number | null)[] = [...d.opciones];
  if (d.opcional) opciones.push(null);
  if (puedeSimular(ctx) && opciones.length <= 14) {
    const cands = opciones.map((carta) => ({ v: simular(e, { tipo: 'carta', carta }, b, ctx), r: carta }));
    return elegirConRuido(cands, ctx, top);
  }
  // heurística rápida
  const c = (id: number) => CARTAS[id];
  const ajena = (id: number) => c(id).lado === RIVAL[b] || c(id).lado === 'W';
  const orden = [...d.opciones];
  switch (d.proposito) {
    case 'atasco': // deshacerse de lo que menos sirve: cartas del rival, luego las de menos PC
      orden.sort((x, y) => (ajena(y) ? 10 : 0) - (ajena(x) ? 10 : 0) || c(x).ops - c(y).ops);
      return orden[0];
    case 'junta': // la carta ajena de más PC
      orden.sort((x, y) => c(y).ops - c(x).ops);
      return orden[0];
    case 'topo': // quitarle al rival su mejor carta propia
      orden.sort((x, y) => (c(y).lado === RIVAL[b] ? 10 : 0) + c(y).ops - ((c(x).lado === RIVAL[b] ? 10 : 0) + c(x).ops));
      return orden[0];
    case 'entregar': // darle cartas mías (su evento me favorece si las usa) de pocos PC
      orden.sort((x, y) => (c(y).lado === b ? 10 : 0) - (c(x).lado === b ? 10 : 0) || c(x).ops - c(y).ops);
      return orden[0];
    case 'recuperar':
      orden.sort((x, y) => (c(y).lado === b ? 10 : 0) + c(y).ops - ((c(x).lado === b ? 10 : 0) + c(x).ops));
      return orden[0];
    case 'bloqueo': { // descartar la carta menos útil si la hay
      const ajenas = orden.filter(ajena).sort((x, y) => c(x).ops - c(y).ops);
      return ajenas[0] ?? orden.sort((x, y) => c(x).ops - c(y).ops)[0] ?? null;
    }
  }
  return d.opcional ? null : orden[0];
}

// ————————————————————————————————————— provincias
function tareaActual(e: Estado): Tarea {
  return e.pila[e.pila.length - 1];
}

type Cambio = Partial<Record<Bando, number>>;

function elegirProvincia(e: Estado, d: Extract<Decision, { tipo: 'provincia' }>, ctx: Ctx, top: boolean): string | null {
  const b = d.bando;
  const t = tareaActual(e);
  const w = pesos(e);
  const rv = RIVAL[b];
  let cands: { v: number; r: string | null }[];
  switch (t.t) {
    case 'ofensiva':
      cands = d.opciones.map((id) => {
        const bono = (t.votoUtil && PROV[id].escanos <= 5) || zonasBono(e, b).includes(PROV[id].zona) ? 1 : 0;
        return { v: evOfensiva(e, id, b, t.pc + bono, w, !!t.sinClima), r: id };
      });
      break;
    case 'debateLocal':
      cands = d.opciones.map((id) => ({ v: evDebate(e, id, b, w), r: id }));
      if (d.opcional) cands.push({ v: 0.05, r: null });
      break;
    case 'retirar':
      cands = d.opciones.map((id) => ({ v: deltaPresencia(e, id, b, t.de === 'ambos' ? { [b]: -1, [rv]: -1 } : { [rv]: -1 }, w), r: id }));
      break;
    case 'colocar': {
      const quien: Bando = t.yo;
      cands = d.opciones.map((id) => ({ v: deltaPresencia(e, id, quien, { [quien]: 1 }, w) + bonoAcceso(e, id, quien), r: id }));
      break;
    }
    case 'batalla':
      cands = d.opciones.map((id) => ({ v: evBatalla(e, id, b, w), r: id }));
      break;
    case 'provinciaUnica':
      cands = d.opciones.map((id) => {
        const pr = e.presencia[id];
        let nuevo: { P: number; C: number };
        if (t.accion === 'tomar') nuevo = { ...pr, [rv]: 0, [b]: Math.max(pr[b], fidelidadEf(e, id)) } as any;
        else if (t.accion === 'igualar') nuevo = { ...pr, [b]: pr[rv] } as any;
        else if (t.accion === 'escandalo') nuevo = { ...pr, [rv]: 0, [b]: pr[b] + t.poner } as any;
        else nuevo = { ...pr, [rv]: 0 } as any;
        return { v: deltaAbsoluto(e, id, b, nuevo, w), r: id };
      });
      break;
    case 'duplicar':
      cands = d.opciones.map((id) => ({ v: deltaPresencia(e, id, b, { [b]: e.presencia[id][b] }, w), r: id }));
      break;
    case 'mover':
      if (t.origen === null) {
        // sacar de donde menos duele, si compensa lo que se gana en el mejor destino
        const perdida = d.opciones.map((id) => ({ v: deltaPresencia(e, id, b, { [b]: -1 }, w), r: id as string | null }));
        perdida.sort((x, y) => y.v - x.v);
        let ganancia = -Infinity;
        for (const p of PROVINCIAS) if (!controla(e, p.id, rv)) ganancia = Math.max(ganancia, deltaPresencia(e, p.id, b, { [b]: 1 }, w));
        if (!perdida.length || perdida[0].v + ganancia <= 0.02) return null;
        return perdida[0].r;
      }
      cands = d.opciones.map((id) => ({ v: deltaPresencia(e, id, b, { [b]: 1 }, w), r: id }));
      break;
    case 'colocarOps':
      cands = d.opciones.map((id) => {
        const coste = costePresencia(e, id, b);
        return { v: (deltaPresencia(e, id, b, { [b]: 1 }, w) + bonoAcceso(e, id, b)) / coste, r: id };
      });
      if (d.opcional) cands.push({ v: -0.01, r: null });
      break;
    default: {
      // activarElegir, morado y cualquier otra: simular si se puede; si no, la provincia más grande
      if (puedeSimular(ctx) && d.opciones.length <= 16) {
        cands = d.opciones.map((id) => ({ v: simular(e, { tipo: 'provincia', id }, b, ctx), r: id }));
        if (d.opcional) cands.push({ v: simular(e, { tipo: 'provincia', id: null }, b, ctx), r: null });
      } else cands = d.opciones.map((id) => ({ v: PROV[id].escanos, r: id }));
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

function deltaPresencia(e: Estado, id: string, b: Bando, cambio: Cambio, w = pesos(e)): number {
  const orig = e.presencia[id];
  return deltaAbsoluto(e, id, b, { P: Math.max(0, orig.P + (cambio.P ?? 0)), C: Math.max(0, orig.C + (cambio.C ?? 0)) }, w);
}

function deltaAbsoluto(e: Estado, id: string, b: Bando, nuevo: { P: number; C: number }, w = pesos(e)): number {
  const antes = valorLocal(e, id, b, w);
  const orig = { ...e.presencia[id] };
  e.presencia[id] = nuevo;
  const despues = valorLocal(e, id, b, w);
  e.presencia[id] = orig;
  return despues - antes;
}

/** ¿Baja el Clima una ofensiva de b en esta provincia? */
function ofensivaBajaClima(e: Estado, id: string, b: Bando, sinClima: boolean): boolean {
  return PROV[id].clave && !sinClima && !tieneEfecto(e, 'campanaLimpia', b);
}

function evOfensiva(e: Estado, id: string, b: Bando, pc: number, w: ReturnType<typeof pesos>, sinClima = false): number {
  const rv = RIVAL[b];
  // con la crisis institucional del rival en vigor, lanzar una ofensiva es perder
  if (tieneEfecto(e, 'crisis', rv)) return -1000;
  const baja = ofensivaBajaClima(e, id, b, sinClima);
  if (baja && e.clima <= 2) return -1000;
  const fid = fidelidadEf(e, id);
  const mod = modOfensiva(e, id, b);
  const orig = { ...e.presencia[id] };
  const antes = valorLocal(e, id, b, w);
  let ev = 0;
  for (let d = 1; d <= 6; d++) {
    const res = d + pc + mod - 2 * fid;
    if (res <= 0) continue;
    const quita = Math.min(res, orig[rv]);
    e.presencia[id] = { ...orig, [rv]: orig[rv] - quita, [b]: orig[b] + res - quita } as { P: number; C: number };
    ev += (valorLocal(e, id, b, w) - antes) / 6;
  }
  e.presencia[id] = orig;
  // bajar el Clima tiene coste: deja menos margen y acerca la Ruptura
  if (baja) ev -= e.clima === 3 ? 1.2 : 0.4;
  if (tieneEfecto(e, 'jovenes', rv)) ev -= VALOR_PV;
  return ev;
}

function evBatalla(e: Estado, id: string, b: Bando, w: ReturnType<typeof pesos>): number {
  const rv = RIVAL[b];
  const mod = PROV[id].vecinos.filter((v) => controla(e, v, rv)).length;
  const exito = Math.max(0, Math.min(6, 6 - (3 + mod))) / 6; // d6 − mod ≥ 4
  const pr = e.presencia[id];
  const ganado = deltaAbsoluto(e, id, b, { ...pr, [b]: pr[b] + pr[rv], [rv]: 0 } as any, w) + VALOR_PV * 2;
  return exito * ganado;
}

function evDebate(e: Estado, id: string, b: Bando, w: ReturnType<typeof pesos>): number {
  const rv = RIVAL[b];
  const orig = { ...e.presencia[id] };
  const antes = valorLocal(e, id, b, w);
  const mod = (x: Bando) => {
    let m = 0;
    for (const v of PROV[id].vecinos) if (controla(e, v, x)) m++;
    if (orig[x] > orig[RIVAL[x]]) m++;
    if (PROV[id].feudo === x) m++;
    if (tieneEfecto(e, 'sombra', RIVAL[x])) m--;
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
  const t = tareaActual(e);
  for (const op of d.opciones) {
    let v = 0;
    if (op === 'presencia') v = simularColocacion(e, b, d.pc, ctx);
    else if (op === 'ofensiva') {
      let mejor = -Infinity;
      for (const id of objetivosAtaque(e, b)) {
        const bono = (t.votoUtil && PROV[id].escanos <= 5) || zonasBono(e, b).includes(PROV[id].zona) ? 1 : 0;
        mejor = Math.max(mejor, evOfensiva(e, id, b, d.pc + bono, w));
      }
      const quedan = Math.max(1, 7 - e.rondasHechas[b]);
      v = mejor + Math.min(d.pc, faltaExig) * VALOR_PV * (quedan <= 2 ? 0.9 : 0.5);
    } else if (op === 'debate') {
      let mejor = 0;
      for (const id of objetivosAtaque(e, b)) mejor = Math.max(mejor, evDebate(e, id, b, w));
      v = mejor * d.pc * 0.8;
    } else {
      const pasos = Math.floor(d.pc / 2);
      const valores = [...REGIONALES, 'PODEMOS' as const].map((k) => valorNegociar(e, k, b)).sort((x, y) => y - x);
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
  const cerradas = c.efectos.filter((x) => x.tipo === 'cerrojo' && x.dueno === RIVAL[b]).map((x) => x.zona);
  for (let i = 0; i < 6 && restante > 0; i++) {
    let mejor: string | null = null;
    let mv = -Infinity;
    for (const p of PROVINCIAS) {
      if (soloPeq && p.escanos > 5) continue;
      if (cerradas.includes(p.zona)) continue;
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

/** Valor (en X, para b) de acercar 1 a una fuerza. `sinCoste`: por evento (sin límite por turno ni cesiones). */
function valorNegociar(e: Estado, k: Negociable, b: Bando, sinCoste = false): number {
  if (k === 'PODEMOS') {
    if (b !== 'P' || e.podemos.humor >= 3 || (!sinCoste && e.negociado.includes(k))) return -Infinity;
    const w0 = pesos(e).PODEMOS ?? 0;
    e.podemos.humor++;
    const w1 = pesos(e).PODEMOS ?? 0;
    e.podemos.humor--;
    let esc = 0;
    for (const id of territorioDe('PODEMOS')) esc += escanosSuaves(e, id).PODEMOS ?? 0;
    return -esc * (w1 - w0) - (sinCoste ? 0 : VALOR_PV);
  }
  const a = e.afinidad[k];
  if (b === 'P' ? a <= -3 : a >= 3) return -Infinity;
  if (!sinCoste && e.negociado.includes(k)) return -Infinity;
  const w0 = pesos(e);
  const orig = e.afinidad[k];
  e.afinidad[k] = orig + (b === 'C' ? 1 : -1);
  const w1 = pesos(e);
  e.afinidad[k] = orig;
  let esc = 0;
  for (const id of territorioDe(k)) esc += escanosSuaves(e, id)[k] ?? 0;
  const dx = esc * ((w1[k] ?? 0) - (w0[k] ?? 0));
  let v = b === 'C' ? dx : -dx;
  if (!sinCoste && b === 'P' && CESIONES_CARAS.includes(k)) v -= VALOR_PV;
  return v;
}

const TERR_CACHE: Partial<Record<Negociable, string[]>> = {};
function territorioDe(k: Negociable): string[] {
  if (!TERR_CACHE[k]) TERR_CACHE[k] = PROVINCIAS.filter((p) => (p.base[k] ?? 0) > 0).map((p) => p.id);
  return TERR_CACHE[k]!;
}

function elegirPartido(e: Estado, b: Bando, opciones: Negociable[], opcional: boolean): Negociable | null {
  const t = tareaActual(e);
  if (t.t === 'fuga') {
    // que pierda voto la fuerza más alejada de mí, con más escaños en juego
    let mejor = opciones[0];
    let mv = -Infinity;
    for (const k of opciones) {
      if (k === 'PODEMOS') continue;
      let esc = 0;
      for (const id of territorioDe(k)) esc += escanosSuaves(e, id)[k] ?? 0;
      const lejania = b === 'C' ? -e.afinidad[k] : e.afinidad[k];
      const v = esc * (lejania + 0.5);
      if (v > mv) { mv = v; mejor = k; }
    }
    return mejor;
  }
  const sinCoste = t.t === 'afinElegir';
  const cands = opciones.map((k) => ({ v: valorNegociar(e, k, b, sinCoste), r: k }));
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
