// Intérprete de los efectos de las cartas. Cada evento se resuelve con un contexto: quién lo juega («yo»),
// la carta y, si la carta lo pide, el destino elegido y el reparto de la presencia.
import { CARTAS } from '../data/mazos';
import { PARTIDOS } from '../data/partidos';
import { PROV, PROVINCIAS } from '../data/provincias';
import { RIVAL, type Bando, type RegionalId } from './base';
import { REGIONALES } from './electoral';
import { decidir, encolar, type Paso, type Tarea } from './nucleo';
import {
  calentar, cambiarClima, cambiarPodemos, cambiarPresencia, cambiarSocio, log, moverAfinidad, N, pv, salpicar, suceso,
} from './cambios';
import { robar } from './baraja';
import { aleatorio } from './rng';
import { clavesControladas, controla, controlador, cumpleCond, cumpleFiltro, faltaParaControlar, lider } from './reglas';
import { repartoSugerido } from './valor';
import type { Efecto, Estado, Respuesta, Tema } from './tipos';

export interface Contexto {
  yo: Bando;
  carta: number;
  destino?: string;
  reparto?: Record<string, number>;
}

export function tareaEfectos(lista: Efecto[], ctx: Contexto): Tarea {
  return { t: 'efectos', lista, i: 0, ...ctx };
}

const d6 = (e: Estado) => 1 + Math.floor(aleatorio(e) * 6);

/** Provincias del destino: las de la zona elegida o la provincia elegida. */
export function provinciasDestino(destino: string | undefined): string[] | null {
  if (!destino) return null;
  if (PROV[destino]) return [destino];
  const enZona = PROVINCIAS.filter((p) => p.zona === destino).map((p) => p.id);
  return enZona.length ? enZona : null;
}

/** Candidatas de un efecto de colocar o retirar con el filtro y, si reparte, limitadas al destino. */
export function candidatas(e: Estado, ef: Extract<Efecto, { e: 'colocar' | 'retirar' }>, ctx: Contexto): string[] {
  const area = ef.reparto ? provinciasDestino(ctx.destino) : null;
  const yo = ctx.yo;
  return PROVINCIAS.filter((p) => {
    if (area && !area.includes(p.id)) return false;
    if (!cumpleFiltro(e, p, ef.filtro, yo)) return false;
    if (ef.e === 'retirar') {
      const pr = e.presencia[p.id];
      if ((ef.de ?? 'rival') === 'rival' ? pr[RIVAL[yo]] <= 0 : pr.P + pr.C <= 0) return false;
    }
    return true;
  }).map((p) => p.id);
}

/** Comprueba un reparto dado por el jugador. Lanza un error si no es válido. */
export function validarReparto(reparto: Record<string, number>, cands: string[], total: number, maxPor: number, coste: (id: string) => number = () => 1) {
  let gasto = 0;
  let puntos = 0;
  for (const [id, n] of Object.entries(reparto)) {
    if (!Number.isInteger(n) || n < 0) throw new Error('Reparto no válido');
    if (n === 0) continue;
    if (!cands.includes(id)) throw new Error(`No se puede repartir en ${PROV[id]?.nombre ?? id}`);
    if (n > maxPor) throw new Error(`Como mucho ${maxPor} por provincia`);
    gasto += n * coste(id);
    puntos += n;
  }
  if (gasto > total) throw new Error('El reparto supera los puntos disponibles');
  if (puntos === 0 && cands.length > 0 && total > 0) throw new Error('El reparto está vacío');
}

function plantarMorado(e: Estado, id: string, n: number) {
  const antes = controlador(e, id);
  const nuevo = Math.max(0, Math.min(2, (e.morado[id] ?? 0) + n));
  if (nuevo === (e.morado[id] ?? 0)) return;
  e.morado[id] = nuevo;
  log(e, `Podemos ${n > 0 ? 'planta un marcador morado en' : 'retira un marcador morado de'} ${PROV[id].nombre}`);
  const despues = controlador(e, id);
  if (antes !== despues) suceso(e, { s: 'control', prov: id, antes, despues });
}

/** La provincia más grande que controla b (opcionalmente, en una zona). */
function mayorControlada(e: Estado, b: Bando, zona?: string): string | null {
  const ps = PROVINCIAS.filter((p) => (!zona || p.zona === zona) && controla(e, p.id, b) && (e.morado[p.id] ?? 0) < 2).sort((a, c) => c.escanos - a.escanos);
  return ps[0]?.id ?? null;
}

