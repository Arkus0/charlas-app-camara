// Los puzles contrarreloj, jugados por un bot en las salas reales, para comprobar que el tiempo alcanza.
import { describe, expect, it } from 'vitest';
import type { Juego } from '../src/juego/juego';
import { entrada, juegoEn, usar } from './util';

/** Camina hacia un punto (saltando sin parar si se pide). Devuelve los pasos gastados. */
function ir(j: Juego, x: number, y: number, tope = 600, saltando: boolean | 'borde' | 'capote' = false): number {
  let n = 0, aire = 0;
  const sala = j.def.id;
  for (; n < tope && j.def.id === sala; n++) {
    const p = j.jug;
    const dx = x - p.x, dy = y - p.y;
    if (Math.abs(dx) < 2.5 && Math.abs(dy) < 2.5) break;
    const d = Math.hypot(dx, dy);
    // 'borde': salta solo cuando lo que tiene delante es un hueco, como haría una persona
    const horiz = Math.abs(dx) > Math.abs(dy);
    const ax = p.x + (horiz ? Math.sign(dx) * 7 : 0), ay = p.y + (horiz ? 0 : Math.sign(dy) * 6);
    const hueco = j.sala.suelo(Math.floor(ax / 16), Math.floor(ay / 16)) < p.z - 4;
    const salta = saltando === 'borde' || saltando === 'capote' ? hueco && p.suelo : saltando && p.suelo;
    aire = p.suelo ? 0 : aire + 1;
    const quiebro = saltando === 'capote' && aire === 13;
    j.paso(entrada(Math.abs(dx) < 1.5 ? 0 : dx / d, Math.abs(dy) < 1.5 ? 0 : dy / d, saltando ? ['b'] : [], [...(salta ? ['b' as const] : []), ...(quiebro ? ['c' as const] : [])]));
  }
  return n;
}
const sinEnemigos = (j: Juego) => { for (const e of j.ents) if (e.tipo === 'enemigo') e.vivo = false; };
const c = (n: number) => n * 16 + 8;

