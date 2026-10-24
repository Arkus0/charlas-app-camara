/**
 * Genera src/data/base.json a partir de las fuentes de data/fuentes:
 *  - electopanel_provincias_2026-10-12.csv: estimación provincial de ElectoPanel (12-10-2026)
 *  - encuestas_nacionales.csv: encuestas nacionales publicadas (ciclo 2026)
 *  - prov_geo.json: centroides y vecinos (es-atlas 0.6.0, IGN/CNIG)
 *
 * La base de partida reparte la media nacional de encuestas de octubre de 2026
 * por provincias con la distribución de ElectoPanel (swing proporcional).
 * Escaños 2026: los de 2023 salvo Madrid (38) y Cádiz (8), según el RD 806/2026.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const FUENTES = new URL('../data/fuentes/', import.meta.url);
const leer = (f: string) => readFileSync(new URL(f, FUENTES), 'utf-8');

function csv(texto: string): string[][] {
  return texto.trim().split(/\r?\n/).map((l) => l.split(','));
}

// columna del CSV -> clave de partido del juego
const COLUMNA_A_PARTIDO: Record<string, string> = {
  PP: 'PP', PSOE: 'PSOE', VOX: 'VOX', SUMAR: 'SUMAR', Podemos: 'PODEMOS',
  ERC: 'ERC', JUNTS: 'JUNTS', 'EH BILDU': 'BILDU', PNV: 'PNV', BNG: 'BNG',
  CC: 'CC', UPN: 'UPN', Compromis: 'COMPROMIS', AA: 'ADELANTE', 'Adelante And.': 'ADELANTE',
  SALF: 'SALF', NC: 'NC', 'Soria ¡Ya!': 'SORIA', UPL: 'UPL', 'Teruel Existe': 'TE',
  'Voto en blanco': 'BLANCO',
};

const ESCANOS_2026: Record<string, number> = { Madrid: 38, 'Cádiz': 8 };

// --- media nacional de encuestas (octubre de 2026) ---
const enc = csv(leer('encuestas_nacionales.csv'));
const cab = enc[0];
const idx = (c: string) => cab.indexOf(c);
const filas = enc.slice(1).filter((r) => r[idx('ciclo')] === '2026' && r[idx('tipo')] === 'encuesta' && r[idx('fin')] >= '2026-10-01');
// excluimos encuestas encargadas por partidos y las reestimaciones del CIS hechas por terceros
const validas = filas.filter((r) => !['PP', 'PSOE'].includes(r[idx('medio')]) && !/\(.+\)/.test(r[idx('encuestadora')]) && r[idx('PP')] !== '');
// una por encuestadora: la más reciente
const porCasa = new Map<string, string[]>();
for (const r of validas) {
  const casa = r[idx('encuestadora')];
  const prev = porCasa.get(casa);
  if (!prev || prev[idx('fin')] < r[idx('fin')]) porCasa.set(casa, r);
}
const MEDIA_COLS = ['PP', 'PSOE', 'VOX', 'SUMAR', 'PODEMOS', 'ERC', 'JUNTS', 'BILDU', 'PNV', 'BNG', 'CC', 'SALF'];
const media: Record<string, number> = {};
for (const c of MEDIA_COLS) {
  const vals = [...porCasa.values()].map((r) => parseFloat(r[idx(c)])).filter((v) => !Number.isNaN(v));
  media[c] = +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
}
const encuestadoras = [...porCasa.keys()].sort();

// --- base provincial ---
const ep = csv(leer('electopanel_provincias_2026-10-12.csv'));
const hdr = ep[2];
const datos = ep.slice(3);
type Prov = { nombre: string; censo: number; escanos: number; votos: Record<string, number> };
const provs: Prov[] = datos.map((r) => {
  const votos: Record<string, number> = {};
  hdr.forEach((h, i) => {
    if (i < 4) return;
    const v = r[i] === 'null' || r[i] === '' ? 0 : parseFloat(r[i]);
    if (!v) return;
    const k = COLUMNA_A_PARTIDO[h] ?? 'OTROS';
    votos[k] = (votos[k] ?? 0) + v;
  });
  return { nombre: r[0], censo: +r[1], escanos: ESCANOS_2026[r[0]] ?? +r[3], votos };
});

// swing proporcional: cada partido de la media nacional se escala por (media / total ElectoPanel)
const totalValidos = provs.reduce((a, p) => a + Object.values(p.votos).reduce((x, y) => x + y, 0), 0);
const totalPartido = (k: string) => provs.reduce((a, p) => a + (p.votos[k] ?? 0), 0);
const factor: Record<string, number> = {};
for (const k of MEDIA_COLS) factor[k] = (media[k] / 100) / (totalPartido(k) / totalValidos);
for (const p of provs) {
  const antes = Object.values(p.votos).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(p.votos)) p.votos[k] *= factor[k] ?? 1;
  const despues = Object.values(p.votos).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(p.votos)) p.votos[k] = Math.round((p.votos[k] * antes) / despues);
}

// --- geografía ---
const geo: { id: string; name: string; lon: number; lat: number; nb: string[] }[] = JSON.parse(leer('prov_geo.json'));
const porNombre = new Map(geo.map((g) => [g.name, g]));
const salida = provs.map((p) => {
  const g = porNombre.get(p.nombre);
  if (!g) throw new Error('Sin geografía: ' + p.nombre);
  return { id: g.id, nombre: p.nombre, censo: p.censo, escanos: p.escanos, lon: g.lon, lat: g.lat, vecinos: g.nb.filter((n) => n !== '54'), votos: p.votos };
});
const escTot = salida.reduce((a, p) => a + p.escanos, 0);
if (escTot !== 350) throw new Error('Escaños: ' + escTot);

writeFileSync(
  new URL('../src/data/base.json', import.meta.url),
  JSON.stringify({ fuente: 'Media de encuestas nacionales de octubre de 2026 repartida con la estimación provincial de ElectoPanel (12-10-2026)', encuestadoras, mediaNacional: media, provincias: salida }, null, 1),
);
console.log('Media nacional', media, 'de', encuestadoras.length, 'encuestadoras');
console.log('Provincias', salida.length, 'escaños', escTot);
