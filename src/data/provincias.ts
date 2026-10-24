// Las 52 circunscripciones del Congreso con sus atributos de juego.
// Escaños 2026 (RD 806/2026) y votos de partida en base.json (generado con `npm run datos`).
import base from './base.json';
import type { Bando, Provincia, Votos, Zona, ZonaId } from '../engine/tipos';

export const ZONAS: Record<ZonaId, Zona> = {
  AND: { id: 'AND', nombre: 'Andalucía', pv: [2, 5, 7], color: '#c9a227' },
  CAT: { id: 'CAT', nombre: 'Cataluña', pv: [2, 4, 6], color: '#d9822b' },
  MAD: { id: 'MAD', nombre: 'Madrid y Centro', pv: [2, 5, 7], color: '#8e6fc1' },
  LEV: { id: 'LEV', nombre: 'Levante y Baleares', pv: [2, 4, 6], color: '#2a9d8f' },
  INT: { id: 'INT', nombre: 'Interior', pv: [1, 3, 5], color: '#a26b4f' },
  NOR: { id: 'NOR', nombre: 'Cornisa Norte', pv: [1, 3, 5], color: '#4f8fbf' },
  CAN: { id: 'CAN', nombre: 'Canarias, Ceuta y Melilla', pv: [1, 2, 3], color: '#c46a8a' },
};

type Fila = [id: string, corto: string, zona: ZonaId, fidelidad: number, clave: boolean, feudo: Bando | null, x: number, y: number];

// x, y: posición de la caja en el mapa esquemático (viewBox 1340 × 1130)
const FILAS: Fila[] = [
  ['04', 'Almería', 'AND', 2, false, 'C', 770, 858],
  ['11', 'Cádiz', 'AND', 3, true, null, 392, 940],
  ['14', 'Córdoba', 'AND', 2, false, null, 500, 752],
  ['18', 'Granada', 'AND', 3, true, null, 640, 838],
  ['21', 'Huelva', 'AND', 2, false, 'P', 282, 820],
  ['23', 'Jaén', 'AND', 2, false, 'P', 640, 752],
  ['29', 'Málaga', 'AND', 3, true, null, 520, 900],
  ['41', 'Sevilla', 'AND', 3, true, 'P', 405, 838],
  ['08', 'Barcelona', 'CAT', 3, true, 'P', 1222, 285],
  ['17', 'Girona', 'CAT', 3, false, null, 1260, 205],
  ['25', 'Lleida', 'CAT', 3, false, null, 1105, 222],
  ['43', 'Tarragona', 'CAT', 2, true, null, 1080, 350],
  ['28', 'Madrid', 'MAD', 3, true, null, 610, 428],
  ['45', 'Toledo', 'MAD', 2, true, null, 560, 522],
  ['13', 'C. Real', 'MAD', 2, false, null, 600, 636],
  ['16', 'Cuenca', 'MAD', 2, false, null, 765, 508],
  ['19', 'Guadalajara', 'MAD', 2, false, null, 735, 388],
  ['02', 'Albacete', 'MAD', 2, false, null, 785, 640],
  ['06', 'Badajoz', 'MAD', 2, true, null, 365, 660],
  ['10', 'Cáceres', 'MAD', 2, false, null, 360, 535],
  ['46', 'Valencia', 'LEV', 3, true, null, 915, 575],
  ['03', 'Alicante', 'LEV', 3, true, null, 935, 685],
  ['12', 'Castellón', 'LEV', 2, false, null, 975, 470],
  ['30', 'Murcia', 'LEV', 3, true, 'C', 830, 762],
  ['07', 'Baleares', 'LEV', 3, true, null, 1215, 540],
  ['05', 'Ávila', 'INT', 2, false, 'C', 485, 424],
  ['09', 'Burgos', 'INT', 2, false, null, 615, 200],
  ['24', 'León', 'INT', 2, false, null, 368, 152],
  ['34', 'Palencia', 'INT', 2, false, null, 492, 185],
  ['37', 'Salamanca', 'INT', 2, false, 'C', 360, 395],
  ['40', 'Segovia', 'INT', 2, false, null, 576, 345],
  ['42', 'Soria', 'INT', 2, false, null, 726, 282],
  ['47', 'Valladolid', 'INT', 2, true, null, 490, 272],
  ['49', 'Zamora', 'INT', 2, false, null, 362, 270],
  ['22', 'Huesca', 'INT', 2, false, null, 980, 205],
  ['44', 'Teruel', 'INT', 2, false, null, 905, 395],
  ['50', 'Zaragoza', 'INT', 3, true, null, 865, 290],
  ['26', 'La Rioja', 'INT', 2, false, null, 738, 198],
  ['15', 'A Coruña', 'NOR', 3, true, null, 112, 92],
  ['27', 'Lugo', 'NOR', 2, false, 'C', 238, 100],
  ['32', 'Ourense', 'NOR', 2, false, 'C', 232, 210],
  ['36', 'Pontevedra', 'NOR', 3, true, null, 105, 185],
  ['33', 'Asturias', 'NOR', 3, true, 'P', 375, 64],
  ['39', 'Cantabria', 'NOR', 2, false, null, 560, 76],
  ['01', 'Álava', 'NOR', 3, false, null, 690, 125],
  ['20', 'Gipuzkoa', 'NOR', 3, false, 'P', 812, 82],
  ['48', 'Bizkaia', 'NOR', 3, true, null, 686, 50],
  ['31', 'Navarra', 'NOR', 3, false, null, 862, 160],
  ['35', 'Las Palmas', 'CAN', 3, true, null, 230, 1062],
  ['38', 'S.C. Tenerife', 'CAN', 3, true, null, 92, 1062],
  ['51', 'Ceuta', 'CAN', 1, false, null, 440, 1040],
  ['52', 'Melilla', 'CAN', 1, false, 'C', 660, 1040],
];

