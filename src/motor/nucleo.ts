// Núcleo genérico del motor: la partida es una pila de tareas. Cada tarea avanza sola o se detiene en una
// decisión que responde un jugador (persona, IA o servidor). Todo el estado es serializable.

export interface Tarea {
  t: string;
  [k: string]: any;
}

export interface ConPila<D> {
  pila: Tarea[];
  pendiente: D | null;
  ganador: unknown;
}

/** Un paso de tarea: devuelve true cuando la tarea ha terminado. Puede encolar subtareas o pedir una decisión. */
export type Paso<E, R> = (e: E, t: Tarea, r: R | undefined) => boolean;

/** Encola tareas para que se ejecuten en el orden dado (la cima de la pila es el final del array). */
export function encolar(e: { pila: Tarea[] }, ...tareas: Tarea[]) {
  for (let i = tareas.length - 1; i >= 0; i--) e.pila.push(tareas[i]);
}

/** Detiene la tarea en curso a la espera de una respuesta. */
export function decidir<D>(e: { pendiente: D | null }, d: D): false {
  e.pendiente = d;
  return false;
}

export interface Bucle<E, R> {
  avanzar(e: E): void;
  responder(e: E, r: R): E;
}

export function crearBucle<D, R, E extends ConPila<D>>(pasos: Record<string, Paso<E, R>>, validar: (e: E, d: D, r: R) => void): Bucle<E, R> {
  const paso = (e: E, t: Tarea, r: R | undefined): boolean => {
    const f = pasos[t.t];
    if (!f) throw new Error(`Tarea desconocida: ${t.t}`);
    return f(e, t, r);
  };
  const quitar = (e: E, t: Tarea) => {
    const i = e.pila.lastIndexOf(t);
    if (i >= 0) e.pila.splice(i, 1);
  };
  const avanzar = (e: E) => {
    let guarda = 0;
    while (!e.pendiente && !e.ganador && e.pila.length > 0) {
      if (++guarda > 50000) throw new Error('Bucle del motor sin salida');
      const t = e.pila[e.pila.length - 1];
      if (paso(e, t, undefined)) quitar(e, t);
    }
  };
  /** Responde a la decisión pendiente. Muta el estado: clónalo antes si necesitas conservar el anterior. */
  const responder = (e: E, r: R): E => {
    if (!e.pendiente) throw new Error('No hay ninguna decisión pendiente');
    validar(e, e.pendiente, r);
    const t = e.pila[e.pila.length - 1];
    e.pendiente = null;
    if (paso(e, t, r)) quitar(e, t);
    avanzar(e);
    return e;
  };
  return { avanzar, responder };
}
