// Reglas puras: control, costes, objetivos válidos, efectos en curso, puntuación de zonas y Carrera Programática.
import { MADRID, PROV, PROVINCIAS, ZONAS } from '../data/provincias';
import { TERRITORIO } from '../data/partidos';
import { CARTAS } from '../data/cartas';
import { controlDe, proyectar, REGIONALES, vetoVoxActivo } from './electoral';
import type { Bando, Carta, Cond, EfectoActivo, Estado, Filtro, Negociable, Provincia, TipoEfectoActivo, Uso, ZonaId } from './tipos';
import { RIVAL } from './tipos';

export const ZONA_IDS = Object.keys(ZONAS) as ZonaId[];

// —— control ——
export function fidelidadEf(e: Estado, id: string): number {
  return PROV[id].fidelidad + (e.morado[id] ?? 0);
}

export function controla(e: Estado, id: string, b: Bando): boolean {
  const c = controlDe(PROV[id], e.presencia[id], e.morado[id] ?? 0);
  return b === 'C' ? c === 1 : c === -1;
}

export function controlador(e: Estado, id: string): Bando | null {
  const c = controlDe(PROV[id], e.presencia[id], e.morado[id] ?? 0);
  return c === 1 ? 'C' : c === -1 ? 'P' : null;
}

export function presenciaTotal(e: Estado, b: Bando): number {
  let n = 0;
  for (const p of PROVINCIAS) n += e.presencia[p.id][b];
  return n;
}

export function clavesControladas(e: Estado, b: Bando): number {
  return PROVINCIAS.filter((p) => p.clave && controla(e, p.id, b)).length;
}

