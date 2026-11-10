// Construye el atlas del juego a partir de los packs originales (recursos/originales):
// recorta cada sprite, lo pasa a color de 15 bits (como la SNES), remapea los packs ajenos
// a la paleta maestra (la del pack base, ArMM1998) y lo empaqueta todo en src/recursos/.
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { CATALOGO } from './catalogo.mjs';

const ORIG = 'recursos/originales';
const HOJAS = {
  o: `${ORIG}/armm1998-zelda-like/Overworld.png`,
  i: `${ORIG}/armm1998-zelda-like/Inner.png`,
  c: `${ORIG}/armm1998-zelda-like/cave.png`,
  b: `${ORIG}/armm1998-zelda-like/objects.png`,
  k: `${ORIG}/kenney-rpg-urban-pack/tilemap_packed.png`,
};
const AJENAS = new Set(['k']); // hojas que se remapean a la paleta maestra

const q5 = (v) => (v & 0xf8) | (v >> 5);

async function cargar(ruta) {
  const { data, info } = await sharp(ruta).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    data[i] = q5(data[i]); data[i + 1] = q5(data[i + 1]); data[i + 2] = q5(data[i + 2]);
    if (data[i + 3] < 24) data[i + 3] = 0;
  }
  return { data, w: info.width, h: info.height };
}

const hojas = {};
for (const [k, ruta] of Object.entries(HOJAS)) hojas[k] = await cargar(ruta);

// Paleta maestra: todos los colores opacos del pack base.
const paleta = new Map();
for (const k of ['o', 'i', 'c', 'b']) {
  const { data } = hojas[k];
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 0) paleta.set((data[i] << 16) | (data[i + 1] << 8) | data[i + 2], 1);
}
const pj = await cargar(`${ORIG}/armm1998-zelda-like/character.png`);
for (let i = 0; i < pj.data.length; i += 4) {
  if (pj.data[i + 3] < 200) pj.data[i + 3] = 0; // fuera la sombra incrustada: la dibuja el motor
  else paleta.set((pj.data[i] << 16) | (pj.data[i + 1] << 8) | pj.data[i + 2], 1);
}
const colores = [...paleta.keys()];
const cache = new Map();
function cercano(r, g, b) {
  const clave = (r << 16) | (g << 8) | b;
  if (paleta.has(clave)) return clave;
  let m = cache.get(clave);
  if (m !== undefined) return m;
  let mejor = Infinity;
  for (const c of colores) {
    const dr = ((c >> 16) & 255) - r, dg = ((c >> 8) & 255) - g, db = (c & 255) - b;
    const d = dr * dr * 3 + dg * dg * 4 + db * db * 2;
    if (d < mejor) { mejor = d; m = c; }
  }
  cache.set(clave, m);
  return m;
}
for (const k of AJENAS) {
  const { data } = hojas[k];
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const c = cercano(data[i], data[i + 1], data[i + 2]);
    data[i] = c >> 16; data[i + 1] = (c >> 8) & 255; data[i + 2] = c & 255; data[i + 3] = 255;
  }
}

/** Caja de la componente conexa que contiene la casilla semilla (opcionalmente dentro de un recorte). */
function componente(hoja, semillas, recorte) {
  const { data, w, h } = hojas[hoja];
  const [x0, y0, x1, y1] = recorte ? recorte.map((v) => v * 16) : [0, 0, w, h];
  const visto = new Uint8Array(w * h);
  const pila = [];
  for (const [cx, cy] of semillas) {
    for (let y = cy * 16; y < cy * 16 + 16; y++) for (let x = cx * 16; x < cx * 16 + 16; x++) {
      if (x >= x0 && x < x1 && y >= y0 && y < y1 && data[(y * w + x) * 4 + 3]) pila.push(x, y);
    }
  }
  if (!pila.length) throw new Error(`semilla vacía en ${hoja} ${JSON.stringify(semillas)}`);
  let ax = w, ay = h, bx = 0, by = 0;
  while (pila.length) {
    const y = pila.pop(), x = pila.pop();
    if (x < x0 || x >= x1 || y < y0 || y >= y1 || visto[y * w + x] || !data[(y * w + x) * 4 + 3]) continue;
    visto[y * w + x] = 1;
    if (x < ax) ax = x; if (x > bx) bx = x; if (y < ay) ay = y; if (y > by) by = y;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) pila.push(x + dx, y + dy);
  }
  return [ax, ay, bx - ax + 1, by - ay + 1];
}

function recortar(hoja, [x, y, w, h]) {
  const src = hojas[hoja];
  const out = Buffer.alloc(w * h * 4);
  for (let j = 0; j < h; j++) src.data.copy(out, j * w * 4, ((y + j) * src.w + x) * 4, ((y + j) * src.w + x + w) * 4);
  return { data: out, w, h };
}

const sprites = [];
for (const e of CATALOGO) {
  let img;
  if (e.rect) img = recortar(e.hoja, e.rect.map((v) => v * 16));
  else if (e.px) img = recortar(e.hoja, e.px);
  else img = recortar(e.hoja, componente(e.hoja, e.semillas, e.recorte));
  if (e.tinte) {
    const [tr, tg, tb] = e.tinte;
    for (let i = 0; i < img.data.length; i += 4) {
      if (!img.data[i + 3]) continue;
      const c = cercano(Math.min(255, Math.round(img.data[i] * tr)), Math.min(255, Math.round(img.data[i + 1] * tg)), Math.min(255, Math.round(img.data[i + 2] * tb)));
      img.data[i] = c >> 16; img.data[i + 1] = (c >> 8) & 255; img.data[i + 2] = c & 255;
    }
  }
  sprites.push({ n: e.n, ...img });
}

// Empaquetado por estantes.
const ANCHO = 512;
const orden = [...sprites].sort((a, b) => b.h - a.h || b.w - a.w);
let x = 0, y = 0, alto = 0;
const pos = {};
for (const s of orden) {
  if (x + s.w > ANCHO) { x = 0; y += alto + 1; alto = 0; }
  pos[s.n] = [x, y, s.w, s.h];
  x += s.w + 1; alto = Math.max(alto, s.h);
}
const ALTO = y + alto;
const atlas = Buffer.alloc(ANCHO * ALTO * 4);
for (const s of sprites) {
  const [px, py] = pos[s.n];
  for (let j = 0; j < s.h; j++) s.data.copy(atlas, ((py + j) * ANCHO + px) * 4, j * s.w * 4, (j + 1) * s.w * 4);
}

mkdirSync('src/recursos', { recursive: true });
await sharp(atlas, { raw: { width: ANCHO, height: ALTO, channels: 4 } }).png({ compressionLevel: 9 }).toFile('src/recursos/atlas.png');
await sharp(pj.data, { raw: { width: pj.w, height: pj.h, channels: 4 } }).png({ compressionLevel: 9 }).toFile('src/recursos/pj.png');
writeFileSync('src/recursos/atlas.json', JSON.stringify(pos));
writeFileSync('src/recursos/paleta.json', JSON.stringify(colores.map((c) => '#' + c.toString(16).padStart(6, '0'))));
console.log(`atlas ${ANCHO}x${ALTO}, ${sprites.length} sprites, paleta de ${colores.length} colores`);
