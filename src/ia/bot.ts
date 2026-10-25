// IA de «176»: genera las jugadas candidatas, las simula sobre una copia en la que baraja lo que no puede ver
// (la mano y el mazo del rival, las noticias y la Agenda de Podemos) y elige por la probabilidad de victoria.
// Fácil y normal miran una jugada; difícil, además, la mejor respuesta del rival.
import { CARTAS } from '../data/mazos';
import { PROV } from '../data/provincias';
import { DUENO_TEMA, TEMAS, temaPropio } from '../motor/agenda';
import { pcAccion } from '../motor/acciones';
import { clonar, responder } from '../motor/motor';
import { aleatorio, barajar } from '../motor/rng';
import { baseAtaque, DADO_ATAQUE } from '../motor/reglas';
import { bonoTemaDebate } from '../motor/semana';
import { prepararBase, valorar, type Base } from './evaluar';
import { RIVAL, type Bando } from '../motor/base';
import type { Decision, Efecto, Estado, Modo, Respuesta, Tema } from '../motor/tipos';

export type Nivel = 'facil' | 'normal' | 'dificil';

interface Parametros {
  /** candidatas que se simulan como mucho */
  tope: number;
  /** muestras de las jugadas con dados */
  muestras: number;
  /** candidatas a las que se busca la respuesta del rival (0 = ninguna) */
  replica: number;
}

const PARAMETROS: Record<Nivel, Parametros> = {
  facil: { tope: 40, muestras: 1, replica: 0 },
  normal: { tope: 90, muestras: 2, replica: 0 },
  dificil: { tope: 150, muestras: 3, replica: 8 },
};

type Accion = Extract<Respuesta, { tipo: 'accion' }>;

/** Copia sin crónica en la que se baraja todo lo que b no puede ver. */
function copiaOculta(e: Estado, b: Bando, azar: { rng: number }): Estado {
  const c = clonar({ ...e, silencio: true });
  c.cronica = { seq: 0, log: [], sucesos: [], historia: [] };
  c.silencio = true;
  const rv = RIVAL[b];
  const ocultas = barajar(azar, [...c.manos[rv], ...c.mazos[rv]]);
  c.manos[rv] = ocultas.slice(0, c.manos[rv].length);
  c.mazos[rv] = ocultas.slice(c.manos[rv].length);
  c.mazos[b] = barajar(azar, c.mazos[b]);
  c.mazos.actualidad = barajar(azar, c.mazos.actualidad);
  c.mazos.podemos = barajar(azar, c.mazos.podemos);
  c.rng = (aleatorio(azar) * 2 ** 31) | 0;
  return c;
}

const tieneDados = (r: Accion) => r.modo === 'atacar' || (r.modo === 'evento' && typeof r.carta === 'number' && JSON.stringify(CARTAS[r.carta].efectos).match(/"dado"|"duelo"/) !== null);

/** ¿Puede esta jugada bajar el Clima durante mi acción? (con el Clima en 2 sería perder por ruptura) */
function puedeBajarClima(e: Estado, b: Bando, r: Accion): boolean {
  if (r.modo === 'atacar') return !!PROV[r.destino!]?.clave && !e.efectos.some((x) => x.tipo === 'campanaLimpia' && x.dueno === b);
  if (r.modo !== 'evento' || typeof r.carta !== 'number') return false;
  const mira = (efs: Efecto[]): boolean => efs.some((f) => {
    if (f.e === 'clima') return f.n < 0 && (f.minimo ?? 1) < 2;
    if (f.e === 'si') return mira(f.entonces) || mira(f.sino ?? []);
    if (f.e === 'dado') return f.tabla.some((t) => mira(t.efectos));
    if (f.e === 'elegir') return f.opciones.some((o) => mira(o.efectos));
    if ('efectos' in f && Array.isArray(f.efectos)) return mira(f.efectos);
    return false;
  });
  return mira(CARTAS[r.carta].efectos);
}

