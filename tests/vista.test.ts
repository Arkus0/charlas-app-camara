import { PROVINCIAS } from '../src/data/provincias';
import { proyectar } from '../src/motor/electoral';
import { crearPartida, responder } from '../src/motor/motor';
import { vistaDe } from '../src/motor/vista';
import { respuestaAzar } from '../src/ia/azar';
import type { Bando, Estado } from '../src/motor/tipos';

/** Ids de carta que aparecen en cualquier campo «carta», «cartas», «mano» o «opciones[].carta» de un objeto. */
function cartasVisibles(x: unknown, acc = new Set<number>()): Set<number> {
  if (Array.isArray(x)) for (const y of x) cartasVisibles(y, acc);
  else if (x && typeof x === 'object') {
    for (const [k, v] of Object.entries(x)) {
      if ((k === 'carta' || k === 'noticia' || k === 'agendaPodemos' || k === 'proximaNoticia') && typeof v === 'number') acc.add(v);
      else if ((k === 'cartas' || k === 'mano' || k === 'retiradas') && Array.isArray(v)) for (const n of v) if (typeof n === 'number') acc.add(n);
      else cartasVisibles(v, acc);
    }
  }
  return acc;
}

describe('Vista de cada jugador', () => {
  it('nunca muestra la mano del rival, los mazos, la semilla ni la decisión del rival', () => {
    for (let s = 1; s <= 30; s++) {
      const e: Estado = crearPartida(s);
      const r = { rng: s };
      // cartas que el rival ha enseñado (jugadas, descartadas o retiradas): esas sí pueden verse
      while (!e.ganador) {
        for (const yo of ['P', 'C'] as Bando[]) {
          const rival: Bando = yo === 'P' ? 'C' : 'P';
          const v = vistaDe(e, yo);
          expect(v).not.toHaveProperty('rng');
          expect(v).not.toHaveProperty('pila');
          expect(typeof v.manoRival).toBe('number');
          expect(v.mano).toEqual(e.manos[yo]);
          if (v.pendiente) expect(v.pendiente.bando).toBe(yo);
          const visibles = cartasVisibles(v);
          // una carta ya jugada o descartada es pública aunque vuelva al mazo al barajar el descarte
          const publicas = cartasVisibles({ s: e.cronica.sucesos, r: e.retiradas });
          for (const id of [...e.descartes.P, ...e.descartes.C]) publicas.add(id);
          const ocultas = [...e.manos[rival], ...e.mazos[rival], ...e.mazos[yo], ...e.mazos.podemos, ...e.mazos.actualidad.slice(0, -1)].filter((id) => !publicas.has(id));
          for (const id of ocultas) expect(visibles.has(id), `carta ${id} visible para ${yo}`).toBe(false);
        }
        responder(e, respuestaAzar(e.pendiente!, r));
      }
    }
  });

  it('con la vista basta para proyectar los escaños', () => {
    const e = crearPartida(8);
    const r = { rng: 8 };
    for (let i = 0; i < 25 && !e.ganador; i++) responder(e, respuestaAzar(e.pendiente!, r));
    const v = vistaDe(e, 'P');
    expect(proyectar(PROVINCIAS, v)).toEqual(proyectar(PROVINCIAS, e));
  });

  it('la vista es JSON puro y no comparte objetos con la partida', () => {
    const e = crearPartida(9);
    const v = vistaDe(e, 'C');
    v.presencia['28'].C = 99;
    expect(e.presencia['28'].C).not.toBe(99);
    expect(JSON.parse(JSON.stringify(v))).toEqual(v);
  });
});
