// Reglas puras: control, filtros, ataques, negociación, encuestas, condiciones y PC de las cartas.
import { CARTAS } from '../data/mazos';
import { CESIONES_CARAS, TERRITORIO } from '../data/partidos';
import { PROV, PROVINCIAS, ZONAS } from '../data/provincias';
import { RIVAL, type Bando, type Negociable, type Provincia, type ZonaId } from './base';
import { controlDe, PINZA_APOYO, proyectar, REGIONALES } from './electoral';
import { estaEnAgenda, temaPropio, dominante } from './agenda';
import { tiene } from './maquinaria';
import type { Cond, Estado, Filtro, TipoEfectoActivo } from './tipos';

export { CESIONES_CARAS };

export const ZONA_IDS = Object.keys(ZONAS) as ZonaId[];
/** Con la Ventaja en este tope hay vuelco y la partida termina. */
export const TOPE_VENTAJA = 25;
export const TOPE_ENCUESTA = 5;
export const MAX_POR_PROVINCIA = 2; // presencia por provincia en una misma acción de Implantar

type ConPresencia = Pick<Estado, 'presencia' | 'morado'>;

// —— control ——
export function fidelidadEf(e: ConPresencia, id: string): number {
  return PROV[id].fidelidad + (e.morado[id] ?? 0);
}

export function controlador(e: ConPresencia, id: string): Bando | null {
  const c = controlDe(PROV[id], e.presencia[id], e.morado[id] ?? 0);
  return c === 1 ? 'C' : c === -1 ? 'P' : null;
}

export function controla(e: ConPresencia, id: string, b: Bando): boolean {
  return controlador(e, id) === b;
}

export function presenciaTotal(e: ConPresencia, b: Bando): number {
  let n = 0;
  for (const p of PROVINCIAS) n += e.presencia[p.id][b];
  return n;
}

export function clavesControladas(e: ConPresencia, b: Bando): number {
  return PROVINCIAS.filter((p) => p.clave && controla(e, p.id, b)).length;
}

/** Vecinas que controla b (bonificación de ataque). */
export function vecinasControladas(e: ConPresencia, id: string, b: Bando): number {
  return PROV[id].vecinos.filter((v) => PROV[v] && controla(e, v, b)).length;
}

/** Presencia que le falta a b para controlar la provincia. */
export function faltaParaControlar(e: ConPresencia, id: string, b: Bando): number {
  const pr = e.presencia[id];
  return Math.max(0, pr[RIVAL[b]] + fidelidadEf(e, id) - pr[b]);
}

export function cumpleFiltro(e: ConPresencia, p: Provincia, f: Filtro | undefined, yo: Bando): boolean {
  if (!f) return true;
  const quien = (x: 'yo' | 'rival') => (x === 'yo' ? yo : RIVAL[yo]);
  if (f.zonas && !f.zonas.includes(p.zona)) return false;
  if (f.provs && !f.provs.includes(p.id)) return false;
  if (f.clave !== undefined && p.clave !== f.clave) return false;
  if (f.maxEscanos !== undefined && p.escanos > f.maxEscanos) return false;
  if (f.minEscanos !== undefined && p.escanos < f.minEscanos) return false;
  if (f.maxFidelidad !== undefined && fidelidadEf(e, p.id) > f.maxFidelidad) return false;
  if (f.conPresencia && e.presencia[p.id][quien(f.conPresencia)] <= 0) return false;
  if (f.controla && !controla(e, p.id, quien(f.controla))) return false;
  if (f.noControla && controla(e, p.id, quien(f.noControla))) return false;
  if (f.sinControl && controlador(e, p.id) !== null) return false;
  if (f.vacia && e.presencia[p.id].P + e.presencia[p.id].C > 0) return false;
  if (f.feudo && p.feudo !== quien(f.feudo)) return false;
  return true;
}

// —— efectos en vigor ——
export function tieneEfecto(e: Pick<Estado, 'efectos'>, tipo: TipoEfectoActivo, dueno: Bando): boolean {
  return e.efectos.some((x) => x.tipo === tipo && x.dueno === dueno);
}

