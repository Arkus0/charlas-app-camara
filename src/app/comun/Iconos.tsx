// Iconos sencillos en SVG (heredan el color del texto).
import type { Rama, Tema } from '../../motor/tipos';

const TRAZOS: Record<Tema, string> = {
  VIV: 'M4 11 12 4l8 7M6 10v9h4v-5h4v5h4v-9',
  SER: 'M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z',
  DER: 'M12 4v16M5 8h14M7 8l-3 6a3 3 0 0 0 6 0zM17 8l-3 6a3 3 0 0 0 6 0z',
  ECO: 'M17 6a7 7 0 1 0 0 12M5 10h9M5 14h9',
  INM: 'M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z',
  ESP: 'M6 21V4M6 5h12l-2 4 2 4H6',
  COR: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM15.5 15.5 21 21',
};

export function IconoTema({ tema, size = 18 }: { tema: Tema; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={TRAZOS[tema]} />
    </svg>
  );
}

const RAMAS: Record<Rama, string> = {
  calle: 'M7 21v-6l-2-3 3-5h3l3 5-2 3v6M9 4a2 2 0 1 0 0-.1M15 21v-5l2-3-1-3',
  medios: 'M4 7h16v11H4zM8 3l4 4 4-4',
  datos: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
};

export function IconoRama({ rama, size = 18 }: { rama: Rama; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={RAMAS[rama]} />
    </svg>
  );
}

export function Icono({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export const ICONO = {
  menu: 'M4 7h16M4 12h16M4 17h16',
  cerrar: 'M6 6l12 12M18 6 6 18',
  info: 'M12 8h.01M11 12h1v5h1M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  atras: 'M15 6l-6 6 6 6',
  dado: 'M5 5h14v14H5zM9 9h.01M15 15h.01M15 9h.01M9 15h.01',
  cronica: 'M5 4h14v16H5zM8 8h8M8 12h8M8 16h5',
  tele: 'M3 6h18v12H3zM8 21h8',
};
