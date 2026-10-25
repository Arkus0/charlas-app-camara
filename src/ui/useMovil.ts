import { useEffect, useState } from 'react';

/** Pantallas estrechas (móviles y tabletas en vertical) usan la interfaz táctil. */
export const CONSULTA_MOVIL = '(max-width: 820px)';

export function useMovil(): boolean {
  const [movil, setMovil] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(CONSULTA_MOVIL).matches);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(CONSULTA_MOVIL);
    const cambio = () => setMovil(mq.matches);
    cambio();
    mq.addEventListener('change', cambio);
    return () => mq.removeEventListener('change', cambio);
  }, []);
  return movil;
}
