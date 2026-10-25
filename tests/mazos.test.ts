import { ACTUALIDAD_IDS, AGENDA_PODEMOS_IDS, CARTAS, CARTAS_LISTA } from '../src/data/mazos';
import { PROVINCIAS } from '../src/data/provincias';
import { DUENO_TEMA } from '../src/motor/agenda';
import { destinosEvento, SIN_DESTINO } from '../src/motor/acciones';
import { tareaEfectos } from '../src/motor/efectos';
import { clonar, crearPartida, ejecutarAislado, responder } from '../src/motor/motor';
import { lider } from '../src/motor/reglas';
import { respuestaAzar } from '../src/ia/azar';
import type { Bando, Carta, Estado } from '../src/motor/tipos';

const BLOQUES = CARTAS_LISTA.filter((c) => c.mazo === 'P' || c.mazo === 'C');
const clase = (c: Carta) => (c.tema === 'COR' ? 'corrupción' : DUENO_TEMA[c.tema] === c.mazo ? 'propio' : 'rival');

/** Estados de mitad de partida (semanas 2, 5 y 7) jugando al azar. */
function estadosDePrueba(): Estado[] {
  const res: Estado[] = [];
  for (const semilla of [3, 11, 29, 47]) {
    const e = crearPartida(semilla);
    const r = { rng: semilla };
    for (const hasta of [2, 5, 7]) {
      while (!e.ganador && e.semana < hasta) responder(e, respuestaAzar(e.pendiente!, r));
      if (!e.ganador) res.push(clonar(e));
    }
  }
  return res;
}

describe('Mazos', () => {
  it('los ids son únicos', () => {
    expect(new Set(CARTAS_LISTA.map((c) => c.id)).size).toBe(CARTAS_LISTA.length);
  });

  it('cada carta de bloque tiene su pareja con la misma fuerza, fase y tipo de tema', () => {
    for (const c of BLOQUES) {
      const p = CARTAS[c.pareja!];
      expect(p, c.nombre).toBeTruthy();
      expect(p.pareja).toBe(c.id);
      expect(p.mazo).not.toBe(c.mazo);
      expect(p.fuerza, c.nombre).toBe(c.fuerza);
      expect(p.fase, c.nombre).toBe(c.fase);
      expect(clase(p), c.nombre).toBe(clase(c));
      expect(!!p.retirar, c.nombre).toBe(!!c.retirar);
      expect(c.fuerza).toBeGreaterThanOrEqual(1);
      expect(c.fuerza).toBeLessThanOrEqual(4);
    }
  });

  it('el dilema de la Agenda: entre el 30 % y el 45 % de cada mazo habla de temas del rival o de corrupción, y esas cartas pesan', () => {
    for (const b of ['P', 'C'] as Bando[]) {
      const mazo = BLOQUES.filter((c) => c.mazo === b);
      const ajenas = mazo.filter((c) => clase(c) !== 'propio');
      const pct = ajenas.length / mazo.length;
      expect(pct).toBeGreaterThanOrEqual(0.3);
      expect(pct).toBeLessThanOrEqual(0.45);
      const media = (xs: Carta[]) => xs.reduce((a, c) => a + c.fuerza, 0) / xs.length;
      expect(media(mazo.filter((c) => clase(c) === 'rival'))).toBeGreaterThan(media(mazo.filter((c) => clase(c) === 'propio')));
    }
  });

  it('los textos caben en una carta de móvil', () => {
    for (const c of BLOQUES) expect(c.texto.length, c.nombre).toBeLessThanOrEqual(170);
    for (const c of CARTAS_LISTA) {
      expect(c.texto.length, c.nombre).toBeLessThanOrEqual(200);
      expect(c.escena.length, c.nombre).toBeGreaterThan(20);
    }
  });

  it('el evento de cada carta se resuelve sin errores, con cualquier destino, desde estados variados', () => {
    const estados = estadosDePrueba();
    expect(estados.length).toBeGreaterThan(6);
    const azar = { rng: 99 };
    let probadas = 0;
    for (const c of CARTAS_LISTA) {
      for (const base of estados) {
        const quien: Bando = c.mazo === 'P' || c.mazo === 'C' ? c.mazo : lider(base);
        const destinos = c.mazo === 'P' || c.mazo === 'C' ? destinosEvento(base, quien, c.id) : [SIN_DESTINO];
        if (!destinos) continue;
        for (const destino of destinos.slice(0, 3)) {
          const e = clonar(base);
          e.enJuego = quien;
          ejecutarAislado(e, [tareaEfectos(c.efectos, { yo: quien, carta: c.id, destino: destino === SIN_DESTINO ? undefined : destino })], (d) => respuestaAzar(d, azar));
          for (const p of PROVINCIAS) {
            expect(e.presencia[p.id].P, c.nombre).toBeGreaterThanOrEqual(0);
            expect(e.presencia[p.id].C, c.nombre).toBeGreaterThanOrEqual(0);
          }
          expect(e.clima).toBeGreaterThanOrEqual(1);
          probadas++;
        }
      }
    }
    expect(probadas).toBeGreaterThan(CARTAS_LISTA.length * 5);
  });

  it('hay noticias y cartas de Podemos de sobra para 8 semanas', () => {
    expect(ACTUALIDAD_IDS.length).toBeGreaterThanOrEqual(8);
    expect(AGENDA_PODEMOS_IDS.length).toBeGreaterThanOrEqual(8);
  });

  it('el reparto de Implantar se valida antes de tocar la partida', () => {
    const e = crearPartida(3);
    const d = e.pendiente!;
    expect(d.tipo).toBe('accion');
    if (d.tipo !== 'accion') return;
    const basica = d.opciones.find((o) => o.carta === 'basica')!;
    const antes = JSON.stringify(e);
    // fuera de la zona elegida
    expect(() => responder(e, { tipo: 'accion', carta: 'basica', modo: 'implantar', destino: 'AND', reparto: { '08': 1 } })).toThrow();
    // más PC de los que tiene
    expect(() => responder(e, { tipo: 'accion', carta: 'basica', modo: 'implantar', destino: 'AND', reparto: { '41': 1, '29': 1, '18': 1 } })).toThrow();
    expect(JSON.stringify(e)).toBe(antes);
    // válido
    expect(basica.pc).toBe(1);
    responder(e, { tipo: 'accion', carta: 'basica', modo: 'implantar', destino: 'AND', reparto: { '18': 1 } });
    expect(e.presencia['18'][d.bando]).toBe(1);
  });
});
