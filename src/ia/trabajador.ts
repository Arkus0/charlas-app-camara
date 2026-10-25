// La IA en un Web Worker: el móvil no se traba mientras piensa.
import { decidirIA, type Nivel } from './bot';
import type { Estado } from '../motor/tipos';

interface Peticion {
  id: number;
  estado: Estado;
  nivel: Nivel;
  semilla: number;
}

const ctx = self as unknown as { postMessage: (m: unknown) => void; onmessage: ((ev: MessageEvent<Peticion>) => void) | null };

ctx.onmessage = (ev) => {
  const { id, estado, nivel, semilla } = ev.data;
  try {
    const respuesta = decidirIA(estado, nivel, semilla);
    ctx.postMessage({ id, respuesta });
  } catch (err) {
    ctx.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
