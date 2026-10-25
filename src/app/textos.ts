// Textos y formatos de la interfaz.
import { CORTO_BANDO, PARTIDOS } from '../data/partidos';
import { PROV, ZONAS } from '../data/provincias';
import { CORTO_TEMA, NOMBRE_TEMA } from '../motor/agenda';
import { NOMBRE_RAMA } from '../motor/maquinaria';
import type { Bando, ZonaId } from '../motor/base';
import type { Modo, Rama, Tema } from '../motor/tipos';

export const ZONA_CORTA: Record<ZonaId, string> = {
  AND: 'Andalucía', CAT: 'Cataluña', MAD: 'Madrid y Centro', LEV: 'Levante', INT: 'Interior', NOR: 'Norte', CAN: 'Canarias',
};

export const NOMBRE_MODO: Record<Modo, string> = {
  evento: 'Evento', implantar: 'Implantar', atacar: 'Atacar', negociar: 'Negociar', agenda: 'Marcar agenda', maquinaria: 'Maquinaria',
};

export const AYUDA_MODO: Record<Modo, string> = {
  evento: 'Haz lo que dice la carta.',
  implantar: 'Reparte sus PC como presencia en una zona (máx. 2 por provincia; cuesta 2 donde manda el rival).',
  atacar: 'PC + vecinas tuyas + 1 − Fidelidad, ± dado: quitas esa presencia al rival y el sobrante es tuyo.',
  negociar: 'Acerca una fuerza regional (1 paso cada 2 PC) o mueve a Podemos.',
  agenda: 'Calienta un tema (+2) o enfría otro (−2).',
  maquinaria: 'Descártala para subir un nivel de tu Maquinaria.',
};

export const NOMBRE_CLIMA: Record<number, string> = { 5: 'Sereno', 4: 'Tenso', 3: 'Bronco', 2: 'Guerra sucia', 1: 'Ruptura' };

export const LIDER: Record<Bando, string> = { P: 'Sánchez', C: 'Feijóo' };
export const SIGLAS_BLOQUE: Record<Bando, string> = { P: 'PSOE+FA', C: 'PP+Vox' };
export const PARTIDO_BLOQUE: Record<Bando, string> = { P: 'PSOE', C: 'PP' };

export const bandoTxt = (b: Bando) => CORTO_BANDO[b];

/** Nombre de cualquier destino: zona, provincia, partido, tema o rama. */
export function nombreDestino(destino: string | undefined, modo?: Modo): string {
  if (!destino || destino === '-') return '';
  if (modo === 'maquinaria' || (NOMBRE_RAMA as Record<string, string>)[destino]) return NOMBRE_RAMA[destino as Rama];
  if ((NOMBRE_TEMA as Record<string, string>)[destino]) return NOMBRE_TEMA[destino as Tema];
  if (PROV[destino]) return PROV[destino].nombre;
  if ((ZONAS as Record<string, unknown>)[destino]) return ZONAS[destino as ZonaId].nombre;
  if ((PARTIDOS as Record<string, unknown>)[destino]) return PARTIDOS[destino as keyof typeof PARTIDOS].siglas;
  return destino;
}

export const nombreProv = (id: string) => PROV[id].nombre.replace('Alacant/Alicante', 'Alicante').replace('València/Valencia', 'Valencia').replace('Castelló/Castellón', 'Castellón').replace('Araba/Álava', 'Álava');

export { CORTO_TEMA, NOMBRE_TEMA, NOMBRE_RAMA };

export const signo = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

export function fmtVentaja(v: number): string {
  return v === 0 ? 'empate' : `+${Math.abs(v)} ${v > 0 ? 'PP' : 'PSOE'}`;
}
