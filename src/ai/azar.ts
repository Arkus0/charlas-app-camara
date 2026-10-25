// Jugador aleatorio (para pruebas): responde cualquier decisión con una opción válida al azar.
import { aleatorio } from '../engine/rng';
import type { Estado, Respuesta } from '../engine/tipos';

export function respuestaAzar(e: Estado, rng: { rng: number }): Respuesta {
  const d = e.pendiente!;
  const pick = <T,>(a: T[]): T => a[Math.floor(aleatorio(rng) * a.length)];
  // las decisiones opcionales a veces se dejan sin hacer, para probar también ese camino
  const pasa = () => aleatorio(rng) < 0.15;
  switch (d.tipo) {
    case 'provincia': return { tipo: 'provincia', id: d.opcional && pasa() ? null : pick(d.opciones) };
    case 'carta': {
      if (d.opcional && pasa()) return { tipo: 'carta', carta: null };
      const c = pick(d.opciones);
      const conUso = d.proposito === 'accion' || d.proposito === 'jugar';
      return { tipo: 'carta', carta: c, uso: conUso ? pick(d.usos[c]) : undefined };
    }
    case 'operacion': return { tipo: 'operacion', op: pick(d.opciones) };
    case 'opcion': return { tipo: 'opcion', i: Math.floor(aleatorio(rng) * d.opciones.length) };
    case 'partido': return { tipo: 'partido', id: d.opcional && pasa() ? null : pick(d.opciones) };
  }
}
