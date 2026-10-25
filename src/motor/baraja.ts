// Mazos y manos: robar, descartar y barajar las fases nuevas.
import { CARTAS } from '../data/mazos';
import type { Bando } from './base';
import { log } from './cambios';
import { barajar } from './rng';
import type { Estado } from './tipos';

/** b roba una carta de su mazo; si está vacío, baraja su descarte. */
export function robar(e: Estado, b: Bando): boolean {
  if (e.mazos[b].length === 0) {
    if (e.descartes[b].length === 0) return false;
    e.mazos[b] = barajar(e, e.descartes[b]);
    e.descartes[b] = [];
    log(e, `El ${b === 'P' ? 'Progresista' : 'Conservador'} baraja su descarte`, 'fase', b);
  }
  const id = e.mazos[b].pop();
  if (id === undefined) return false;
  e.manos[b].push(id);
  return true;
}

/** Saca una carta de la mano (si está) y la deja en el descarte o fuera del juego. */
export function soltarCarta(e: Estado, b: Bando, id: number, retirar: boolean) {
  const i = e.manos[b].indexOf(id);
  if (i >= 0) e.manos[b].splice(i, 1);
  if (retirar) e.retiradas.push(id);
  else e.descartes[b].push(id);
}

/** Añade al mazo de cada bloque las cartas de una fase y lo baraja. */
export function anadirFase(e: Estado, fase: 2 | 3) {
  for (const b of ['P', 'C'] as Bando[]) {
    const nuevas = Object.values(CARTAS).filter((c) => c.mazo === b && c.fase === fase).map((c) => c.id);
    e.mazos[b] = barajar(e, [...e.mazos[b], ...nuevas]);
  }
}
