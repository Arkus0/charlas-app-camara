// La Agenda: siete temas con calor (0-5). Cada bloque es dueño de tres; la Corrupción apunta al último salpicado.
// Los dos temas más calientes están «en agenda» (+1 PC a sus cartas) y el dominante da PV a su dueño al cerrar la semana.
import { RIVAL, type Bando } from './base';
import type { Tema } from './tipos';

export const TEMAS: Tema[] = ['VIV', 'SER', 'DER', 'ECO', 'INM', 'ESP', 'COR'];

export const NOMBRE_TEMA: Record<Tema, string> = {
  VIV: 'Vivienda',
  SER: 'Servicios públicos',
  DER: 'Derechos e igualdad',
  ECO: 'Economía',
  INM: 'Inmigración y seguridad',
  ESP: 'Unidad de España',
  COR: 'Corrupción',
};

export const CORTO_TEMA: Record<Tema, string> = {
  VIV: 'Vivienda', SER: 'Servicios', DER: 'Derechos', ECO: 'Economía', INM: 'Inmigración', ESP: 'España', COR: 'Corrupción',
};

/** Dueño natural de cada tema (la Corrupción no tiene: castiga al salpicado). */
export const DUENO_TEMA: Record<Tema, Bando | null> = { VIV: 'P', SER: 'P', DER: 'P', ECO: 'C', INM: 'C', ESP: 'C', COR: null };

/** Tema espejo en el otro bloque: las parejas de cartas lo respetan. */
export const ESPEJO_TEMA: Record<Tema, Tema> = { VIV: 'ECO', ECO: 'VIV', SER: 'INM', INM: 'SER', DER: 'ESP', ESP: 'DER', COR: 'COR' };

export const CALOR_MAX = 5;

export interface EstadoAgenda {
  agenda: { calor: Record<Tema, number>; reciente: Record<Tema, number>; corrupcion: Bando | null };
}

/** Temas ordenados de más a menos caliente; a igual calor, el que se calentó más recientemente. */
export function temasOrdenados(e: EstadoAgenda): Tema[] {
  const { calor, reciente } = e.agenda;
  return [...TEMAS].sort((a, b) => calor[b] - calor[a] || reciente[b] - reciente[a] || TEMAS.indexOf(a) - TEMAS.indexOf(b));
}

/** Los dos temas en agenda (con calor 1 o más). */
export function enAgenda(e: EstadoAgenda): Tema[] {
  return temasOrdenados(e).filter((t) => e.agenda.calor[t] > 0).slice(0, 2);
}

export function estaEnAgenda(e: EstadoAgenda, t: Tema): boolean {
  return enAgenda(e).includes(t);
}

/** El tema dominante: el más caliente (con calor 1 o más). */
export function dominante(e: EstadoAgenda): Tema | null {
  const t = temasOrdenados(e)[0];
  return e.agenda.calor[t] > 0 ? t : null;
}

/** Quién se beneficia de que se hable de un tema. La Corrupción favorece al rival del salpicado. */
export function duenoTema(e: EstadoAgenda, t: Tema): Bando | null {
  if (t === 'COR') return e.agenda.corrupcion ? RIVAL[e.agenda.corrupcion] : null;
  return DUENO_TEMA[t];
}

/** ¿El tema es «propio» para b? (de su bloque, o la Corrupción cuando apunta al rival) */
export function temaPropio(e: EstadoAgenda, t: Tema, b: Bando): boolean {
  return duenoTema(e, t) === b;
}
