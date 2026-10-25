// Las cartas de «176 · La Batalla del 29N»: mazos de los bloques, Actualidad y Agenda de Podemos.
import type { Bando } from '../../motor/base';
import type { Carta } from '../../motor/tipos';
import { CARTAS_ACTUALIDAD } from './actualidad';
import { CARTAS_BLOQUES } from './bloques';
import { CARTAS_PODEMOS } from './podemos';

export const CARTAS_LISTA: Carta[] = [...CARTAS_BLOQUES, ...CARTAS_ACTUALIDAD, ...CARTAS_PODEMOS];
export const CARTAS: Record<number, Carta> = Object.fromEntries(CARTAS_LISTA.map((c) => [c.id, c]));

export function idsDeBloque(b: Bando, fase: 1 | 2 | 3): number[] {
  return CARTAS_LISTA.filter((c) => c.mazo === b && c.fase === fase).map((c) => c.id);
}

export const ACTUALIDAD_IDS: number[] = CARTAS_ACTUALIDAD.map((c) => c.id);
export const AGENDA_PODEMOS_IDS: number[] = CARTAS_PODEMOS.map((c) => c.id);

/** Id de la ilustración de una carta (las copias comunes usan la de la original). */
export const idArte = (c: Carta): number => c.arte ?? c.id;
