// Jugador al azar: elige cualquier respuesta válida (para las pruebas y como IA mínima).
import { TEMAS } from '../motor/agenda';
import { aleatorio } from '../motor/rng';
import type { Decision, Modo, Respuesta } from '../motor/tipos';

const elegirUno = <T>(r: { rng: number }, xs: T[]): T => xs[Math.floor(aleatorio(r) * xs.length)];

export function respuestaAzar(d: Decision, r: { rng: number }): Respuesta {
  switch (d.tipo) {
    case 'accion': {
      const o = elegirUno(r, d.opciones);
      const modo = elegirUno(r, Object.keys(o.modos) as Modo[]);
      const destinos = o.modos[modo]!;
      const destino = elegirUno(r, destinos);
      return { tipo: 'accion', carta: o.carta, modo, destino, sentido: modo === 'agenda' ? 'sube' : undefined };
    }
    case 'opcion':
      return { tipo: 'opcion', i: Math.floor(aleatorio(r) * d.opciones.length) };
    case 'debate':
      return { tipo: 'debate', carta: d.cartas.length && aleatorio(r) < 0.9 ? elegirUno(r, d.cartas) : null, tema: elegirUno(r, TEMAS) };
  }
}
