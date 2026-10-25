// Prepara las ilustraciones para la web: convierte lo que haya en src/assets/cartas y src/assets/mapa
// (PNG, JPG o WebP tal como salen de ChatGPT) a WebP ligeros, recortados al formato del juego, en src/assets/web/.
// Se ejecuta solo antes de compilar o de arrancar el servidor de desarrollo (npm run build / npm run dev).
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const RAIZ = new URL('../src/assets/', import.meta.url).pathname;
const SALIDA = join(RAIZ, 'web');
const EXT = /\.(png|jpe?g|webp)$/i;

// cartas: «101.png», «101 - Encuesta Andalucía.png» o «101_v2.jpg» valen; manda el número del principio
const NUM = /^(\d+)(?:[\s._-].*)?\.(png|jpe?g|webp)$/i;

function fuentes(dir, clave) {
  if (!existsSync(dir)) return new Map();
  const porClave = new Map();
  for (const f of readdirSync(dir)) {
    const k = clave(f);
    if (k === null) continue;
    const ruta = join(dir, f);
    const t = statSync(ruta).mtimeMs;
    // si hay varias versiones de la misma, la más reciente
    if (!porClave.has(k) || porClave.get(k).t < t) porClave.set(k, { ruta, t });
  }
  return porClave;
}

/** Recorta el centro con la proporción pedida (sin deformar) y lo guarda como WebP. */
async function preparar(origen, destino, ancho, alto, calidad) {
  const img = sharp(origen, { failOn: 'none' }).rotate();
  const { width: w, height: h } = await img.metadata();
  const objetivo = ancho / alto;
  let cw = w, ch = h;
  if (w / h > objetivo) cw = Math.round(h * objetivo); else ch = Math.round(w / objetivo);
  await img
    .extract({ left: Math.floor((w - cw) / 2), top: Math.floor((h - ch) / 2), width: cw, height: ch })
    .resize(ancho, alto, { fit: 'fill' })
    .webp({ quality: calidad, effort: 5 })
    .toFile(destino);
}

async function lote(nombre, dir, clave, medida) {
  const dirSalida = join(SALIDA, nombre);
  mkdirSync(dirSalida, { recursive: true });
  const lista = fuentes(dir, clave);
  let hechas = 0;
  for (const [k, { ruta, t }] of lista) {
    const destino = join(dirSalida, `${k}.webp`);
    if (existsSync(destino) && statSync(destino).mtimeMs >= t) continue;
    const [ancho, alto, calidad] = medida(k);
    try {
      await preparar(ruta, destino, ancho, alto, calidad);
      hechas++;
    } catch (err) {
      console.warn(`  ✗ ${ruta}: ${err.message}`);
    }
  }
  // las que ya no tienen original se borran
  for (const f of readdirSync(dirSalida)) {
    if (!lista.has(f.replace(/\.webp$/, ''))) rmSync(join(dirSalida, f));
  }
  console.log(`ilustraciones · ${nombre}: ${lista.size} (${hechas} nuevas)`);
}

await lote('cartas', join(RAIZ, 'cartas'), (f) => f.match(NUM)?.[1] ?? null, () => [800, 600, 78]);
// el mapa ocupa un lienzo 5:4 (1000 × 800 en el juego); de una imagen 3:2 se toma la franja central
await lote('mapa', join(RAIZ, 'mapa'), (f) => {
  const m = f.match(/^(mar|tierra)\.(png|jpe?g|webp)$/i);
  return m && EXT.test(f) ? m[1].toLowerCase() : null;
}, (k) => (k === 'tierra' ? [2000, 1600, 80] : [1500, 1200, 72]));
