// Motor de «176 · La Batalla del 29N»: crea la partida, valida y aplica las respuestas.
// Las tareas viven en semana.ts (flujo), acciones.ts (jugadas) y efectos.ts (eventos de las cartas).
import { AFINIDAD_INICIAL } from '../data/partidos';
import { PRESENCIA_INICIAL, PROVINCIAS } from '../data/provincias';
import { ACTUALIDAD_IDS, AGENDA_PODEMOS_IDS, idsDeBloque } from '../data/mazos';
import { controlDe } from './electoral';
import { TEMAS } from './agenda';
import { SIN_DESTINO, validarAccion } from './acciones';
import { fotoSemana, log } from './cambios';
import { pasosEfectos } from './efectos';
import { crearBucle, encolar, type Tarea } from './nucleo';
import { ZONA_IDS } from './reglas';
import { barajar } from './rng';
import { pasosSemana } from './semana';
import type { Decision, Estado, Respuesta, Tema } from './tipos';

export const VERSION_MOTOR = 1;

/** pp de partida hacia el Conservador: las encuestas de octubre se acercan a un empate técnico (calibrado con la IA). */
export const SESGO_INICIAL = -7.55;

export interface OpcionesPartida {
  /** acciones seguidas por turno (1 contra la IA; 1 o 2 online) */
  ritmo?: number;
  sesgo?: number;
}

function validar(e: Estado, d: Decision, r: Respuesta) {
  if (d.tipo !== r.tipo) throw new Error(`Se esperaba una respuesta de tipo ${d.tipo}`);
  switch (r.tipo) {
    case 'accion': {
      const o = (d as Extract<Decision, { tipo: 'accion' }>).opciones.find((x) => x.carta === r.carta);
      if (!o) throw new Error('Esa carta no se puede jugar ahora');
      const destinos = o.modos[r.modo];
      if (!destinos) throw new Error('Esa carta no se puede jugar así');
      if (destinos[0] !== SIN_DESTINO && (!r.destino || !destinos.includes(r.destino))) throw new Error('Destino no válido');
      validarAccion(e, d.bando, r);
      break;
    }
    case 'opcion':
      if (!Number.isInteger(r.i) || r.i < 0 || r.i >= (d as Extract<Decision, { tipo: 'opcion' }>).opciones.length) throw new Error('Opción no válida');
      break;
    case 'debate': {
      const dd = d as Extract<Decision, { tipo: 'debate' }>;
      if (r.carta !== null && !dd.cartas.includes(r.carta)) throw new Error('Carta no válida');
      if (!TEMAS.includes(r.tema)) throw new Error('Tema no válido');
      break;
    }
  }
}

const bucle = crearBucle<Decision, Respuesta, Estado>({ ...pasosSemana, ...pasosEfectos }, validar);

export const avanzar = bucle.avanzar;

/** Responde a la decisión pendiente. Muta el estado: usa `clonar` antes si necesitas conservar el anterior. */
export function responder(e: Estado, r: Respuesta): Estado {
  bucle.responder(e, r);
  e.n++;
  return e;
}

export function crearPartida(semilla = Date.now(), o: OpcionesPartida = {}): Estado {
  const presencia: Estado['presencia'] = {};
  const morado: Estado['morado'] = {};
  for (const p of PROVINCIAS) {
    presencia[p.id] = { P: PRESENCIA_INICIAL[p.id]?.P ?? 0, C: PRESENCIA_INICIAL[p.id]?.C ?? 0 };
    morado[p.id] = 0;
  }
  const cero = Object.fromEntries(TEMAS.map((t) => [t, 0])) as Record<Tema, number>;
  const e: Estado = {
    version: 5,
    n: 0,
    rng: semilla | 0,
    semana: 0,
    fase: 'juego',
    enJuego: null,
    ritmo: Math.max(1, Math.min(2, o.ritmo ?? 1)),
    presencia,
    presencia0: {},
    control0: {},
    morado,
    ventaja: 0,
    sesgo: o.sesgo ?? SESGO_INICIAL,
    clima: 5,
    socio: { P: 0, C: 0 },
    podemos: { fuerza: 0, humor: 0, pinza: 0 },
    afinidad: { ...AFINIDAD_INICIAL },
    modsProv: {},
    modsPartido: {},
    agenda: { calor: { ...cero }, reciente: { ...cero }, contador: 0, corrupcion: null },
    maquinaria: { P: { calle: 0, medios: 0, datos: 0 }, C: { calle: 0, medios: 0, datos: 0 } },
    maquinariaUsada: { P: false, C: false },
    completadas: {},
    calendario: {},
    acciones: { P: 0, C: 0 },
    negociado: { P: [], C: [] },
    efectos: [],
    mazos: { P: [], C: [], actualidad: [], podemos: [] },
    descartes: { P: [], C: [] },
    retiradas: [],
    manos: { P: [], C: [] },
    noticia: null,
    agendaPodemos: null,
    pila: [],
    pendiente: null,
    ganador: null,
    cronica: { seq: 0, log: [], sucesos: [], historia: [] },
  };
  for (const p of PROVINCIAS) {
    e.presencia0[p.id] = { ...presencia[p.id] };
    e.control0[p.id] = controlDe(p, presencia[p.id], 0);
  }
  // el calendario de encuestas: una zona por semana, de la 1 a la 7
  barajar(e, [...ZONA_IDS]).forEach((z, i) => { e.calendario[i + 1] = z; });
  e.mazos.P = barajar(e, idsDeBloque('P', 1));
  e.mazos.C = barajar(e, idsDeBloque('C', 1));
  e.mazos.actualidad = barajar(e, [...ACTUALIDAD_IDS]);
  e.mazos.podemos = barajar(e, [...AGENDA_PODEMOS_IDS]);
  log(e, 'El BOE publica la disolución de las Cortes: elecciones el 29 de noviembre', 'fase');
  fotoSemana(e);
  encolar(e, { t: 'inicioSemana' });
  avanzar(e);
  return e;
}

/** Ejecuta unas tareas fuera del flujo de la partida (pruebas de cartas). Las decisiones las toma `elegir`. */
export function ejecutarAislado(e: Estado, tareas: Tarea[], elegir: (d: Decision) => Respuesta) {
  const pila = e.pila;
  const pendiente = e.pendiente;
  e.pila = [];
  e.pendiente = null;
  encolar(e, ...tareas);
  avanzar(e);
  let guarda = 0;
  while (e.pendiente && !e.ganador) {
    if (++guarda > 100) throw new Error('Demasiadas decisiones en un evento aislado');
    bucle.responder(e, elegir(e.pendiente));
  }
  if (!e.ganador) {
    e.pila = pila;
    e.pendiente = pendiente;
  }
}

/** Copia profunda. Con `silencio`, la crónica se comparte (no se escribe). */
export function clonar(e: Estado): Estado {
  const { cronica, ...resto } = e;
  const c = structuredClone(resto) as Omit<Estado, 'cronica'>;
  return {
    ...c,
    cronica: e.silencio ? cronica : { seq: cronica.seq, log: [...cronica.log], sucesos: [...cronica.sucesos], historia: [...cronica.historia] },
  };
}
