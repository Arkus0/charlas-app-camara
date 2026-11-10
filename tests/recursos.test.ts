import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import PALETA from '../src/recursos/paleta.json';

describe('recursos', () => {
  it('el atlas solo usa colores de la paleta maestra', async () => {
    const paleta = new Set((PALETA as string[]).map((h) => parseInt(h.slice(1), 16)));
    expect(paleta.size).toBeLessThanOrEqual(256);
    for (const f of ['atlas.png', 'pj.png']) {
      const { data } = await sharp(`src/recursos/${f}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const fuera = new Set<number>();
      for (let i = 0; i < data.length; i += 4) {
        if (!data[i + 3]) continue;
        const c = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
        if (!paleta.has(c)) fuera.add(c);
      }
      expect([...fuera].map((c) => '#' + c.toString(16).padStart(6, '0')), f).toEqual([]);
    }
  });

  it('todos los colores son de 15 bits', () => {
    for (const h of PALETA as string[]) {
      for (const k of [1, 3, 5]) { const v = parseInt(h.slice(k, k + 2), 16); expect(((v & 0xf8) | (v >> 5)), h).toBe(v); }
    }
  });

  it('cada pack original figura en CREDITOS.md con su licencia', () => {
    const creditos = readFileSync('CREDITOS.md', 'utf8');
    const packs = readdirSync('recursos/originales').filter((d) => statSync(`recursos/originales/${d}`).isDirectory());
    expect(packs.length).toBeGreaterThan(0);
    for (const p of packs) {
      expect(creditos, p).toContain('`' + p + '`');
      expect(readdirSync(`recursos/originales/${p}`).some((f) => /licen[cs]/i.test(f)), `licencia de ${p}`).toBe(true);
    }
    expect(creditos).toContain('CC0');
  });
});
