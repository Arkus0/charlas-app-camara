// Tipos de base compartidos por el motor, los datos y la interfaz de «176 · La Batalla del 29N».

export type Bando = 'P' | 'C'; // Progresista | Conservador
export const RIVAL: Record<Bando, Bando> = { P: 'C', C: 'P' };
export const BANDOS: Bando[] = ['P', 'C'];

export type ZonaId = 'AND' | 'CAT' | 'MAD' | 'LEV' | 'INT' | 'NOR' | 'CAN';

export type PartidoId =
  | 'PP' | 'VOX' | 'PSOE' | 'SUMAR' | 'PODEMOS'
  | 'ERC' | 'JUNTS' | 'BILDU' | 'PNV' | 'BNG' | 'CC' | 'UPN' | 'COMPROMIS' | 'ADELANTE' | 'NC'
  | 'SALF' | 'SORIA' | 'UPL' | 'TE' | 'OTROS' | 'BLANCO';

/** Fuerzas regionales con las que se puede negociar. */
export type RegionalId = 'ERC' | 'JUNTS' | 'BILDU' | 'PNV' | 'BNG' | 'CC' | 'UPN' | 'COMPROMIS' | 'ADELANTE' | 'NC';

/** Todo aquello con lo que se puede negociar: las regionales y Podemos, el comodín. */
export type Negociable = RegionalId | 'PODEMOS';

export type Votos = Partial<Record<PartidoId, number>>;

export interface Provincia {
  id: string;
  nombre: string;
  corto: string;
  zona: ZonaId;
  escanos: number;
  fidelidad: number; // estabilidad (1-4)
  clave: boolean;
  feudo: Bando | null;
  vecinos: string[];
  x: number;
  y: number;
  base: Votos; // votos de partida (media de encuestas, oct-2026)
}

export interface Zona {
  id: ZonaId;
  nombre: string;
  /** PV por presencia / dominio / control */
  pv: [number, number, number];
  color: string;
}
