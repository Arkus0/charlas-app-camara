// Partidos y candidaturas del 29N (editable si cambian las listas).
import type { Bando, PartidoId, RegionalId } from '../engine/tipos';

export interface InfoPartido {
  id: PartidoId;
  nombre: string;
  siglas: string;
  color: string;
  candidato?: string;
  bloque?: Bando;
}

export const PARTIDOS: Record<PartidoId, InfoPartido> = {
  PP: { id: 'PP', nombre: 'Partido Popular', siglas: 'PP', color: '#1d6fd1', candidato: 'Alberto Núñez Feijóo', bloque: 'C' },
  VOX: { id: 'VOX', nombre: 'Vox', siglas: 'Vox', color: '#5bbe21', candidato: 'Santiago Abascal', bloque: 'C' },
  PSOE: { id: 'PSOE', nombre: 'Partido Socialista Obrero Español', siglas: 'PSOE', color: '#e0001b', candidato: 'Pedro Sánchez', bloque: 'P' },
  SUMAR: { id: 'SUMAR', nombre: 'Frente Amplio', siglas: 'FA', color: '#e5007e', candidato: 'Ada Colau', bloque: 'P' },
  PODEMOS: { id: 'PODEMOS', nombre: 'Podemos', siglas: 'Podemos', color: '#8e44c4', candidato: 'Irene Montero' }, // comodín: va por libre
  ERC: { id: 'ERC', nombre: 'Esquerra Republicana', siglas: 'ERC', color: '#f4a800' },
  JUNTS: { id: 'JUNTS', nombre: 'Junts per Catalunya', siglas: 'Junts', color: '#1e90a0' },
  BILDU: { id: 'BILDU', nombre: 'EH Bildu', siglas: 'Bildu', color: '#a2d213' },
  PNV: { id: 'PNV', nombre: 'EAJ-PNV', siglas: 'PNV', color: '#007a4d' },
  BNG: { id: 'BNG', nombre: 'Bloque Nacionalista Galego', siglas: 'BNG', color: '#5da0d0' },
  CC: { id: 'CC', nombre: 'Coalición Canaria', siglas: 'CC', color: '#ffd200' },
  UPN: { id: 'UPN', nombre: 'Unión del Pueblo Navarro', siglas: 'UPN', color: '#c8102e' },
  COMPROMIS: { id: 'COMPROMIS', nombre: 'Compromís', siglas: 'Compromís', color: '#e59234' },
  ADELANTE: { id: 'ADELANTE', nombre: 'Adelante Andalucía', siglas: 'Adelante', color: '#4dab8e' },
  NC: { id: 'NC', nombre: 'Nueva Canarias', siglas: 'NC', color: '#9bbb3c' },
  SALF: { id: 'SALF', nombre: 'Se Acabó La Fiesta', siglas: 'SALF', color: '#6a585b' },
  SORIA: { id: 'SORIA', nombre: 'Soria ¡Ya!', siglas: 'Soria Ya', color: '#0b7b3e' },
  UPL: { id: 'UPL', nombre: 'Unión del Pueblo Leonés', siglas: 'UPL', color: '#bd0d60' },
  TE: { id: 'TE', nombre: 'Teruel Existe', siglas: 'TE', color: '#0b7b3e' },
  OTROS: { id: 'OTROS', nombre: 'Otros', siglas: 'Otros', color: '#8890a8' },
  BLANCO: { id: 'BLANCO', nombre: 'Voto en blanco', siglas: 'Blanco', color: '#c8ccd8' },
};

/** Orden de los escaños en el hemiciclo (izquierda → derecha). */
export const ORDEN_HEMICICLO: PartidoId[] = [
  'BILDU', 'PODEMOS', 'SUMAR', 'BNG', 'COMPROMIS', 'ADELANTE', 'ERC', 'PSOE', 'NC', 'PNV', 'JUNTS', 'CC', 'TE', 'SORIA', 'UPL', 'UPN', 'PP', 'SALF', 'VOX',
];

/** Afinidad inicial (−3 = socio del bloque progresista, +3 = del conservador). */
export const AFINIDAD_INICIAL: Record<RegionalId, number> = {
  ERC: -2, BILDU: -2, BNG: -2, COMPROMIS: -3, ADELANTE: -2, NC: -1, PNV: -1, JUNTS: 0, CC: 0, UPN: 3,
};

/** Provincias donde cada fuerza regional se presenta (para negociar hay que tener presencia allí). */
export const TERRITORIO: Record<RegionalId, string[]> = {
  ERC: ['08', '17', '25', '43'],
  JUNTS: ['08', '17', '25', '43'],
  BILDU: ['01', '20', '48', '31'],
  PNV: ['01', '20', '48'],
  BNG: ['15', '27', '32', '36'],
  CC: ['35', '38'],
  NC: ['35'],
  UPN: ['31'],
  COMPROMIS: ['46', '03', '12'],
  ADELANTE: ['04', '11', '14', '18', '21', '23', '29', '41'],
};

/** Negociar con estas fuerzas cuesta al Progresista 1 PV por paso («cesiones»). */
export const CESIONES_CARAS: RegionalId[] = ['ERC', 'JUNTS', 'BILDU'];

export const NOMBRE_BANDO: Record<Bando, string> = { P: 'Bloque Progresista', C: 'Bloque Conservador' };
export const CORTO_BANDO: Record<Bando, string> = { P: 'Progresista', C: 'Conservador' };
export const COLOR_BANDO: Record<Bando, string> = { P: '#d7263d', C: '#1d6fd1' };
export const LIDER: Record<Bando, string> = { P: 'Pedro Sánchez', C: 'Alberto Núñez Feijóo' };
