// La Maquinaria de campaña: tres ramas de tres niveles que se suben descartando cartas.
// Para alcanzar el nivel N hace falta una carta de fuerza N + 1. Una vez por semana.
import type { Bando } from './base';
import type { Rama } from './tipos';

export const RAMAS: Rama[] = ['calle', 'medios', 'datos'];

export const NOMBRE_RAMA: Record<Rama, string> = { calle: 'Calle', medios: 'Medios', datos: 'Datos' };

export const VENTAJAS: Record<Rama, [string, string, string]> = {
  calle: ['Implantar: +1 PC', 'La acción básica da 2 PC', '+1 acción cada semana'],
  medios: ['Marcar agenda: +1 de calor', 'Tu tema dominante da +1 PV más', '+2 en los debates televisados'],
  datos: ['Ves la próxima noticia', 'Atacar: +1', 'Robas hasta 6 cartas'],
};

/** PV para quien completa primero una rama. */
export const PV_RAMA_COMPLETA = 2;

export interface EstadoMaquinaria {
  maquinaria: Record<Bando, Record<Rama, number>>;
  maquinariaUsada: Record<Bando, boolean>;
}

export function nivel(e: EstadoMaquinaria, b: Bando, r: Rama): number {
  return e.maquinaria[b][r];
}

export function tiene(e: EstadoMaquinaria, b: Bando, r: Rama, n: number): boolean {
  return e.maquinaria[b][r] >= n;
}

/** Fuerza mínima de la carta para subir la rama un nivel. */
export function fuerzaParaSubir(e: EstadoMaquinaria, b: Bando, r: Rama): number {
  return e.maquinaria[b][r] + 2;
}

export function puedeSubir(e: EstadoMaquinaria, b: Bando, r: Rama, fuerza: number): boolean {
  return !e.maquinariaUsada[b] && e.maquinaria[b][r] < 3 && fuerza >= fuerzaParaSubir(e, b, r);
}
