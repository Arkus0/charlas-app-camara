// Genera src/data/mapa.json: la silueta real de las 52 circunscripciones en el sistema de coordenadas del juego.
// Fuentes: es-atlas 0.6.0 (IGN/CNIG, licencia MIT) y, para los países vecinos, world-atlas 2.0.2 (Natural Earth 1:50m).
// Proyección cónica conforme con Canarias en recuadro.
// Uso: npx tsx scripts/construir-mapa.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import { presimplify, quantile, simplify } from 'topojson-simplify';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: el paquete no trae tipos
import { geoConicConformalSpain } from 'd3-composite-projections';

const ANCHO = 1000;
const ALTO = 800;
const MARGEN = 16;

const original = JSON.parse(readFileSync(new URL('../data/fuentes/es-provincias.topo.json', import.meta.url), 'utf8'));
// Gibraltar no es circunscripción; se dibuja aparte como tierra sin juego
const pre = presimplify(original);
const topo = simplify(pre, quantile(pre, 0.25));
const provincias = feature(topo, topo.objects.provinces) as unknown as GeoJSON.FeatureCollection;
const proyeccion = geoConicConformalSpain().fitExtent([[MARGEN, MARGEN], [ANCHO - MARGEN, ALTO - MARGEN]], provincias);
const camino = geoPath(proyeccion).digits(1);

// Portugal, Francia, Andorra, Marruecos y Argelia: tierra sin juego alrededor de España
const vecinos = JSON.parse(readFileSync(new URL('../data/fuentes/vecinos.geo.json', import.meta.url), 'utf8')) as GeoJSON.FeatureCollection;

const salida: { fuente: string; ancho: number; alto: number; provincias: Record<string, string>; centros: Record<string, [number, number]>; costa: string; recuadro: string; gibraltar: string; vecinos: string } = {
  fuente: 'es-atlas 0.6.0 (IGN/CNIG, MIT) · world-atlas 2.0.2 (Natural Earth)',
  ancho: ANCHO,
  alto: ALTO,
  provincias: {},
  centros: {},
  // contorno exterior (para el trazo de costa) y la línea del recuadro de Canarias
  costa: camino(mesh(topo, topo.objects.provinces, (a: unknown, b: unknown) => a === b) as never) ?? '',
  recuadro: proyeccion.getCompositionBorders(),
  gibraltar: '',
  vecinos: vecinos.features.map((f) => camino(f) ?? '').join(''),
};
for (const f of provincias.features) {
  const id = String(f.id).padStart(2, '0');
  if (id === '54') { salida.gibraltar = camino(f) ?? ''; continue; }
  salida.provincias[id] = camino(f) ?? '';
  const [x, y] = camino.centroid(f);
  salida.centros[id] = [Math.round(x), Math.round(y)];
}
writeFileSync(new URL('../src/data/mapa.json', import.meta.url), JSON.stringify(salida));
console.log(`src/data/mapa.json: ${Object.keys(salida.provincias).length} provincias, ${Math.round(JSON.stringify(salida).length / 1024)} KB`);
