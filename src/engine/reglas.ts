// Reglas puras: control, costes, objetivos válidos, puntuación de zonas y Carrera Programática.
import { MADRID, PROV, PROVINCIAS, ZONAS } from '../data/provincias';
import { TERRITORIO } from '../data/partidos';
import { CARTAS } from '../data/cartas';
import { controlDe, proyectar, REGIONALES, vetoVoxActivo } from './electoral';
import type { Bando, Carta, Cond, Estado, Filtro, Negociable, Provincia, Uso, ZonaId } from './tipos';
import { RIVAL } from './tipos';

export const ZONA_IDS = Object.keys(ZONAS) as ZonaId[];

export function controla(e: Estado, id: string, b: Bando): boolean {
  const c = controlDe(PROV[id], e.presencia[id]);
  return b === 'C' ? c === 1 : c === -1;
}

export function controlador(e: Estado, id: string): Bando | null {
  const c = controlDe(PROV[id], e.presencia[id]);
  return c === 1 ? 'C' : c === -1 ? 'P' : null;
}

export function presenciaTotal(e: Estado, b: Bando): number {
  let n = 0;
  for (const p of PROVINCIAS) n += e.presencia[p.id][b];
  return n;
}

export function cumpleFiltro(e: Estado, p: Provincia, f: Filtro | undefined, yo: Bando): boolean {
  if (!f) return true;
  if (f.zonas && !f.zonas.includes(p.zona)) return false;
  if (f.excluirZonas && f.excluirZonas.includes(p.zona)) return false;
  if (f.provs && !f.provs.includes(p.id)) return false;
  if (f.clave !== undefined && p.clave !== f.clave) return false;
  if (f.maxEscanos !== undefined && p.escanos > f.maxEscanos) return false;
  if (f.minEscanos !== undefined && p.escanos < f.minEscanos) return false;
  if (f.conPresencia && e.presencia[p.id][f.conPresencia === 'yo' ? yo : RIVAL[yo]] <= 0) return false;
  if (f.controla && !controla(e, p.id, f.controla === 'yo' ? yo : RIVAL[yo])) return false;
  if (f.feudo && p.feudo !== (f.feudo === 'yo' ? yo : RIVAL[yo])) return false;
  return true;
}

/** Provincias donde se puede colocar presencia por operaciones (adyacencia o Madrid, sede nacional). */
export function elegiblesPresencia(e: Estado, b: Bando): string[] {
  const res: string[] = [];
  for (const p of PROVINCIAS) {
    if (p.id === MADRID || e.presencia[p.id][b] > 0 || p.vecinos.some((v) => e.presencia[v]?.[b] > 0)) res.push(p.id);
  }
  return res;
}

export function costePresencia(e: Estado, id: string, b: Bando): number {
  return controla(e, id, RIVAL[b]) ? 2 : 1;
}

/** Zonas vetadas para ofensivas y debates locales según el Clima. */
export function zonaVetada(e: Estado, z: ZonaId): boolean {
  if (z === 'CAT' && e.clima <= 4) return true;
  if (z === 'NOR' && e.clima <= 3) return true;
  if (z === 'MAD' && e.clima <= 2) return true;
  return false;
}

export function objetivosAtaque(e: Estado, b: Bando, filtro?: Filtro): string[] {
  return PROVINCIAS.filter((p) => e.presencia[p.id][RIVAL[b]] > 0 && !zonaVetada(e, p.zona) && cumpleFiltro(e, p, filtro, b)).map((p) => p.id);
}

export function partidosNegociables(e: Estado, b: Bando): Negociable[] {
  const res: Negociable[] = REGIONALES.filter((k) => {
    if (e.negociado.includes(k)) return false;
    const a = e.afinidad[k];
    if (b === 'P' ? a <= -3 : a >= 3) return false;
    return TERRITORIO[k].some((id) => e.presencia[id][b] > 0);
  });
  // A Podemos solo puede cortejarlo el Progresista: nunca apoyará a Feijóo
  if (b === 'P' && !e.negociado.includes('PODEMOS') && e.podemos.humor < 3) res.unshift('PODEMOS');
  return res;
}

