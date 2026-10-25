import { readFileSync } from 'node:fs';
import { dhondt, investir, votoPodemos, proyectar } from '../src/engine/electoral';
import { PROVINCIAS } from '../src/data/provincias';
import { AFINIDAD_INICIAL } from '../src/data/partidos';
import type { Votos } from '../src/engine/tipos';

function leer2023() {
  const filas = readFileSync(new URL('../data/fuentes/congreso_2023-07.csv', import.meta.url), 'utf-8').trim().split(/\r?\n/).map((l) => l.split(','));
  const hdr = filas[2];
  return filas.slice(3).map((r) => {
    const votos: Record<string, number> = {};
    hdr.forEach((h, i) => {
      if (i < 4 || !r[i]) return;
      votos[h === 'Voto en blanco' ? 'BLANCO' : h] = +r[i];
    });
    return { nombre: r[0], escanos: +r[3], votos };
  });
}

describe("D'Hondt", () => {
  it('reproduce exactamente los 350 escaños del 23J de 2023', () => {
    const tot: Record<string, number> = {};
    for (const p of leer2023()) {
      for (const [k, n] of Object.entries(dhondt(p.escanos, p.votos as Votos))) tot[k] = (tot[k] ?? 0) + (n ?? 0);
    }
    expect(tot).toMatchObject({ PP: 137, PSOE: 121, VOX: 33, SUMAR: 31, ERC: 7, JUNTS: 7, 'EH BILDU': 6, PNV: 5, BNG: 1, CC: 1, UPN: 1 });
    expect(Object.values(tot).reduce((a, b) => a + b, 0)).toBe(350);
  });

  it('aplica el umbral del 3% sobre votos válidos (incluido el blanco)', () => {
    const r = dhondt(5, { PP: 500, PSOE: 400, VOX: 29, BLANCO: 71 });
    expect(r.VOX).toBeUndefined();
    expect((r.PP ?? 0) + (r.PSOE ?? 0)).toBe(5);
  });

  it('reparte un ejemplo de manual', () => {
    // 7 escaños; 340k, 280k, 160k, 60k, 15k (este bajo umbral)
    expect(dhondt(7, { PP: 340, PSOE: 280, VOX: 160, SUMAR: 60, OTROS: 15 } as Votos)).toEqual({ PP: 3, PSOE: 3, VOX: 1, SUMAR: 0 });
  });
});

describe('Proyección de partida', () => {
  const vacio = Object.fromEntries(PROVINCIAS.map((p) => [p.id, { P: 0, C: 0 }]));
  const control0 = Object.fromEntries(PROVINCIAS.map((p) => [p.id, 0 as const]));
  const base = { presencia: vacio, presencia0: vacio, control0, ventaja: 0, socio: { P: 0, C: 0 }, podemos: { fuerza: 0, humor: 0, pinza: 0 }, modsProv: {}, modsPartido: {}, afinidad: AFINIDAD_INICIAL };

  it('suma 350 escaños y es plausible respecto a las encuestas', () => {
    const r = proyectar(PROVINCIAS, base);
    const total = Object.values(r.escanos).reduce((a, b) => a + (b ?? 0), 0);
    expect(total).toBe(350);
    expect(r.escanos.PP).toBeGreaterThanOrEqual(120);
    expect(r.escanos.PP).toBeLessThanOrEqual(145);
    expect(r.escanos.PSOE).toBeGreaterThanOrEqual(98);
    expect(r.escanos.VOX).toBeGreaterThanOrEqual(55);
  });

  it('la ventaja nacional mueve escaños entre bloques', () => {
    const a = proyectar(PROVINCIAS, { ...base, ventaja: -15 });
    const b = proyectar(PROVINCIAS, { ...base, ventaja: 15 });
    expect(b.bloque.C - a.bloque.C).toBeGreaterThan(30);
  });

  it('el veto de Vox impide el sí de PNV, Junts y CC al candidato conservador', () => {
    const esc: Votos = { PP: 150, VOX: 20, PNV: 6, PSOE: 120, SUMAR: 20, JUNTS: 7, ERC: 7, BILDU: 7, CC: 1, UPN: 1, BNG: 2, NC: 0 } as Votos;
    const afin = { ...AFINIDAD_INICIAL, PNV: 2, JUNTS: 2, CC: 2 };
    expect(investir(esc, 'C', afin, true).si).toBe(171);
    expect(investir(esc, 'C', afin, false).si).toBe(171 + 14);
  });
});