export function cuentaEfecto(e: Pick<Estado, 'efectos'>, tipo: TipoEfectoActivo, dueno: Bando): number {
  return e.efectos.filter((x) => x.tipo === tipo && x.dueno === dueno).length;
}

// —— Clima y ataques ——
/** Zonas donde no se puede atacar según el Clima. */
export function zonaVetada(e: Pick<Estado, 'clima'>, z: ZonaId): boolean {
  if (z === 'CAT' && e.clima <= 4) return true;
  if (z === 'NOR' && e.clima <= 3) return true;
  if (z === 'MAD' && e.clima <= 2) return true;
  return false;
}

export function protegida(e: Pick<Estado, 'efectos'>, id: string, b: Bando): boolean {
  return e.efectos.some((x) => x.tipo === 'bastion' && x.prov === id && x.dueno === RIVAL[b]);
}

export function objetivosAtaque(e: Pick<Estado, 'presencia' | 'clima' | 'efectos'>, b: Bando): string[] {
  return PROVINCIAS.filter((p) => e.presencia[p.id][RIVAL[b]] > 0 && !zonaVetada(e, p.zona) && !protegida(e, p.id, b)).map((p) => p.id);
}

/** El dado de ataque: más estable que un d6 para que una acción fallida no sea una acción perdida. */
export const DADO_ATAQUE = [-2, -1, 0, 0, 1, 2];

/** Lo que suma un ataque antes del dado: PC + vecinas que controlas + 1 − Fidelidad (+1 con Datos 2). */
export function baseAtaque(e: Pick<Estado, 'presencia' | 'morado' | 'maquinaria'>, b: Bando, id: string, pc: number): number {
  return pc + vecinasControladas(e, id, b) + 1 - fidelidadEf(e, id) + (tiene(e as Estado, b, 'datos', 2) ? 1 : 0);
}

// —— negociación ——
export function partidosNegociables(e: Pick<Estado, 'negociado' | 'afinidad' | 'presencia' | 'podemos'>, b: Bando): Negociable[] {
  const res: Negociable[] = REGIONALES.filter((k) => {
    if (e.negociado[b].includes(k)) return false;
    const a = e.afinidad[k];
    if (b === 'P' ? a <= -3 : a >= 3) return false;
    return TERRITORIO[k].some((id) => e.presencia[id][b] > 0);
  });
  // A Podemos lo corteja el Progresista; el Conservador solo puede tejer la pinza con Podemos en guerra con el PSOE
  if (!e.negociado[b].includes('PODEMOS')) {
    if (b === 'P' && (e.podemos.humor < 3 || e.podemos.pinza > 0)) res.unshift('PODEMOS');
    if (b === 'C' && e.podemos.humor <= -2 && e.podemos.pinza < PINZA_APOYO) res.unshift('PODEMOS');
  }
  return res;
}

// —— encuestas ——
export interface PuntuacionZona {
  nivel: { P: 0 | 1 | 2 | 3; C: 0 | 1 | 2 | 3 }; // 0 nada, 1 presencia, 2 dominio, 3 control
  claves: { P: number; C: number };
  feudos: { P: number; C: number };
  pv: { P: number; C: number };
  neto: number; // a favor del Conservador, con tope
}

export function puntuarZona(e: ConPresencia, z: ZonaId): PuntuacionZona {
  const provs = PROVINCIAS.filter((p) => p.zona === z);
  const cuenta = { P: 0, C: 0 };
  const claves = { P: 0, C: 0 };
  const noClaves = { P: 0, C: 0 };
  const feudos = { P: 0, C: 0 };
  const totalClaves = provs.filter((p) => p.clave).length;
  for (const p of provs) {
    const c = controlador(e, p.id);
    if (!c) continue;
    cuenta[c]++;
    if (p.clave) claves[c]++;
    else noClaves[c]++;
    if (p.feudo && p.feudo !== c) feudos[c]++;
  }
  const nivel = { P: 0, C: 0 } as PuntuacionZona['nivel'];
  for (const b of ['P', 'C'] as Bando[]) {
    const r = RIVAL[b];
    if (cuenta[b] > cuenta[r] && claves[b] === totalClaves && totalClaves > 0) nivel[b] = 3;
    else if (cuenta[b] > cuenta[r] && claves[b] > claves[r] && claves[b] > 0 && noClaves[b] > 0) nivel[b] = 2;
    else if (cuenta[b] > 0) nivel[b] = 1;
  }
  const valores = ZONAS[z].pv;
  const pv = {
    P: (nivel.P ? valores[nivel.P - 1] : 0) + claves.P + feudos.P,
    C: (nivel.C ? valores[nivel.C - 1] : 0) + claves.C + feudos.C,
  };
  const neto = Math.max(-TOPE_ENCUESTA, Math.min(TOPE_ENCUESTA, pv.C - pv.P));
  return { nivel, claves, feudos, pv, neto };
}