// —— Carrera Programática ——
export interface CasillaCarrera {
  nombre: string;
  pc: number;
  tirada: number; // éxito con d6 ≤ tirada
  pv: [number, number];
  ventaja?: 'doble' | 'portada' | 'descarte' | 'ronda';
  texto: string;
}

export const CARRERA: CasillaCarrera[] = [
  { nombre: 'Equipo de campaña', pc: 2, tirada: 3, pv: [2, 1], texto: '2 PV al primero, 1 al segundo.' },
  { nombre: 'Programa marco', pc: 2, tirada: 4, pv: [0, 0], ventaja: 'doble', texto: 'Puedes intentar la Carrera dos veces por turno (hasta que el rival llegue).' },
  { nombre: 'Argumentario', pc: 2, tirada: 3, pv: [2, 0], texto: '2 PV al primero.' },
  { nombre: 'Gabinete de prensa', pc: 2, tirada: 4, pv: [0, 0], ventaja: 'portada', texto: 'El rival elige y muestra su Portada antes que tú (hasta que llegue).' },
  { nombre: 'Microsegmentación', pc: 3, tirada: 3, pv: [3, 1], texto: '3 PV al primero, 1 al segundo.' },
  { nombre: 'Maquinaria territorial', pc: 3, tirada: 4, pv: [0, 0], ventaja: 'descarte', texto: 'Al final de cada turno puedes descartar una carta retenida (hasta que el rival llegue).' },
  { nombre: 'Relato ganador', pc: 3, tirada: 3, pv: [4, 2], texto: '4 PV al primero, 2 al segundo.' },
  { nombre: 'Campaña perfecta', pc: 4, tirada: 2, pv: [2, 0], ventaja: 'ronda', texto: '2 PV y una ronda de acción extra cada turno (hasta que el rival llegue).' },
];

export function tieneVentajaCarrera(e: Estado, b: Bando, v: CasillaCarrera['ventaja']): boolean {
  const i = CARRERA.findIndex((c) => c.ventaja === v);
  return e.carrera[b] >= i + 1 && e.carrera[RIVAL[b]] < i + 1;
}

export function intentosCarrera(e: Estado, b: Bando): number {
  return tieneVentajaCarrera(e, b, 'doble') ? 2 : 1;
}

export function puedeCarrera(e: Estado, b: Bando, ops: number): boolean {
  const sig = CARRERA[e.carrera[b]];
  return !!sig && ops >= sig.pc && e.carreraTurno[b] < intentosCarrera(e, b);
}

// —— Encuestas ——
export interface PuntuacionZona {
  nivel: { P: 0 | 1 | 2 | 3; C: 0 | 1 | 2 | 3 }; // 0 nada, 1 presencia, 2 dominio, 3 control
  claves: { P: number; C: number };
  feudos: { P: number; C: number };
  pv: { P: number; C: number };
  neto: number; // a favor del Conservador
}

export function puntuarZona(e: Estado, z: ZonaId): PuntuacionZona {
  const provs = PROVINCIAS.filter((p) => p.zona === z);
  const totalClaves = provs.filter((p) => p.clave).length;
  const cuenta = { P: 0, C: 0 };
  const claves = { P: 0, C: 0 };
  const noClaves = { P: 0, C: 0 };
  const feudos = { P: 0, C: 0 };
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
  return { nivel, claves, feudos, pv, neto: pv.C - pv.P };
}

export function puntuarCIS(e: Estado): number {
  let n = 0;
  for (const p of PROVINCIAS) {
    if (!p.clave) continue;
    const c = controlador(e, p.id);
    if (c === 'C') n++;
    else if (c === 'P') n--;
  }
  return Math.max(-3, Math.min(3, n));
}

