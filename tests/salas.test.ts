import { describe, expect, it } from 'vitest';
import { SALAS } from '../src/datos/salas';
import { Sala } from '../src/mundo/sala';
import { DECO } from '../src/datos/deco';
import { MARCAS, PNJS } from '../src/datos/guion';
import { JEFES } from '../src/juego/jefes';
import { Juego } from '../src/juego/juego';
import { TEMAS } from '../src/datos/temas';
import { TODO, alcance, junto } from './alcance';
import ATLAS from '../src/recursos/atlas.json';

const ids = Object.keys(SALAS);
const cuenta = (def: { mapa: string[] }, ch: string) => def.mapa.join('').split(ch).length - 1;

describe('mapas', () => {
  it('hay un buen puñado de salas', () => {
    expect(ids.length).toBeGreaterThanOrEqual(40);
  });

  it.each(ids)('%s está bien formada', (id) => {
    const def = SALAS[id];
    const ancho = def.mapa[0].length;
    for (const fila of def.mapa) expect(fila.length, `fila «${fila}»`).toBe(ancho);
    expect(TEMAS[def.tema ?? def.zona], 'tema').toBeTruthy();
    for (const [n, c, f] of def.deco ?? []) {
      expect(DECO[n], `decorado ${n}`).toBeTruthy();
      expect((ATLAS as Record<string, number[]>)[DECO[n].spr] ?? (ATLAS as Record<string, number[]>)[DECO[n].spr + '0'] ?? ['cabina', 'altar'].includes(DECO[n].spr), `sprite de ${n}`).toBeTruthy();
      expect(c >= 0 && f >= 0 && c < ancho && f < def.mapa.length, `decorado ${n} dentro del mapa`).toBe(true);
    }
    expect(cuenta(def, 'N')).toBe(def.pnj?.length ?? 0);
    expect(cuenta(def, '*')).toBe(def.marcas?.length ?? 0);
    expect(cuenta(def, 'C')).toBe(def.cofres?.length ?? 0);
    expect(cuenta(def, 'S')).toBe(def.carteles?.length ?? 0);
    expect(cuenta(def, 'm')).toBe(def.plataformas?.length ?? 0);
    for (const n of def.pnj ?? []) expect(PNJS[n], `PNJ ${n}`).toBeTruthy();
    for (const n of def.marcas ?? []) expect(MARCAS[n], `marca ${n}`).toBeTruthy();
    if (def.jefe) { expect(JEFES[def.jefe]).toBeTruthy(); expect(cuenta(def, 'J')).toBe(1); }
    // se puede cargar sin errores
    const j = new Juego(null, () => 0.5);
    j.cargarSala(id, null);
    expect(j.jug).toBeTruthy();
  });

  it.each(ids)('las puertas de %s enlazan y tienen vuelta', (id) => {
    const def = SALAS[id];
    const s = new Sala(def);
    const puertas = new Set(s.objetos.filter((o) => o.c >= '1' && o.c <= '9').map((o) => o.c));
    expect([...puertas].sort()).toEqual(Object.keys(def.puertas ?? {}).sort());
    for (const [ch, [dest, pd]] of Object.entries(def.puertas ?? {})) {
      const otra = SALAS[dest];
      expect(otra, `${id}:${ch} → ${dest}`).toBeTruthy();
      expect(otra.puertas?.[pd], `${dest} tiene la puerta ${pd}`).toBeTruthy();
      expect(otra.puertas![pd], `vuelta de ${dest}:${pd}`).toEqual([id, ch]);
      expect(cuenta(def, ch), `casillas de ${id}:${ch} y ${dest}:${pd}`).toBe(cuenta(otra, pd));
    }
  });

  it.each(ids)('en %s todo es alcanzable con el equipo completo', (id) => {
    const def = SALAS[id];
    const s = new Sala(def);
    const puertas = s.objetos.filter((o) => o.c >= '1' && o.c <= '9');
    const inicio = s.objetos.filter((o) => o.c === 'P');
    const semilla = (puertas.length ? [puertas[0]] : inicio).map((o) => o.fila * s.an + o.col);
    const m = alcance(def, semilla, TODO);
    for (const o of s.objetos) {
      const i = o.fila * s.an + o.col;
      if ('123456789P'.includes(o.c)) expect(m.visto.has(i), `puerta ${o.c} de ${id}`).toBe(true);
      else if ('CNSTLi*kph$'.includes(o.c)) expect(junto(m, i), `«${o.c}» en (${o.col},${o.fila}) de ${id}`).toBe(true);
    }
  });

  it.each(ids)('en %s nada queda metido dentro del decorado', (id) => {
    const s = new Sala(SALAS[id]);
    for (const o of s.objetos) expect(s.extra[o.fila * s.an + o.col], `«${o.c}» en (${o.col},${o.fila})`).toBe(0);
  });

  it.each(ids)('las rejas de %s tienen quien las abra', (id) => {
    const def = SALAS[id];
    const s = new Sala(def);
    const canalDe = (c: string, i: number) => def.canal?.[c]?.[i] ?? 'a';
    const fuentes = new Set<string>(['!']);
    for (const o of s.objetos) if ('pLi'.includes(o.c)) fuentes.add(canalDe(o.c, o.i));
    for (const o of s.objetos) if (o.c === 'G' || o.c === 'x') expect(fuentes.has(canalDe(o.c, o.i)), `canal de ${o.c}${o.i}`).toBe(true);
    for (const c of Object.keys(def.tiempo ?? {})) expect(s.objetos.some((o) => o.c === 'L' && canalDe('L', o.i) === c), `palanca del canal temporizado ${c}`).toBe(true);
  });
});