/** Puntuación previa (barata) para recortar candidatas. */
function previa(e: Estado, b: Bando, r: Accion): number {
  const c = typeof r.carta === 'number' ? CARTAS[r.carta] : null;
  const fuerza = c?.fuerza ?? 1;
  switch (r.modo) {
    case 'evento': return 2 + fuerza * 0.4 + (r.destino && PROV[r.destino] ? PROV[r.destino].escanos / 10 : 0);
    case 'implantar': return pcAccion(e, b, r.carta, 'implantar', r.destino) * 0.9 - fuerza * 0.2;
    case 'atacar': {
      const id = r.destino!;
      const base = baseAtaque(e, b, id, pcAccion(e, b, r.carta, 'atacar', id));
      let esperado = 0;
      for (const d of DADO_ATAQUE) esperado += Math.max(0, Math.min(base + d, e.presencia[id][RIVAL[b]] + 2)) / 6;
      return esperado * (0.6 + PROV[id].escanos / 12) - (PROV[id].clave && e.clima <= 3 ? 1.5 : 0);
    }
    case 'negociar': return 1.5;
    case 'agenda': {
      const t = r.destino as Tema;
      const propio = temaPropio(e, t, b);
      return r.sentido === 'baja' ? (propio ? -5 : 1 + e.agenda.calor[t] * 0.3) : propio ? 1.6 : -3;
    }
    case 'maquinaria': return 2.5 - e.semana * 0.2;
  }
}

/** Todas las respuestas candidatas a una decisión de acción, ya recortadas. */
export function candidatas(e: Estado, d: Extract<Decision, { tipo: 'accion' }>, tope: number): Accion[] {
  const b = d.bando;
  const res: { r: Accion; v: number }[] = [];
  for (const o of d.opciones) {
    for (const [modo, destinos] of Object.entries(o.modos) as [Modo, string[]][]) {
      const lista: Accion[] = [];
      for (const destino of destinos) {
        if (modo === 'agenda') {
          lista.push({ tipo: 'accion', carta: o.carta, modo, destino, sentido: 'sube' });
          if (e.agenda.calor[destino as Tema] > 0) lista.push({ tipo: 'accion', carta: o.carta, modo, destino, sentido: 'baja' });
        } else lista.push({ tipo: 'accion', carta: o.carta, modo, destino });
      }
      // por cada carta y modo, solo los destinos más prometedores (y nunca una ruptura con el Clima en 2)
      const seguras = e.clima <= 2 ? lista.filter((r) => !puedeBajarClima(e, b, r)) : lista;
      const puntuadas = seguras.map((r) => ({ r, v: previa(e, b, r) })).sort((x, y) => y.v - x.v);
      res.push(...puntuadas.slice(0, modo === 'implantar' ? 7 : modo === 'agenda' ? 3 : 5));
    }
  }
  return res.sort((x, y) => y.v - x.v).slice(0, tope).map((x) => x.r);
}

/** Avanza la simulación resolviendo las elecciones intermedias hasta la próxima acción o debate. */
function continuar(e: Estado, base: Base, prof = 0) {
  let guarda = 0;
  while (!e.ganador && e.pendiente && e.pendiente.tipo === 'opcion' && guarda++ < 20) {
    const d = e.pendiente;
    let mejor = 0;
    if (prof < 1) {
      let mv = -Infinity;
      for (let i = 0; i < d.opciones.length; i++) {
        const c = clonar(e);
        responder(c, { tipo: 'opcion', i });
        continuar(c, base, prof + 1);
        const v = valorar(c, d.bando, base);
        if (v > mv) { mv = v; mejor = i; }
      }
    }
    responder(e, { tipo: 'opcion', i: mejor });
  }
}

/** Valor para b de aplicar r sobre la copia oculta (media de varias tiradas si hay dados). */
function simular(oculta: Estado, b: Bando, r: Respuesta, base: Base, muestras: number, azar: { rng: number }): { v: number; final: Estado | null } {
  let total = 0;
  let final: Estado | null = null;
  const n = r.tipo === 'accion' && tieneDados(r) ? muestras : 1;
  for (let i = 0; i < n; i++) {
    const c = clonar(oculta);
    c.rng = (aleatorio(azar) * 2 ** 31) | 0;
    try {
      responder(c, r);
    } catch {
      return { v: -Infinity, final: null };
    }
    continuar(c, base);
    total += valorar(c, b, base);
    final = c;
  }
  return { v: total / n, final };
}