/** Barómetro del CIS: balance de provincias clave controladas (máx. 3). */
export function puntuarCIS(e: ConPresencia): number {
  let n = 0;
  for (const p of PROVINCIAS) {
    if (!p.clave) continue;
    const c = controlador(e, p.id);
    if (c === 'C') n++;
    else if (c === 'P') n--;
  }
  return Math.max(-3, Math.min(3, n));
}

// —— la partida ——
export function lider(e: Pick<Estado, 'ventaja'>): Bando {
  return e.ventaja > 0 ? 'C' : 'P';
}

export function favor(e: Pick<Estado, 'ventaja'>, b: Bando): number {
  return b === 'C' ? e.ventaja : -e.ventaja;
}

export function accionesSemana(semana: number): number {
  return semana <= 3 ? 3 : 4;
}

export function tamanoMano(e: Estado, b: Bando): number {
  return tiene(e, b, 'datos', 3) ? 6 : 5;
}

export const FECHAS: Record<number, string> = {
  1: '6–11 oct', 2: '12–18 oct', 3: '19–25 oct', 4: '26 oct–1 nov', 5: '2–8 nov', 6: '9–15 nov', 7: '16–22 nov', 8: '23–28 nov',
};

export const HITOS: Record<number, string> = {
  1: 'Convocatoria en el BOE',
  2: 'Precampaña',
  3: 'Cierre de listas el 26 oct',
  4: 'Llegan las cartas de campaña',
  5: 'Última semana de precampaña',
  6: '13N: pegada de carteles',
  7: '16N: cara a cara',
  8: '26N: debate a cuatro · veda',
};

// —— PC de una carta ——
/** PC de una carta jugada como campaña: fuerza, +1 si su tema está en agenda y los efectos en vigor (1-6). */
export function pcCarta(e: Estado, b: Bando, id: number): number {
  const c = CARTAS[id];
  if (!c || c.fuerza <= 0) return 0;
  const agenda = estaEnAgenda(e, c.tema) ? 1 : 0;
  const mas = cuentaEfecto(e, 'masPC', b);
  const menos = cuentaEfecto(e, 'menosPCRival', RIVAL[b]);
  return Math.max(1, Math.min(6, c.fuerza + agenda + mas - menos));
}

// —— condiciones de los eventos ——
export function cumpleCond(e: Estado, c: Cond, yo: Bando): boolean {
  const r = RIVAL[yo];
  switch (c.c) {
    case 'climaMin': return e.clima >= c.n;
    case 'climaMax': return e.clima <= c.n;
    case 'rivalAventaja': return favor(e, r) >= c.n;
    case 'yoAventajo': return favor(e, yo) >= c.n;
    case 'humorPodemosMin': return e.podemos.humor >= c.n;
    case 'humorPodemosMax': return e.podemos.humor <= c.n;
    case 'mayoriaRival': return proyectar(PROVINCIAS, e).apoyos[r] >= 176;
    case 'masClaves': return clavesControladas(e, yo) > clavesControladas(e, r);
    case 'menosPresencia': return presenciaTotal(e, yo) < presenciaTotal(e, r);
    case 'temaEnAgenda': return estaEnAgenda(e, c.tema);
    case 'temaPropioDominante': {
      const d = dominante(e);
      return d !== null && temaPropio(e, d, yo);
    }
  }
}