describe('puzles contrarreloj', () => {
  it('cocinas del hotel: a saltos por la cinta se llega a la reja', () => {
    const j = juegoEn('hotel3', '1');
    sinEnemigos(j);
    ir(j, c(1), c(6));
    usar(j, (e) => e.tipo === 'palanca');
    expect(j.ents.find((e) => e.tipo === 'palanca')!.activo).toBe(true);
    let n = ir(j, c(2), c(5));
    n += ir(j, c(13), c(5), 400, true);
    n += ir(j, c(14), c(5));
    n += ir(j, c(14), c(1), 200);
    for (let i = 0; i < 30; i++) j.paso(entrada());
    expect(j.def.id, `en ${n} pasos`).toBe('hotel4');
    expect(n).toBeLessThan(j.def.id === 'hotel4' ? 280 : 0);
    expect(j.p.vida).toBe(6);
  });

  it('cocinas del hotel: andando contra la cinta no da tiempo', () => {
    const j = juegoEn('hotel3', '1');
    sinEnemigos(j);
    ir(j, c(1), c(6));
    usar(j, (e) => e.tipo === 'palanca');
    ir(j, c(2), c(5));
    ir(j, c(13), c(5), 600);
    ir(j, c(14), c(5));
    ir(j, c(14), c(1), 200);
    expect(j.def.id).toBe('hotel3');
  });

  it('corrales: da tiempo a correr de la palanca a la reja saltando la barrera', () => {
    const j = juegoEn('toros2', '1');
    sinEnemigos(j);
    j.p.bate = true;
    ir(j, c(13), c(7));
    usar(j, (e) => e.tipo === 'palanca');
    let n = ir(j, c(6), c(5) + 2);
    n += ir(j, c(6), c(3), 200, true);
    n += ir(j, c(2), c(3));
    n += ir(j, c(2), c(1), 200);
    for (let i = 0; i < 30; i++) j.paso(entrada());
    expect(j.def.id, `en ${n} pasos`).toBe('toros3');
  });

  it('lagar: la plataforma lleva de una orilla a la otra', () => {
    const j = juegoEn('bodega3', '1');
    sinEnemigos(j);
    const plat = j.ents.filter((e) => e.tipo === 'plataforma').find((e) => e.col === 3)!;
    ir(j, c(3), c(9));
    for (let i = 0; i < 600 && !(Math.abs(plat.y - c(8)) < 1 && plat.espera > 20); i++) j.paso(entrada());
    ir(j, c(3), c(8), 60);
    expect(j.jug.apoyo).toBe(plat);
    for (let i = 0; i < 400 && !(Math.abs(plat.y - c(4)) < 1); i++) j.paso(entrada());
    ir(j, c(3), c(3), 60);
    expect(j.jug.y).toBeLessThan(4 * 16);
    expect(j.p.vida).toBe(6);
  });

  it('canal de la Lonja: se cruza la cinta rota en los dos sentidos', () => {
    const j = juegoEn('lonja3', '1');
    sinEnemigos(j);
    ir(j, c(7), c(8));
    ir(j, c(7), c(3), 300, 'borde');
    expect(j.jug.y).toBeLessThan(4 * 16);
    expect(j.p.vida).toBe(6);
    ir(j, c(7), c(8), 400, 'borde');
    expect(j.jug.y).toBeGreaterThan(8 * 16);
    expect(j.p.vida).toBe(6);
  });

  it('tinajas: el camino de islas se puede recorrer saltando', () => {
    const j = juegoEn('bodega2', '1');
    sinEnemigos(j);
    const ruta: [number, number][] = [[13, 9], [13, 7], [9, 7], [5, 7], [5, 5], [5, 3], [12, 2]];
    for (const [x, y] of ruta) ir(j, c(x), c(y), 400, 'borde');
    expect(j.jug.y).toBeLessThan(4 * 16);
    expect(j.p.vida).toBe(6);
  });

  it('pozo ciego: el sendero entre fosos lleva hasta la llave', () => {
    const j = juegoEn('bodega6', '1');
    const ruta: [number, number][] = [[7, 9], [4, 9], [4, 7], [13, 7], [13, 3], [10, 3], [10, 5], [6, 5], [6, 1], [2, 1]];
    for (const [x, y] of ruta) ir(j, c(x), c(y), 500, 'borde');
    expect(j.jug.x).toBeLessThan(3 * 16);
    expect(j.jug.y).toBeLessThan(2 * 16);
    expect(j.p.vida).toBe(6);
  });

  it('capilla y patio de arrastre: el capote en el aire cruza los fosos anchos', () => {
    const j = juegoEn('toros4', '1');
    j.p.capote = true;
    ir(j, c(7), c(4));
    ir(j, c(7), c(9), 300, 'capote');
    expect(j.jug.y).toBeGreaterThan(9 * 16);
    expect(j.p.vida).toBe(6);
    ir(j, c(7), c(10), 100);
    for (let i = 0; i < 30; i++) j.paso(entrada());
    expect(j.def.id).toBe('toros5');
    sinEnemigos(j);
    for (const [x, y] of [[7, 2], [7, 7], [7, 13]] as [number, number][]) ir(j, c(x), c(y), 400, 'capote');
    expect(j.jug.y).toBeGreaterThan(12 * 16);
    expect(j.p.vida).toBe(6);
  });

  it('obras del hotel: la zanja y los andamios se cruzan con el capote', () => {
    const j = juegoEn('hotel_ext', '1');
    j.p.capote = true;
    ir(j, c(11), c(6));
    ir(j, c(17), c(6), 300, 'capote');
    expect(j.jug.x).toBeGreaterThan(16 * 16);
    expect(j.p.vida).toBe(6);
    const k = juegoEn('hotel4', '1');
    k.p.capote = true;
    sinEnemigos(k);
    for (const [x, y] of [[3, 6], [10, 6], [12, 5], [12, 2], [14, 1]] as [number, number][]) ir(k, c(x), c(y), 400, 'capote');
    ir(k, c(14), c(0), 100);
    for (let i = 0; i < 30; i++) k.paso(entrada());
    expect(k.def.id).toBe('hotel5');
    expect(k.p.vida).toBe(6);
  });
});
