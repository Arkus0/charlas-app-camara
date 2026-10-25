import { crearPartida, responder, clonar } from '../src/motor/motor';
import { respuestaAzar } from '../src/ia/azar';
import { PROVINCIAS } from '../src/data/provincias';
import { TEMAS } from '../src/motor/agenda';
import { RAMAS } from '../src/motor/maquinaria';
import { TOPE_VENTAJA } from '../src/motor/reglas';
import type { Estado } from '../src/motor/tipos';

function invariantes(e: Estado) {
  for (const p of PROVINCIAS) {
    expect(e.presencia[p.id].P).toBeGreaterThanOrEqual(0);
    expect(e.presencia[p.id].C).toBeGreaterThanOrEqual(0);
    expect(e.morado[p.id]).toBeLessThanOrEqual(2);
  }
  for (const t of TEMAS) {
    expect(e.agenda.calor[t]).toBeGreaterThanOrEqual(0);
    expect(e.agenda.calor[t]).toBeLessThanOrEqual(5);
  }
  expect(e.clima).toBeGreaterThanOrEqual(1);
  expect(e.clima).toBeLessThanOrEqual(5);
  expect(Math.abs(e.ventaja)).toBeLessThanOrEqual(TOPE_VENTAJA);
  for (const b of ['P', 'C'] as const) {
    expect(e.acciones[b]).toBeGreaterThanOrEqual(0);
    for (const r of RAMAS) expect(e.maquinaria[b][r]).toBeLessThanOrEqual(3);
  }
}

/** Juega una partida al azar y devuelve el estado final y cuántas decisiones tomó cada bloque. */
function jugar(semilla: number, comprobar = false, ritmo = 1) {
  const e = crearPartida(semilla, { ritmo });
  const azar = { rng: semilla * 7919 + 13 };
  const decisiones = { P: 0, C: 0 };
  let pasos = 0;
  while (!e.ganador) {
    if (++pasos > 3000) throw new Error('La partida no termina');
    const d = e.pendiente!;
    expect(d).toBeTruthy();
    decisiones[d.bando]++;
    responder(e, respuestaAzar(d, azar));
    if (comprobar) invariantes(e);
  }
  return { e, decisiones };
}

describe('Motor v5', () => {
  it('la partida empieza en la semana 1 con 5 cartas por bloque y una acción pendiente', () => {
    const e = crearPartida(1);
    expect(e.semana).toBe(1);
    expect(e.manos.P).toHaveLength(5);
    expect(e.manos.C).toHaveLength(5);
    expect(e.pendiente?.tipo).toBe('accion');
    expect(Object.keys(e.calendario)).toHaveLength(7);
  });

  it('juega 200 partidas al azar de principio a fin sin romper ninguna regla', () => {
    for (let s = 1; s <= 200; s++) {
      const { e } = jugar(s, s <= 40);
      expect(e.ganador).toBeTruthy();
      invariantes(e);
    }
  });

  it('también con 2 acciones seguidas por turno (modo online)', () => {
    for (let s = 1; s <= 40; s++) expect(jugar(s, true, 2).e.ganador).toBeTruthy();
  });

  it('es determinista con la misma semilla', () => {
    const a = jugar(42).e;
    const b = jugar(42).e;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('una partida guardada a medias en JSON termina igual', () => {
    const semilla = 77;
    const ref = jugar(semilla).e;
    const e = crearPartida(semilla);
    const azar = { rng: semilla * 7919 + 13 };
    for (let i = 0; i < 40 && !e.ganador; i++) responder(e, respuestaAzar(e.pendiente!, azar));
    const recargada = JSON.parse(JSON.stringify(e)) as Estado;
    while (!recargada.ganador) responder(recargada, respuestaAzar(recargada.pendiente!, azar));
    expect(JSON.stringify(recargada)).toBe(JSON.stringify(ref));
  });

  it('clonar no comparte estado mutable', () => {
    const e = crearPartida(5);
    const c = clonar(e);
    responder(c, respuestaAzar(c.pendiente!, { rng: 1 }));
    expect(e.n).toBe(0);
    expect(c.n).toBe(1);
    expect(JSON.stringify(e.presencia)).not.toBe('');
  });

  it('cada bloque toma un número de decisiones propio de una partida corta', () => {
    let total = 0;
    let partidas = 0;
    for (let s = 1; s <= 60; s++) {
      const { e, decisiones } = jugar(s);
      if (e.semana < 8) continue; // las que acaban por vuelco o ruptura no cuentan
      total += decisiones.P + decisiones.C;
      partidas++;
    }
    const media = total / partidas / 2;
    // 29 acciones, pegada, 2 debates y alguna elección de evento
    expect(media).toBeGreaterThan(28);
    expect(media).toBeLessThan(45);
  });
});