export function cumpleFiltro(e: Estado, p: Provincia, f: Filtro | undefined, yo: Bando): boolean {
  if (!f) return true;
  const quien = (x: 'yo' | 'rival') => (x === 'yo' ? yo : RIVAL[yo]);
  if (f.zonas && !f.zonas.includes(p.zona)) return false;
  if (f.excluirZonas && f.excluirZonas.includes(p.zona)) return false;
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

// —— efectos en curso ——
export function efectosDe(e: Estado, tipo: TipoEfectoActivo, dueno?: Bando): EfectoActivo[] {
  return e.efectos.filter((x) => x.tipo === tipo && (dueno === undefined || x.dueno === dueno));
}

export function tieneEfecto(e: Estado, tipo: TipoEfectoActivo, dueno: Bando): boolean {
  return e.efectos.some((x) => x.tipo === tipo && x.dueno === dueno);
}

/** PC de una carta usada por operaciones, con los efectos en curso (mín. 1, máx. 5). */
export function opsEfectivos(e: Estado, b: Bando, carta: number): number {
  const base = CARTAS[carta].ops;
  if (base <= 0) return 0;
  const mas = efectosDe(e, 'masOps', b).length;
  const menos = efectosDe(e, 'menosOpsRival', RIVAL[b]).length;
  return Math.max(1, Math.min(5, base + mas - menos));
}

/** Zonas con +1 PC si todas las operaciones van allí (como Vietnam Revolts). */
export function zonasBono(e: Estado, b: Bando): ZonaId[] {
  return efectosDe(e, 'bonoZona', b).map((x) => x.zona as ZonaId);
}

/** Provincias donde se puede colocar presencia por operaciones (adyacencia o Madrid, sede nacional). */
export function elegiblesPresencia(e: Estado, b: Bando): string[] {
  const cerradas = efectosDe(e, 'cerrojo', RIVAL[b]).map((x) => x.zona);
  const res: string[] = [];
  for (const p of PROVINCIAS) {
    if (cerradas.includes(p.zona)) continue;
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

/** ¿Está protegida la provincia frente a ofensivas y debates de b? (pactos y bastiones del rival) */
export function protegida(e: Estado, id: string, b: Bando): boolean {
  const rv = RIVAL[b];
  for (const x of e.efectos) {
    if (x.dueno !== rv) continue;
    if (x.tipo === 'bastion' && x.prov === id) return true;
    if (x.tipo === 'protegeZonas' && x.zonas?.includes(PROV[id].zona) && controla(e, id, rv)) return true;
  }
  return false;
}

export function objetivosAtaque(e: Estado, b: Bando, filtro?: Filtro, ignorarClima = false): string[] {
  return PROVINCIAS.filter(
    (p) => e.presencia[p.id][RIVAL[b]] > 0 && (ignorarClima || !zonaVetada(e, p.zona)) && !protegida(e, p.id, b) && cumpleFiltro(e, p, filtro, b),
  ).map((p) => p.id);
}

/** Modificador a la tirada de ofensiva de b en una provincia por efectos en curso. */
export function modOfensiva(e: Estado, id: string, b: Bando): number {
  const z = PROV[id].zona;
  let m = 0;
  for (const x of e.efectos) {
    if (x.tipo === 'fontaneria' && x.zona === z) m += x.dueno === b ? 1 : -1;
    if (x.tipo === 'tregua') m -= 1;
  }
  return m;
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

/** Puntúa una zona. `menosClave`: bando al que la mediación le resta una provincia clave. */
export function puntuarZona(e: Estado, z: ZonaId, menosClave: Bando | null = null): PuntuacionZona {
  const provs = PROVINCIAS.filter((p) => p.zona === z);
  const fuertes = (b: Bando) => new Set(efectosDe(e, 'plazaFuerte', b).map((x) => x.prov));
  const plazas = { P: fuertes('P'), C: fuertes('C') };
  const esClave = (id: string, b: Bando) => PROV[id].clave || plazas[b].has(id);
  const cuenta = { P: 0, C: 0 };
  const claves = { P: 0, C: 0 };
  const noClaves = { P: 0, C: 0 };
  const feudos = { P: 0, C: 0 };
  const totalClaves = { P: 0, C: 0 };
  for (const b of ['P', 'C'] as Bando[]) totalClaves[b] = provs.filter((p) => esClave(p.id, b)).length;
  for (const p of provs) {
    const c = controlador(e, p.id);
    if (!c) continue;
    cuenta[c]++;
    if (esClave(p.id, c)) claves[c]++;
    else noClaves[c]++;
    if (p.feudo && p.feudo !== c) feudos[c]++;
  }
  if (menosClave && claves[menosClave] > 0) {
    claves[menosClave]--;
    noClaves[menosClave]++;
  }
  const nivel = { P: 0, C: 0 } as PuntuacionZona['nivel'];
  for (const b of ['P', 'C'] as Bando[]) {
    const r = RIVAL[b];
    if (cuenta[b] > cuenta[r] && claves[b] === totalClaves[b] && totalClaves[b] > 0) nivel[b] = 3;
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

/** España vaciada (como Southeast Asia Scoring): +1 por provincia de 3 escaños o menos controlada; Soria y Teruel, 2. */
export const DOBLE_VACIADA = ['42', '44'];
export function puntuarVaciada(e: Estado): { P: number; C: number } {
  const r = { P: 0, C: 0 };
  for (const p of PROVINCIAS) {
    if (p.escanos > 3) continue;
    const c = controlador(e, p.id);
    if (c) r[c] += DOBLE_VACIADA.includes(p.id) ? 2 : 1;
  }
  return r;
}

/** Zonas en las que el bando tiene dominio o control (para debates televisados y la cumbre). */
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
  if (puedeCarrera(e, b, opsEfectivos(e, b, id))) u.push('carrera');
  return u;
}

export function rondasDe(e: Estado, b: Bando): number {
  return (e.turno <= 3 ? 6 : 7) + (tieneVentajaCarrera(e, b, 'ronda') ? 1 : 0) + e.rondaExtra[b];
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
    case 'climaIgual': return e.clima === c.n;
    case 'rivalAventaja': return favor(r) >= c.n;
    case 'yoAventajo': return favor(yo) >= c.n;
    case 'turnoMax': return e.turno <= c.n;
    case 'humorPodemosMin': return e.podemos.humor >= c.n;
    case 'humorPodemosMax': return e.podemos.humor <= c.n;
    case 'exigenciaMas': return e.exigencia[yo] > e.exigencia[r];
    case 'exigenciaCumplida': return e.exigencia[yo] >= e.clima;
    case 'socioMin': return e.socio[c.bloque === 'yo' ? yo : r] >= c.n;
    case 'socioMax': return e.socio[c.bloque === 'yo' ? yo : r] <= c.n;
    case 'mayoriaRival': return proyectar(PROVINCIAS, e).apoyos[r] >= 176;
    case 'afinidadMin': return (yo === 'C' ? e.afinidad[c.partido] : -e.afinidad[c.partido]) >= c.n;
    case 'vetoVox': return vetoVoxActivo(e) === c.activo;
    case 'controlaMas': {
      const a = c.provs.filter((id) => controla(e, id, yo)).length;
      const b = c.provs.filter((id) => controla(e, id, r)).length;
      return a > b;
    }
    case 'masClaves': return clavesControladas(e, yo) > clavesControladas(e, r);
    case 'menosPresencia': return presenciaTotal(e, yo) < presenciaTotal(e, r);
    case 'tengoCartaRival': return e.manos[yo].some((id) => CARTAS[id].lado === r || CARTAS[id].lado === 'W');
    case 'bandera': return e.banderas.includes(c.k);
    case 'carreraDelante': return e.carrera[yo] > e.carrera[r];
    case 'carreraDetras': return e.carrera[yo] < e.carrera[r];
  }
}

export function eventoJugable(e: Estado, id: number, jugador: Bando): boolean {
  const c = CARTAS[id];
  return !c.requisito || cumpleCond(e, c.requisito, ladoEvento(c, jugador));
}
