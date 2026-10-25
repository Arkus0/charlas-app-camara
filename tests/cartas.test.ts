import { crearPartida, clonar, ejecutarAislado, responder } from '../src/engine/motor';
import { CARTAS_LISTA } from '../src/data/cartas';
import { PROVINCIAS } from '../src/data/provincias';
import { respuestaAzar } from '../src/ai/azar';
import type { Bando, Estado } from '../src/engine/tipos';
import { partidosNegociables } from '../src/engine/reglas';
import { posturaPodemos, votoPodemos } from '../src/engine/electoral';

/** Una partida al azar avanzada hasta la semana indicada. */
function partidaEn(semilla: number, turno: number): Estado {
  const e = crearPartida(semilla);
  const rng = { rng: semilla * 13 + 5 };
  let pasos = 0;
  while (!e.ganador && (e.turno < turno || e.pendiente?.tipo !== 'carta' || e.pendiente.proposito !== 'accion')) {
    responder(e, respuestaAzar(e, rng));
    if (++pasos > 5000) break;
  }
  return e;
}

describe('Cartas', () => {
  it('todas las cartas tienen escena para su ilustración', () => {
    for (const c of CARTAS_LISTA) expect(c.escena.length).toBeGreaterThan(20);
  });

  it('cada carta de bloque tiene su pareja espejo con los mismos PC', () => {
    const porId = new Map(CARTAS_LISTA.map((c) => [c.id, c]));
    const deBloque = CARTAS_LISTA.filter((c) => c.lado === 'P' || c.lado === 'C');
    expect(deBloque.filter((c) => c.lado === 'P').length).toBe(deBloque.filter((c) => c.lado === 'C').length);
    for (const c of deBloque) {
      const p = porId.get(c.pareja!);
      expect(p, c.nombre).toBeDefined();
      expect(p!.pareja).toBe(c.id);
      expect(p!.ops).toBe(c.ops);
      expect(p!.lado).not.toBe(c.lado);
      expect(p!.mazo).toBe(c.mazo);
      expect(!!p!.retirar).toBe(!!c.retirar);
    }
  });

  it('el evento de cada carta se resuelve sin errores para cualquier bloque', () => {
    const bases = [2, 5, 8].flatMap((t) => [11, 23].map((s) => partidaEn(s + t, t))).filter((e) => !e.ganador);
    expect(bases.length).toBeGreaterThan(2);
    for (const c of CARTAS_LISTA) {
      for (const base of bases) {
        for (const b of ['P', 'C'] as Bando[]) {
          const e = clonar(base);
          const rng = { rng: c.id * 31 + (b === 'P' ? 1 : 2) };
          const tarea = c.lado === 'A' ? { t: 'efectos', lista: c.efectos, i: 0, yo: b } : { t: 'evento', carta: c.id, jugador: b };
          ejecutarAislado(e, [tarea]);
          let n = 0;
          while (e.pendiente && !e.ganador && n++ < 200) responder(e, respuestaAzar(e, rng));
          expect(e.pendiente === null || !!e.ganador, `${c.nombre} deja una decisión colgada`).toBe(true);
          for (const p of PROVINCIAS) {
            expect(e.presencia[p.id].P).toBeGreaterThanOrEqual(0);
            expect(e.presencia[p.id].C).toBeGreaterThanOrEqual(0);
            expect(e.morado[p.id]).toBeGreaterThanOrEqual(0);
          }
          expect(e.clima).toBeGreaterThanOrEqual(1);
          expect(Math.abs(e.ventaja)).toBeLessThanOrEqual(20);
        }
      }
    }
  });
});

describe('La pinza', () => {
  it('el Conservador puede llevar a Podemos a apoyar a Feijóo, pero solo con Podemos en guerra con el PSOE', () => {
    const e = crearPartida(5);
    expect(partidosNegociables(e, 'C')).not.toContain('PODEMOS');
    e.podemos.humor = -3;
    e.socio.C = -2;
    expect(partidosNegociables(e, 'C')).toContain('PODEMOS');
    const ventaja = e.ventaja;
    for (let i = 0; i < 3; i++) {
      e.negociado = [];
      ejecutarAislado(e, [{ t: 'negociacion', bando: 'C', pasos: 1 }]);
      responder(e, { tipo: 'partido', id: 'PODEMOS' });
    }
    expect(e.podemos.pinza).toBe(3);
    expect(e.ventaja).toBe(ventaja - 3); // cada paso da 1 PV al Progresista
    expect(votoPodemos('C', posturaPodemos(e))).toBe('si');
    e.socio.C = 0;
    expect(votoPodemos('C', posturaPodemos(e))).toBe('abst'); // con Vox fuerte, como mucho se abstiene
  });

  it('el Progresista la desarma y se enfría si Podemos deja la guerra con el PSOE', () => {
    const e = crearPartida(6);
    e.podemos.humor = -2;
    e.podemos.pinza = 2;
    e.negociado = [];
    ejecutarAislado(e, [{ t: 'negociacion', bando: 'P', pasos: 1 }]);
    responder(e, { tipo: 'partido', id: 'PODEMOS' });
    expect(e.podemos).toMatchObject({ humor: -1, pinza: 1 });
    expect(partidosNegociables(e, 'C')).not.toContain('PODEMOS');
    e.turno = 1;
    ejecutarAislado(e, [{ t: 'finTurno' }]);
    expect(e.podemos.pinza).toBe(0);
  });
});
