// Cada jefe contra un bot torpe pero inmortal: comprueba que sus máquinas de estados avanzan,
// que se les puede vencer y que la victoria dispara lo que debe.
import { describe, expect, it } from 'vitest';
import { JEFES } from '../src/juego/jefes';
import { entrada, juegoEn, leerTodo } from './util';

const CASOS: [string, string, string][] = [
  ['percebe', 'lonja_jefe', 'muelle'],
  ['faraona', 'bodega_jefe', 'casco'],
  ['miura', 'toros_jefe', 'toros_ext'],
];

function pelear(sala: string, tope: number) {
  const j = juegoEn(sala, '1');
  j.p.bate = true; j.p.katana = sala === 'hotel_jefe'; j.p.mechero = true; j.p.capote = true; j.p.vidaMax = j.p.vida = 18;
  const estados = new Set<string>();
  let golpesRecibidos = 0, pasos = 0;
  for (; pasos < tope; pasos++) {
    if (j.modo === 'dialogo' || j.modo === 'trans' || j.modo === 'escena') { leerTodo(j); continue; }
    if (j.modo !== 'juego') break;
    const b = j.jefe;
    if (!b) break;
    estados.add(b.est);
    if (j.p.vida < 18) { golpesRecibidos++; j.p.vida = 18; }
    const p = j.jug;
    const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy) || 1;
    const anillo = j.ents.find((e) => e.tipo === 'proy' && e.clase === 'anillo' && !e.espera && Math.abs(Math.hypot(p.x - e.x, p.y - e.y) - e.r) < 12);
    const lejos = d > 20 && !(dy > 0 && p.y > j.sala.al * 16 - 44); // sin pisar la puerta de salida
    if (p.est === 'normal') p.dir = (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 0 : 2) as 0 | 1 | 2 | 3;
    j.paso(entrada(lejos ? dx / d : 0, lejos ? dy / d : 0, [], [...(pasos % 7 === 0 && d < 30 ? ['a' as const] : []), ...(anillo && p.suelo ? ['b' as const] : [])]));
  }
  return { j, estados, golpesRecibidos, pasos };
}

describe('jefes', () => {
  it.each(CASOS)('%s cae y devuelve al jugador al pueblo', (nom, sala, vuelta) => {
    const { j, estados, pasos, golpesRecibidos } = pelear(sala, 60 * 300);
    expect(j.ban('jefe:' + nom), `vencido en ${pasos} pasos`).toBe(true);
    expect(estados.size).toBeGreaterThanOrEqual(4);
    leerTodo(j);
    for (let i = 0; i < 60; i++) { j.paso(entrada()); leerTodo(j); }
    expect(j.def.id).toBe(vuelta);
    expect(j.modo).toBe('juego');
    expect(j.p.tinta).toBe(1);
    expect(j.sellos()).toBe(1);
    console.log(`${JEFES[nom].nombre}: ${Math.round(pasos / 60)} s, ${golpesRecibidos} golpes encajados, estados: ${[...estados].join(' ')}`);
  });

  it('el Notario tiene dos fases y al caer llegan el final y los créditos', () => {
    const { j, estados, pasos, golpesRecibidos } = pelear('hotel_jefe', 60 * 400);
    console.log(`${JEFES.notario.nombre}: ${Math.round(pasos / 60)} s, ${golpesRecibidos} golpes encajados, estados: ${[...estados].join(' ')}`);
    expect(estados.has('cambio')).toBe(true);
    expect(estados.has('acecha')).toBe(true);
    expect(j.ban('jefe:notario')).toBe(true);
    for (let i = 0; i < 3000 && j.modo !== 'creditos'; i++) j.paso(entrada(0, 0, [], i % 2 ? ['a'] : []));
    expect(j.modo).toBe('creditos');
    expect(j.ban('fin')).toBe(true);
    for (let i = 0; i < 400 && j.modo !== 'titulo'; i++) j.paso(entrada(0, 0, [], i % 2 ? ['a'] : []));
    expect(j.modo).toBe('titulo');
  });
});
