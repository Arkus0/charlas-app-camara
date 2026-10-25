// Constructores de cartas: efectos breves, parejas espejo y cartas de los mazos comunes.
import type { Bando } from '../../motor/base';
import type { Carta, Cond, Destino, Efecto, Filtro, Tema, TipoEfectoActivo, ZonaId } from '../../motor/tipos';

export const URBANAS = ['28', '08', '46', '29', '41', '07'];
export const GALICIA = ['15', '27', '32', '36'];

export const pv = (n: number): Efecto => ({ e: 'pv', n });
export const clima = (n: number, minimo?: number): Efecto => ({ e: 'clima', n, minimo });
export const colocar = (n: number, o: { maxPor?: number; filtro?: Filtro; reparto?: boolean } = {}): Efecto => ({ e: 'colocar', n, ...o });
export const retirar = (n: number, o: { maxPor?: number; filtro?: Filtro; de?: 'rival' | 'ambos'; reparto?: boolean } = {}): Efecto => ({ e: 'retirar', n, ...o });
export const socio = (bloque: 'yo' | 'rival' | Bando, n: number): Efecto => ({ e: 'socio', bloque, n });
export const podemos = (fuerza: number, humor: number, pinza = 0): Efecto => ({ e: 'podemos', fuerza, humor, pinza });
export const si = (cond: Cond, entonces: Efecto[], sino?: Efecto[]): Efecto => ({ e: 'si', cond, entonces, sino });
export const como = (bando: Bando | 'rival', efectos: Efecto[]): Efecto => ({ e: 'como', bando, efectos });
export const elegir = (opciones: [string, Efecto[]][], quien?: 'yo' | 'rival'): Efecto => ({ e: 'elegir', quien, opciones: opciones.map(([texto, efectos]) => ({ texto, efectos })) });
export const activar = (tipo: TipoEfectoActivo, hasta: 'semana' | 'partida', extra: { zona?: ZonaId; prov?: string; enDestino?: boolean } = {}): Efecto => ({ e: 'activar', tipo, hasta, ...extra });
export const calor = (n: number, tema?: Tema): Efecto => ({ e: 'calor', n, tema });
export const salpicar = (quien: 'yo' | 'rival' = 'rival'): Efecto => ({ e: 'salpicar', quien });
export const dado = (tabla: [number, Efecto[]][]): Efecto => ({ e: 'dado', tabla: tabla.map(([hasta, efectos]) => ({ hasta, efectos })) });

/** Media carta: lo que cambia entre la versión progresista y la conservadora. */
export interface Mitad {
  nombre: string;
  texto: string;
  contexto: string;
  tema: Tema;
  efectos: Efecto[];
  destino?: Destino;
  requisito?: Cond;
}

export interface Comun {
  fuerza: number;
  fase: 1 | 2 | 3;
  retirar?: boolean;
  noticia?: boolean;
}

/** Pareja espejo: la misma carta para cada bloque, con la misma fuerza, fase y tipo de tema (propio, del rival o corrupción). */
export function espejo(idP: number, idC: number, comun: Comun, def: (b: Bando) => Mitad): Carta[] {
  return [
    { ...comun, ...def('P'), id: idP, mazo: 'P', pareja: idC },
    { ...comun, ...def('C'), id: idC, mazo: 'C', pareja: idP },
  ];
}

/** Carta común a los dos mazos: el Conservador recibe una copia (id + 1000). */
export function enAmbos(id: number, comun: Comun, def: (b: Bando) => Mitad): Carta[] {
  return espejo(id, id + 1000, comun, def);
}

/** Noticia de la semana (mazo de Actualidad): se resuelve sola como si la jugara quien lidera la Ventaja. */
export function noticia(id: number, tema: Tema, d: Omit<Mitad, 'tema'>): Carta {
  return { ...d, id, tema, fuerza: 0, fase: 1, mazo: 'actualidad', noticia: true };
}

/** Carta de la Agenda de Podemos: la sufre quien lidera la Ventaja («tú»). */
export function morada(id: number, tema: Tema, d: Omit<Mitad, 'tema'>): Carta {
  return { ...d, id, tema, fuerza: 0, fase: 1, mazo: 'podemos' };
}
