import { crearPartida, responder } from '../src/engine/motor';
import { CARTAS_LISTA } from '../src/data/cartas';
import { PROVINCIAS } from '../src/data/provincias';
import { respuestaAzar } from '../src/ai/azar';

function jugarAzar(semilla: number) {
  const e = crearPartida(semilla);
  const rng = { rng: semilla * 7 + 3 };
  let pasos = 0;
  while (!e.ganador) {
    responder(e, respuestaAzar(e, rng));
    if (++pasos > 5000) throw new Error('Partida demasiado larga');
  }
  return { e, pasos };
}

describe('Motor', () => {
  it('las cartas tienen identificadores únicos y PC válidos', () => {
    const ids = new Set(CARTAS_LISTA.map((c) => c.id));
    expect(ids.size).toBe(CARTAS_LISTA.length);
    for (const c of CARTAS_LISTA) if (c.lado !== 'E' && c.lado !== 'A') expect(c.ops).toBeGreaterThanOrEqual(1);
  });

  it('empieza pidiendo la colocación inicial del Progresista', () => {
    const e = crearPartida(1);
    expect(e.pendiente?.tipo).toBe('provincia');
    expect(e.pendiente?.bando).toBe('P');
  });

  it('juega 200 partidas al azar de principio a fin sin errores', () => {
    const motivos = new Map<string, number>();
    for (let s = 1; s <= 200; s++) {
      const { e } = jugarAzar(s);
      expect(e.ganador).not.toBeNull();
      const m = e.ganador!.motivo.split(':')[0];
      motivos.set(m, (motivos.get(m) ?? 0) + 1);
      for (const p of PROVINCIAS) {
        expect(e.presencia[p.id].P).toBeGreaterThanOrEqual(0);
        expect(e.presencia[p.id].C).toBeGreaterThanOrEqual(0);
      }
    }
    expect(motivos.size).toBeGreaterThan(0);
  });

  it('es determinista con la misma semilla', () => {
    const a = jugarAzar(42).e;
    const b = jugarAzar(42).e;
    expect(a.ganador).toEqual(b.ganador);
    expect(a.ventaja).toBe(b.ventaja);
  });
});
