// Convierte el index.html de un solo fichero en el fragmento que pide un Artifact de claude.ai:
// sin <!doctype>, <html>, <head> ni <body> (los pone la plataforma), con el título al principio.
import { readFileSync, writeFileSync } from 'node:fs';

let html = readFileSync('dist-artefacto/index.html', 'utf8');
html = html
  .replace(/<!doctype html>/i, '')
  .replace(/<\/?(html|head|body)\b[^>]*>/gi, '')
  .replace(/<meta charset[^>]*>\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '');
const titulo = /<title>[^<]*<\/title>/.exec(html)?.[0] ?? '<title>Clavel Negro</title>';
html = titulo + '\n' + html.replace(titulo, '').trim() + '\n';
writeFileSync('dist-artefacto/clavel-negro.html', html);
console.log(`dist-artefacto/clavel-negro.html: ${(html.length / 1024).toFixed(0)} kB`);
