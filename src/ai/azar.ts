// Jugador aleatorio (para pruebas): responde cualquier decisión con una opción válida al azar.
import { aleatorio } from '../engine/rng';
import type { Estado, Respuesta } from '../engine/tipos';

export function respuestaAzar(e: Estado, rng: { rng: number }): Respuesta {
  const d = e.pendiente!;
  const pick = <T,>(a: T[]): T => a[Math.floor(aleatorio(rng) * a.length)];
  switch (d.tipo) {
    case 'provincia': return { tipo: 'provincia', id: pick(d.opciones) };
    case 'carta': {
      const c = pick(d.opciones);
      return { tipo: 'carta', carta: c, uso: d.proposito === 'accion' ? pick(d.usos[c]) : undefined };
    }
    case 'operacion': return { tipo: 'operacion', op: pick(d.opciones) };
    case 'opcion': return { tipo: 'opcion', i: Math.floor(aleatorio(rng) * d.opciones.length) };
    case 'partido': return { tipo: 'partido', id: pick(d.opciones) };
  }
}