/** Aplica un efecto. Devuelve true si ha encolado subtareas (el bucle debe ceder). */
function aplicar(e: Estado, ef: Efecto, ctx: Contexto): boolean {
  const yo = ctx.yo;
  const rv = RIVAL[yo];
  switch (ef.e) {
    case 'pv': pv(e, yo, ef.n); return false;
    case 'clima': cambiarClima(e, ef.n, ef.minimo); return false;
    case 'colocar': {
      const cands = candidatas(e, ef, ctx);
      const maxPor = ef.maxPor ?? ef.n;
      let reparto: Record<string, number>;
      if (ef.reparto && ctx.reparto) {
        validarReparto(ctx.reparto, cands, ef.n, maxPor);
        reparto = ctx.reparto;
      } else {
        reparto = repartoSugerido(e, yo, cands, ef.n, { maxPor });
      }
      for (const [id, n] of Object.entries(reparto)) cambiarPresencia(e, id, yo, n);
      return false;
    }
    case 'retirar': {
      const cands = candidatas(e, ef, ctx);
      const maxPor = ef.maxPor ?? ef.n;
      if ((ef.de ?? 'rival') === 'ambos') {
        // cada bloque pierde presencia: en las provincias elegidas o, si no, en las de más escaños
        let provs: [string, number][];
        if (ef.reparto && ctx.reparto) {
          validarReparto(ctx.reparto, cands, ef.n, maxPor);
          provs = Object.entries(ctx.reparto);
        } else {
          provs = [];
          let queda = ef.n;
          for (const id of [...cands].sort((a, b) => PROV[b].escanos - PROV[a].escanos)) {
            if (queda <= 0) break;
            const k = Math.min(maxPor, queda);
            provs.push([id, k]);
            queda -= k;
          }
        }
        for (const [id, n] of provs) for (const b of ['P', 'C'] as Bando[]) cambiarPresencia(e, id, b, -n);
        return false;
      }
      let reparto: Record<string, number>;
      if (ef.reparto && ctx.reparto) {
        validarReparto(ctx.reparto, cands, ef.n, maxPor);
        reparto = ctx.reparto;
      } else {
        reparto = repartoSugerido(e, yo, cands, ef.n, { maxPor, quitar: true });
      }
      for (const [id, n] of Object.entries(reparto)) cambiarPresencia(e, id, rv, -Math.min(n, e.presencia[id][rv]));
      return false;
    }
    case 'retirarTodo': {
      const provs = ef.provs ?? (ef.enDestino ? provinciasDestino(ctx.destino) ?? [] : []);
      for (const id of provs) {
        cambiarPresencia(e, id, rv, -e.presencia[id][rv]);
        if (ef.de === 'ambos') cambiarPresencia(e, id, yo, -e.presencia[id][yo]);
      }
      return false;
    }
    case 'controlar': {
      const id = ef.prov ?? ctx.destino;
      if (id && PROV[id]) cambiarPresencia(e, id, yo, faltaParaControlar(e, id, yo));
      return false;
    }
    case 'tomar': {
      const id = ctx.destino;
      if (!id || !PROV[id]) return false;
      cambiarPresencia(e, id, rv, -e.presencia[id][rv]);
      cambiarPresencia(e, id, yo, faltaParaControlar(e, id, yo));
      return false;
    }
    case 'igualar': {
      const id = ctx.destino;
      if (!id || !PROV[id]) return false;
      cambiarPresencia(e, id, yo, Math.max(0, e.presencia[id][rv] - e.presencia[id][yo]));
      return false;
    }
    case 'como': {
      const b = ef.bando === 'rival' ? rv : ef.bando;
      encolar(e, tareaEfectos(ef.efectos, { ...ctx, yo: b }));
      return true;
    }
    case 'aLider':
      encolar(e, tareaEfectos(ef.efectos, { ...ctx, yo: lider(e) }));
      return true;
    case 'aRezagado':
      encolar(e, tareaEfectos(ef.efectos, { ...ctx, yo: RIVAL[lider(e)] }));
      return true;
    case 'aCadaBloque': {
      const l = lider(e);
      encolar(e, tareaEfectos(ef.efectos, { ...ctx, yo: RIVAL[l] }), tareaEfectos(ef.efectos, { ...ctx, yo: l }));
      return true;
    }
    case 'alQueControlaMas': {
      const n = (b: Bando) => ef.provs.filter((id) => controla(e, id, b)).length;
      const nP = n('P'), nC = n('C');
      if (nP === nC) {
        log(e, 'Empate: nadie se lleva el efecto');
        return false;
      }
      encolar(e, tareaEfectos(ef.efectos, { ...ctx, yo: nP > nC ? 'P' : 'C' }));
      return true;
    }
    case 'socio': {
      const b = ef.bloque === 'yo' ? yo : ef.bloque === 'rival' ? rv : ef.bloque;
      cambiarSocio(e, b, ef.n);
      return false;
    }
    case 'podemos': cambiarPodemos(e, ef.fuerza ?? 0, ef.humor ?? 0, ef.pinza ?? 0); return false;
    case 'morado': {
      if (ef.prov) plantarMorado(e, ef.prov, ef.n);
      else {
        const quienes: Bando[] = ef.de === 'ambos' ? [RIVAL[lider(e)], lider(e)] : [lider(e)];
        for (const b of quienes) {
          const id = mayorControlada(e, b, ef.zona);
          if (id) plantarMorado(e, id, ef.n);
        }
      }
      return false;
    }
    case 'afinidad': {
      const partido = (ef.partido ?? ctx.destino) as RegionalId | undefined;
      if (partido && REGIONALES.includes(partido)) moverAfinidad(e, partido, yo, ef.n);
      return false;
    }
    case 'afinidadNeutral': {
      const a = e.afinidad[ef.partido];
      if (a !== 0) moverAfinidad(e, ef.partido, a > 0 ? 'P' : 'C', 1);
      return false;
    }
    case 'regional': {
      const partido = (ef.partido ?? ctx.destino) as RegionalId | undefined;
      if (!partido) return false;
      e.modsPartido[partido] = (e.modsPartido[partido] ?? 0) + ef.pct;
      log(e, `${PARTIDOS[partido].siglas}: su voto ${ef.pct > 0 ? 'crece' : 'cae'} un ${Math.round(Math.abs(ef.pct) * 100)}%`);
      return false;
    }
    case 'calor': {
      const t = (ef.tema ?? ctx.destino) as Tema | undefined;
      if (t) calentar(e, t, ef.n);
      return false;
    }
    case 'salpicar': salpicar(e, ef.quien === 'yo' ? yo : rv); return false;
    case 'robar':
      for (let i = 0; i < ef.n; i++) robar(e, yo);
      return false;
    case 'descarteAzar': {
      const mano = e.manos[rv];
      if (!mano.length) return false;
      const i = Math.floor(aleatorio(e) * mano.length);
      const [id] = mano.splice(i, 1);
      e.descartes[rv].push(id);
      log(e, `El ${N(rv)} pierde una carta: «${CARTAS[id].nombre}»`, undefined, rv);
      return false;
    }
    case 'activar':
      e.efectos.push({
        tipo: ef.tipo, dueno: yo, hasta: ef.hasta, carta: ctx.carta,
        zona: ef.enDestino ? (ctx.destino as Estado['efectos'][number]['zona']) : ef.zona,
        prov: ef.enDestino ? ctx.destino : ef.prov,
      });
      return false;
    case 'acciones': {
      const antes = e.acciones[yo];
      e.acciones[yo] = Math.max(0, antes + ef.n);
      const d = e.acciones[yo] - antes;
      if (d > 0) log(e, `El ${N(yo)} gana ${d} acción${d > 1 ? 'es' : ''} extra esta semana`, undefined, yo);
      else if (d < 0) log(e, `El ${N(yo)} pierde ${-d} acción${d < -1 ? 'es' : ''} esta semana`, undefined, yo);
      return false;
    }
    case 'pvPorClaves': pv(e, yo, Math.min(ef.max, clavesControladas(e, yo))); return false;
    case 'si': {
      const rama = cumpleCond(e, ef.cond, yo) ? ef.entonces : ef.sino ?? [];
      if (!rama.length) return false;
      encolar(e, tareaEfectos(rama, ctx));
      return true;
    }
    case 'elegir':
      encolar(e, { t: 'elegir', quien: ef.quien === 'rival' ? rv : yo, opciones: ef.opciones, ctx });
      return true;
    case 'dado': {
      const v = d6(e);
      log(e, `Dado: ${v}`, 'dado', yo);
      suceso(e, { s: 'dado', bando: yo, valor: v });
      const fila = ef.tabla.find((f) => v <= f.hasta);
      if (!fila?.efectos.length) return false;
      encolar(e, tareaEfectos(fila.efectos, ctx));
      return true;
    }
    case 'duelo': {
      const a = d6(e), b = d6(e);
      log(e, `Dados: ${N(yo)} ${a} · ${N(rv)} ${b}`, 'dado');
      if (a !== b) pv(e, a > b ? yo : rv, ef.pv);
      return false;
    }
  }
}

export const pasosEfectos: Record<string, Paso<Estado, Respuesta>> = {
  efectos(e, t) {
    const ctx: Contexto = { yo: t.yo, carta: t.carta, destino: t.destino, reparto: t.reparto };
    while (t.i < t.lista.length) {
      if (e.ganador) return true;
      const ef = t.lista[t.i++] as Efecto;
      if (aplicar(e, ef, ctx)) return false;
    }
    return true;
  },
  elegir(e, t, r) {
    if (!r) {
      const c = CARTAS[t.ctx.carta];
      return decidir(e, { tipo: 'opcion', bando: t.quien, texto: c ? `«${c.nombre}»: elige` : 'Elige', opciones: t.opciones.map((o: { texto: string }) => o.texto), carta: t.ctx.carta });
    }
    if (r.tipo !== 'opcion') throw new Error('Se esperaba una opción');
    const o = t.opciones[r.i];
    log(e, `El ${N(t.quien)} elige: ${o.texto}`, undefined, t.quien);
    if (o.efectos.length) encolar(e, tareaEfectos(o.efectos, { ...t.ctx, yo: t.quien }));
    return true;
  },
};