describe('Podemos, el comodín', () => {
  const vacio = Object.fromEntries(PROVINCIAS.map((p) => [p.id, { P: 0, C: 0 }]));
  const control0 = Object.fromEntries(PROVINCIAS.map((p) => [p.id, 0 as const]));
  const base = { presencia: vacio, presencia0: vacio, control0, ventaja: 0, socio: { P: 0, C: 0 }, podemos: { fuerza: 0, humor: 0, pinza: 0 }, modsProv: {}, modsPartido: {}, afinidad: AFINIDAD_INICIAL };

  it('no cuenta en el bloque progresista', () => {
    const r = proyectar(PROVINCIAS, base);
    expect(r.bloque.P).toBe((r.escanos.PSOE ?? 0) + (r.escanos.SUMAR ?? 0));
  });

  it('vota a Sánchez según su humor y a Feijóo no le vota sin la pinza', () => {
    const esc: Votos = { PP: 140, VOX: 30, PSOE: 120, SUMAR: 10, PODEMOS: 10, ERC: 8, BILDU: 7, BNG: 2, COMPROMIS: 3, JUNTS: 7, PNV: 5, CC: 1, UPN: 1, ADELANTE: 3, NC: 3 } as Votos;
    expect(investir(esc, 'P', AFINIDAD_INICIAL, true, { humor: 1 }).si - investir(esc, 'P', AFINIDAD_INICIAL, true, { humor: 0 }).si).toBe(10);
    expect(investir(esc, 'P', AFINIDAD_INICIAL, true, { humor: -1 }).no - investir(esc, 'P', AFINIDAD_INICIAL, true, { humor: 0 }).no).toBe(10);
    expect(investir(esc, 'C', AFINIDAD_INICIAL, true, { humor: 3 }).no).toBeGreaterThanOrEqual(10);
    // en guerra con el PSOE pero sin pinza, sigue votando no a Feijóo
    expect(votoPodemos('C', { humor: -3, pinza: 1, socioC: -3 })).toBe('no');
  });

  it('la pinza: abstención con Feijóo y, en el caso extremo, apoyo', () => {
    expect(votoPodemos('C', { humor: -2, pinza: 2, socioC: 1 })).toBe('abst');
    expect(votoPodemos('C', { humor: -1, pinza: 3, socioC: -3 })).toBe('no'); // sin guerra con el PSOE no hay pinza
    expect(votoPodemos('C', { humor: -3, pinza: 3, socioC: -1 })).toBe('abst'); // con Vox fuerte, como mucho se abstiene
    expect(votoPodemos('C', { humor: -3, pinza: 3, socioC: -2 })).toBe('si');
    expect(votoPodemos('P', { humor: -3, pinza: 3, socioC: -2 })).toBe('no');
  });

  it('su fuerza le quita voto sobre todo al bloque progresista', () => {
    const a = proyectar(PROVINCIAS, base);
    const b = proyectar(PROVINCIAS, { ...base, podemos: { fuerza: 3, humor: 0, pinza: 0 } });
    const dPod = (b.votos.PODEMOS ?? 0) - (a.votos.PODEMOS ?? 0);
    const dIzq = (a.votos.PSOE ?? 0) + (a.votos.SUMAR ?? 0) - (b.votos.PSOE ?? 0) - (b.votos.SUMAR ?? 0);
    const dDer = (a.votos.PP ?? 0) + (a.votos.VOX ?? 0) - (b.votos.PP ?? 0) - (b.votos.VOX ?? 0);
    expect(dPod).toBeGreaterThan(0);
    expect(dIzq).toBeGreaterThan(dDer);
    expect(dDer).toBeGreaterThan(0);
  });
});
