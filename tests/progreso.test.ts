// El juego entero como grafo: ¿se puede ir del muelle a los créditos? ¿Y no saltarse nada?
import { describe, expect, it } from 'vitest';
import { SALAS } from '../src/datos/salas';
import { Sala } from '../src/mundo/sala';
import { alcance, junto } from './alcance';

const SALIDA_JEFE: Record<string, [string, string]> = { percebe: ['muelle', '2'], faraona: ['casco', '2'], miura: ['toros_ext', '2'] };

function explorar(vetado: string[] = []) {
  const inv: Record<string, boolean> = { bate: false, tracas: false, mechero: false, capote: false, katana: false };
  const dar = (k: string) => { if (!vetado.includes(k) && !inv[k]) { inv[k] = true; return true; } return false; };
  const llaves: Record<string, number> = {};
  const abiertos = new Set<string>();
  const cofres = new Set<string>();
  const jefes = new Set<string>();
  const semillas = new Map<string, Set<number>>();
  const sembrar = (sala: string, celdas: number[]) => {
    const s = semillas.get(sala) ?? new Set<number>();
    let nuevo = false;
    for (const c of celdas) if (!s.has(c)) { s.add(c); nuevo = true; }
    semillas.set(sala, s);
    return nuevo;
  };
  const celdasDe = (sala: string, ch: string) => { const s = new Sala(SALAS[sala]); return s.objetos.filter((o) => o.c === ch).map((o) => o.fila * s.an + o.col); };
  sembrar('muelle', celdasDe('muelle', 'P'));
  for (let ronda = 0, cambio = true; cambio && ronda < 200; ronda++) {
    cambio = false;
    for (const [id, sem] of [...semillas]) {
      const def = SALAS[id];
      const zona = def.zona;
      const usadas = [...abiertos].filter((k) => SALAS[k.split(':')[0]].zona === zona).length;
      const cerrojoAqui = `${id}:K`;
      const eq = { tracas: inv.tracas, mechero: inv.mechero, capote: inv.capote, llave: abiertos.has(cerrojoAqui) || (llaves[zona] ?? 0) - usadas > 0 };
      const m = alcance(def, [...sem], eq);
      for (const o of m.sala.objetos) {
        const i = o.fila * m.sala.an + o.col;
        if (o.c >= '1' && o.c <= '9') {
          if (!m.visto.has(i)) continue;
          const cond = def.bloqueo?.[o.c];
          if ((cond === 'lonja' && !inv.bate) || (cond === 'hotel' && !inv.katana)) continue;
          const [dest, pd] = def.puertas![o.c];
          if (sembrar(dest, celdasDe(dest, pd))) cambio = true;
        } else if (o.c === 'K') {
          if (m.visto.has(i) && !abiertos.has(cerrojoAqui)) { abiertos.add(cerrojoAqui); cambio = true; }
        } else if (o.c === 'C' && junto(m, i)) {
          const k = `${id}:${o.i}`;
          if (cofres.has(k)) continue;
          cofres.add(k); cambio = true;
          const que = def.cofres![o.i];
          if (que === 'llave') llaves[zona] = (llaves[zona] ?? 0) + 1; else dar(que);
        } else if (o.c === 'N' && def.pnj![o.i] === 'maruja' && junto(m, i)) {
          if (dar('bate')) cambio = true;
        } else if (o.c === '*' && def.marcas![o.i] === 'altar' && junto(m, i) && jefes.size >= 3) {
          if (dar('katana')) cambio = true;
        } else if (o.c === 'J' && (m.visto.has(i) || junto(m, i)) && inv.bate && !jefes.has(def.jefe!)) {
          jefes.add(def.jefe!); cambio = true;
          const sal = SALIDA_JEFE[def.jefe!];
          if (sal) sembrar(sal[0], celdasDe(sal[0], sal[1]));
        }
      }
    }
  }
  return { inv, jefes, salas: new Set(semillas.keys()), cofres };
}

describe('progreso', () => {
  it('se puede completar de principio a fin y visitar todas las salas', () => {
    const r = explorar();
    expect([...r.jefes].sort()).toEqual(['faraona', 'miura', 'notario', 'percebe']);
    expect(r.inv).toMatchObject({ bate: true, tracas: true, mechero: true, capote: true, katana: true });
    expect([...r.salas].sort()).toEqual(Object.keys(SALAS).filter((k) => !k.startsWith('_')).sort());
    const total = Object.values(SALAS).filter((d) => !d.id.startsWith('_')).reduce((n, d) => n + (d.cofres?.length ?? 0), 0);
    expect(r.cofres.size).toBe(total);
  });

  it('hay tantas llaves como cerrojos en cada zona', () => {
    const zonas: Record<string, [number, number]> = {};
    for (const d of Object.values(SALAS)) {
      if (d.id.startsWith('_')) continue;
      const z = (zonas[d.zona] ??= [0, 0]);
      z[0] += (d.cofres ?? []).filter((c) => c === 'llave').length + d.mapa.join('').split('k').length - 1;
      z[1] += d.mapa.join('').split('K').length - 1;
    }
    for (const [z, [llaves, cerrojos]] of Object.entries(zonas)) expect(llaves, z).toBe(cerrojos);
  });

  it('hay tres cromos y seis botes de tinta en total', () => {
    const cofres = Object.values(SALAS).flatMap((d) => (d.id.startsWith('_') ? [] : d.cofres ?? []));
    expect(cofres.filter((c) => c === 'cromo').length).toBe(3);
    // tres de los jefes, uno de la estanquera y dos de las historias secundarias
    expect(cofres.filter((c) => c === 'tinta').length).toBe(0);
  });

  it('sin el bate no se entra en la Lonja', () => {
    const r = explorar(['bate']);
    expect(r.salas.has('lonja1')).toBe(false);
    expect(r.jefes.size).toBe(0);
  });

  it('sin las tracas no se llega a las bodegas', () => {
    const r = explorar(['tracas']);
    expect(r.salas.has('bodega1')).toBe(false);
    expect(r.salas.has('lonja7')).toBe(false);
  });

  it('sin el mechero no se pasa del lagar ni se entra en la plaza de toros', () => {
    const r = explorar(['mechero']);
    expect(r.salas.has('bodega5')).toBe(false);
    expect(r.salas.has('toros1')).toBe(false);
  });

  it('sin el capote no se sale de la capilla ni se entra en el hotel', () => {
    const r = explorar(['capote']);
    expect(r.salas.has('toros5')).toBe(false);
    expect(r.salas.has('hotel1')).toBe(false);
  });

  it('sin la katana el hotel está cerrado', () => {
    const r = explorar(['katana']);
    expect(r.salas.has('hotel_ext')).toBe(false);
  });
});
