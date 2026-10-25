// Convierte dist/index.html en una página para publicar como Artifact de claude.ai
// (sin <!doctype>, <html>, <head> ni <body>: el visor añade su propio esqueleto).
// Uso: npm run build:artefacto && node scripts/artefacto.mjs [dist-artefacto/index.html] [salida.html]
import { readFileSync, writeFileSync } from 'node:fs';

const [entrada = 'dist-artefacto/index.html', salida = 'dist-artefacto/artefacto.html'] = process.argv.slice(2);
const html = readFileSync(entrada, 'utf-8');
const cabeza = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const cuerpo = html.match(/<body>([\s\S]*?)<\/body>/)[1];
const util = cabeza
  .replace(/<meta charset[^>]*>\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '');
writeFileSync(salida, `${util.trim()}\n${cuerpo.trim()}\n`);
console.log(`${salida}: ${(readFileSync(salida).length / 1024).toFixed(0)} KB`);