/** Valor para b tras la mejor respuesta del rival (para la IA difícil); null si no le toca al rival. */
function trasRespuestaRival(e: Estado, b: Bando, base: Base, azar: { rng: number }): number | null {
  const d = e.pendiente;
  if (!d || d.tipo !== 'accion' || d.bando === b) return null;
  let mejor = -Infinity;
  for (const r of candidatas(e, d, 14)) mejor = Math.max(mejor, simular(e, d.bando, r, base, 1, azar).v);
  if (mejor === -Infinity) return null;
  return mejor >= 1000 ? 0 : mejor <= -1000 ? 1 : 1 - mejor;
}

function elegirConRuido<T>(ordenadas: { r: T; v: number }[], nivel: Nivel, azar: { rng: number }): T {
  if (nivel === 'facil') {
    if (aleatorio(azar) < 0.2) return ordenadas[Math.floor(aleatorio(azar) * Math.min(12, ordenadas.length))].r;
    return ordenadas[Math.floor(aleatorio(azar) * Math.min(4, ordenadas.length))].r;
  }
  if (nivel === 'normal' && ordenadas.length > 1 && aleatorio(azar) < 0.15) return ordenadas[1].r;
  return ordenadas[0].r;
}

function decidirAccion(e: Estado, d: Extract<Decision, { tipo: 'accion' }>, nivel: Nivel, azar: { rng: number }): Respuesta {
  const p = PARAMETROS[nivel];
  const b = d.bando;
  const oculta = copiaOculta(e, b, azar);
  const base = prepararBase(oculta);
  const lista = candidatas(oculta, d, p.tope);
  const valoradas: { r: Accion; v: number; final: Estado | null }[] = [];
  for (const r of lista) {
    const { v, final } = simular(oculta, b, r, base, p.muestras, azar);
    if (v > -Infinity) valoradas.push({ r, v, final });
  }
  valoradas.sort((x, y) => y.v - x.v);
  if (p.replica > 0 && valoradas.length > 1) {
    // solo se comparan entre sí las mejores, todas valoradas con la respuesta del rival
    const mejores = valoradas.slice(0, p.replica);
    for (const x of mejores) {
      if (!x.final || x.final.ganador) continue;
      const tras = trasRespuestaRival(x.final, b, base, azar);
      if (tras !== null) x.v = 0.35 * x.v + 0.65 * tras;
    }
    mejores.sort((x, y) => y.v - x.v);
    return mejores[0].r;
  }
  if (!valoradas.length) return { tipo: 'accion', carta: 'basica', modo: 'agenda', destino: TEMAS.find((t) => DUENO_TEMA[t] === b)!, sentido: 'sube' };
  return elegirConRuido(valoradas, nivel, azar);
}

function decidirOpcion(e: Estado, d: Extract<Decision, { tipo: 'opcion' }>, nivel: Nivel, azar: { rng: number }): Respuesta {
  const oculta = copiaOculta(e, d.bando, azar);
  const base = prepararBase(oculta);
  const valoradas = d.opciones.map((_, i) => ({ r: i, v: simular(oculta, d.bando, { tipo: 'opcion', i }, base, 1, azar).v })).sort((x, y) => y.v - x.v);
  return { tipo: 'opcion', i: elegirConRuido(valoradas, nivel, azar) };
}

/** Debate: la carta de más fuerza y el tema propio que más puntúa. */
function decidirDebate(e: Estado, d: Extract<Decision, { tipo: 'debate' }>, nivel: Nivel, azar: { rng: number }): Respuesta {
  const b = d.bando;
  const cartas = [...d.cartas].sort((x, y) => CARTAS[y].fuerza - CARTAS[x].fuerza);
  const carta = cartas.length ? (nivel === 'facil' ? cartas[Math.floor(aleatorio(azar) * cartas.length)] : cartas[0]) : null;
  const temas = [...TEMAS].sort((x, y) => bonoTemaDebate(e, b, y) - bonoTemaDebate(e, b, x) || Number(DUENO_TEMA[y] === b) - Number(DUENO_TEMA[x] === b));
  return { tipo: 'debate', carta, tema: temas[0] };
}

export function decidirIA(e: Estado, nivel: Nivel = 'normal', semilla = Date.now()): Respuesta {
  const d = e.pendiente;
  if (!d) throw new Error('No hay nada que decidir');
  const azar = { rng: semilla | 0 };
  switch (d.tipo) {
    case 'accion': return decidirAccion(e, d, nivel, azar);
    case 'opcion': return decidirOpcion(e, d, nivel, azar);
    case 'debate': return decidirDebate(e, d, nivel, azar);
  }
}
