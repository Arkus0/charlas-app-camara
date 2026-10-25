// La vista de un jugador: el estado sin lo que no puede ver (la mano rival, el orden de los mazos, la semilla
// de los dados, la pila de tareas ni la decisión pendiente del rival). Es lo único que recibe la interfaz,
// tanto contra la IA como online, y basta para proyectar los escaños y previsualizar las jugadas.
import { tiene } from './maquinaria';
import type { Bando, Decision, Estado, MazoId } from './tipos';

export interface Vista extends Omit<Estado, 'rng' | 'pila' | 'mazos' | 'manos' | 'pendiente' | 'silencio'> {
  yo: Bando;
  mano: number[];
  manoRival: number;
  mazos: Record<MazoId, number>;
  /** la decisión pendiente, solo si es mía */
  pendiente: Decision | null;
  /** quién tiene que decidir ahora (null si nadie) */
  esperando: Bando | null;
  /** la próxima noticia, para quien tiene Datos 1 */
  proximaNoticia: number | null;
}

export function vistaDe(e: Estado, yo: Bando): Vista {
  const { rng: _rng, pila: _pila, mazos, manos, pendiente, silencio: _s, ...publico } = e;
  const mia = pendiente && pendiente.bando === yo ? pendiente : null;
  return structuredClone({
    ...publico,
    yo,
    mano: [...manos[yo]],
    manoRival: manos[yo === 'P' ? 'C' : 'P'].length,
    mazos: { P: mazos.P.length, C: mazos.C.length, actualidad: mazos.actualidad.length, podemos: mazos.podemos.length },
    pendiente: mia,
    esperando: pendiente ? pendiente.bando : null,
    proximaNoticia: tiene(e, yo, 'datos', 1) ? mazos.actualidad[mazos.actualidad.length - 1] ?? null : null,
  });
}
