// Tipos y constantes compartidos por la lógica y la vista.

export const T = 16; // lado de la casilla
export const ANCHO = 256; // resolución interna: la de la SNES
export const ALTO = 224;

/** 0 abajo (sur), 1 derecha (este), 2 arriba (norte), 3 izquierda (oeste). */
export type Dir = 0 | 1 | 2 | 3;
export const DX = [0, 1, 0, -1];
export const DY = [1, 0, -1, 0];

export type Boton = 'a' | 'b' | 'c' | 'd' | 'e';
export const BOTONES: Boton[] = ['a', 'b', 'c', 'd', 'e'];

/** Estado de los mandos en un paso de simulación. m = mantenido, p = recién pulsado. */
export interface Entrada {
  dx: number;
  dy: number;
  m: Record<Boton, boolean>;
  p: Record<Boton, boolean>;
}

export function entradaVacia(): Entrada {
  return {
    dx: 0, dy: 0,
    m: { a: false, b: false, c: false, d: false, e: false },
    p: { a: false, b: false, c: false, d: false, e: false },
  };
}

export const TERR = {
  SUELO: 0, ALT: 1, TER: 2, MURO: 3, VACIO: 4, AGUA: 5, FOSO: 6,
  CINTA_S: 7, CINTA_E: 8, CINTA_N: 9, CINTA_O: 10, RELLENO: 11, PUENTE: 12,
} as const;

export interface DefSala {
  id: string;
  zona: string;
  nombre?: string;
  mapa: string[];
  /** carácter de puerta → [sala destino, puerta destino] */
  puertas?: Record<string, [string, string]>;
  /** por carácter de mecanismo, canal de cada aparición en orden de lectura ('a' si falta) */
  canal?: Record<string, string[]>;
  cofres?: string[];
  pnj?: string[];
  carteles?: string[];
  marcas?: string[];
  /** recorrido de cada plataforma móvil: [dx, dy, casillas] */
  plataformas?: [number, number, number][];
  /** canales temporizados: canal → duración en pasos */
  tiempo?: Record<string, number>;
  /** decorado: [nombre, columna, fila] de la casilla inferior izquierda de su base */
  deco?: [string, number, number][];
  /** luces fijas: [columna, fila, radio, color] */
  luces?: [number, number, number, string][];
  /** rótulos de neón: [texto, columna, fila, color] */
  neones?: [string, number, number, string][];
  oscura?: boolean;
  jefe?: string;
  musica?: string;
  /** puerta → condición que debe cumplirse para cruzarla */
  bloqueo?: Record<string, string>;
  alEntrar?: string;
  /** altura de los muros con cara visible (2 por omisión) */
  altoMuro?: number;
}

export interface Ent {
  id: number;
  tipo: string;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  rx: number; ry: number;
  dir: Dir;
  vivo: boolean;
  /** bloquea el paso como un bloque de altura `alto` */
  solido: boolean;
  alto: number;
  est: string;
  t: number;
  [extra: string]: any;
}

export interface Partida {
  sala: string;
  puerta: string | null;
  vida: number;
  vidaMax: number;
  dinero: number;
  llaves: Record<string, number>;
  bate: boolean;
  katana: boolean;
  tracas: boolean;
  mechero: boolean;
  capote: boolean;
  objeto: number;
  tinta: number;
  tatuaje: number;
  bocatas: number;
  cromos: number;
  duende: number;
  banderas: Record<string, number>;
  pasos: number;
  muertes: number;
}

export function partidaNueva(): Partida {
  return {
    sala: 'muelle', puerta: null, vida: 6, vidaMax: 6, dinero: 0, llaves: {},
    bate: false, katana: false, tracas: false, mechero: false, capote: false, objeto: 0,
    tinta: 0, tatuaje: 0, bocatas: 0, cromos: 0, duende: 0, banderas: {}, pasos: 0, muertes: 0,
  };
}

/** Un paso de diálogo: narración, [quién, texto], elección o acción. */
export type Paso =
  | string
  | [string, string]
  | { op: string[]; r: (i: number) => Paso[] | void }
  | { f: () => Paso[] | void };