// Enlaces marítimos (como las conexiones de larga distancia de TS)
const MARITIMOS: [string, string][] = [
  ['07', '08'], ['07', '46'], ['35', '38'], ['35', '11'], ['38', '21'], ['51', '11'], ['51', '29'], ['52', '29'], ['52', '04'],
];

type Base = { id: string; nombre: string; escanos: number; vecinos: string[]; votos: Votos };

const porId = new Map((base.provincias as Base[]).map((p) => [p.id, p]));

export const PROVINCIAS: Provincia[] = FILAS.map(([id, corto, zona, fidelidad, clave, feudo, x, y]) => {
  const b = porId.get(id);
  if (!b) throw new Error('Provincia sin datos: ' + id);
  const vecinos = new Set(b.vecinos);
  for (const [a, c] of MARITIMOS) {
    if (a === id) vecinos.add(c);
    if (c === id) vecinos.add(a);
  }
  return { id, nombre: b.nombre, corto, zona, escanos: b.escanos, fidelidad, clave, feudo, vecinos: [...vecinos], x, y, base: b.votos };
});

export const PROV: Record<string, Provincia> = Object.fromEntries(PROVINCIAS.map((p) => [p.id, p]));
export const MADRID = '28';
export const FUENTE_DATOS: string = base.fuente;
export const MEDIA_NACIONAL: Record<string, number> = base.mediaNacional;
export const ENCUESTADORAS: string[] = base.encuestadoras;

/** Presencia inicial fija (la «foto» de la precampaña): cada bloque controla sus feudos. */
export const PRESENCIA_INICIAL: Record<string, { P?: number; C?: number }> = {
  // Conservador: controla 13 provincias
  '28': { C: 4, P: 1 },
  '30': { C: 3 },
  '29': { C: 3 },
  '46': { C: 3 },
  '03': { C: 2 },
  '05': { C: 2 },
  '37': { C: 2 },
  '32': { C: 2 },
  '27': { C: 2 },
  '04': { C: 2 },
  '15': { C: 3 },
  '45': { C: 2 },
  '50': { C: 2 },
  '52': { C: 1 },
  '51': { C: 1 },
  '39': { C: 1 },
  '07': { C: 2 },
  '47': { C: 1 },
  // Progresista: controla 11 provincias
  '08': { P: 3 },
  '41': { P: 3 },
  '33': { P: 3 },
  '21': { P: 2 },
  '23': { P: 2 },
  '20': { P: 3 },
  '43': { P: 2, C: 1 },
  '17': { P: 1 },
  '25': { P: 1 },
  '35': { P: 3 },
  '31': { P: 3 },
  '48': { P: 3 },
  '06': { P: 2 },
  '01': { P: 1 },
  '11': { P: 1 },
  '36': { P: 1 },
};