/** Zonas en las que el bando tiene dominio o control (para debates televisados). */
export function zonasDominadas(e: Estado, b: Bando): number {
  let n = 0;
  for (const z of ZONA_IDS) if (puntuarZona(e, z).nivel[b] >= 2) n++;
  return n;
}

// —— Cartas ——
export function ladoEvento(c: Carta, jugador: Bando): Bando {
  return c.lado === 'P' || c.lado === 'C' ? c.lado : jugador;
}

export function esEncuesta(id: number): boolean {
  return CARTAS[id].lado === 'E';
}

/** ¿Usar esta carta por sus PC activa su evento? Sí si es del rival o un comodín de Podemos. */
export function eventoAjeno(id: number, b: Bando): boolean {
  const lado = CARTAS[id].lado;
  return lado === RIVAL[b] || lado === 'W';
}

export function usosCarta(e: Estado, b: Bando, id: number): Uso[] {
  const c = CARTAS[id];
  if (id === 0) return ['ops'];
  if (c.lado === 'E') return ['evento'];
  const u: Uso[] = [];
  if (c.lado !== RIVAL[b] && eventoJugable(e, id, b)) u.push('evento');
  u.push('ops');
  if (puedeCarrera(e, b, c.ops)) u.push('carrera');
  return u;
}

export function rondasDe(e: Estado, b: Bando): number {
  return (e.turno <= 3 ? 6 : 7) + (tieneVentajaCarrera(e, b, 'ronda') ? 1 : 0);
}

export function tamanoMano(turno: number): number {
  return turno <= 3 ? 8 : 9;
}

export const FECHAS: Record<number, string> = {
  1: '6–11 oct', 2: '12–18 oct', 3: '19–25 oct', 4: '26 oct–1 nov', 5: '2–8 nov', 6: '9–15 nov', 7: '16–22 nov', 8: '23–28 nov',
};

export const HITOS: Record<number, string> = {
  1: 'Convocatoria en el BOE',
  2: 'Precampaña',
  3: 'Cierre de listas el 26 oct',
  4: 'Entra el mazo de Campaña',
  5: 'Última semana de precampaña',
  6: '13N: pegada de carteles',
  7: '16N: cara a cara',
  8: '26N: debate a cuatro · veda',
};

// —— Condiciones de los eventos ——

export function cumpleCond(e: Estado, c: Cond, yo: Bando): boolean {
  const r = RIVAL[yo];
  const favor = (b: Bando) => (b === 'C' ? e.ventaja : -e.ventaja);
  switch (c.c) {
    case 'climaMin': return e.clima >= c.n;
    case 'climaMax': return e.clima <= c.n;
    case 'rivalAventaja': return favor(r) >= c.n;
    case 'yoAventajo': return favor(yo) >= c.n;
    case 'turnoMax': return e.turno <= c.n;
    case 'humorPodemosMin': return e.podemos.humor >= c.n;
    case 'socioMin': return e.socio[c.bloque === 'yo' ? yo : r] >= c.n;
    case 'socioMax': return e.socio[c.bloque === 'yo' ? yo : r] <= c.n;
    case 'mayoriaRival': return proyectar(PROVINCIAS, e).apoyos[r] >= 176;
    case 'afinidadMin': return (yo === 'C' ? e.afinidad[c.partido] : -e.afinidad[c.partido]) >= c.n;
    case 'vetoVox': return vetoVoxActivo(e) === c.activo;
    case 'soyGobierno': return yo === 'P';
    case 'controlaMas': {
      const a = c.provs.filter((id) => controla(e, id, yo)).length;
      const b = c.provs.filter((id) => controla(e, id, r)).length;
      return a > b;
    }
    case 'menosPresencia': return presenciaTotal(e, yo) < presenciaTotal(e, r);
  }
}

export function eventoJugable(e: Estado, id: number, jugador: Bando): boolean {
  const c = CARTAS[id];
  return !c.requisito || cumpleCond(e, c.requisito, ladoEvento(c, jugador));
}
