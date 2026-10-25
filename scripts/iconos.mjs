// Genera los iconos de la PWA en public/ (se ejecuta a mano si cambia el diseño): node scripts/iconos.mjs
// Un hemiciclo rojo y azul con la línea de la mayoría absoluta y el «176». Sin texto: los números son trazos,
// así el icono sale igual en cualquier máquina.
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

function svg({ redondeado }) {
  const x0 = 160, x1 = 228, x2 = 296; // «1», «7», «6»
  const trazo = 'fill="none" stroke="#f3f1ea" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="${redondeado ? 104 : 0}" fill="#0d1524"/>
  <g transform="translate(0 22)">
  <path d="M 96 330 A 160 160 0 0 1 252 170" fill="none" stroke="#e5483f" stroke-width="44"/>
  <path d="M 260 170 A 160 160 0 0 1 416 330" fill="none" stroke="#3a86e8" stroke-width="44"/>
  <path d="M 256 136 L 256 204" stroke="#e8b64a" stroke-width="10" stroke-linecap="round"/>
  <g transform="translate(0 12)">
  <path d="M ${x0 + 12} 240 L ${x0 + 34} 222 L ${x0 + 34} 318" ${trazo}/>
  <path d="M ${x1 + 2} 222 L ${x1 + 54} 222 L ${x1 + 22} 318" ${trazo}/>
  <path d="M ${x2 + 48} 224 C ${x2 + 20} 226 ${x2 + 4} 252 ${x2 + 4} 290" ${trazo}/>
  <circle cx="${x2 + 29}" cy="292" r="25" ${trazo}/>
  </g>
  </g>
</svg>`;
}

const salidas = [
  ['public/icono.svg', null, { redondeado: true }],
  ['public/icono-192.png', 192, { redondeado: true }],
  ['public/icono-512.png', 512, { redondeado: true }],
  ['public/icono-maskable-512.png', 512, { redondeado: false }],
  ['public/apple-touch-icon.png', 180, { redondeado: false }],
];
for (const [ruta, tam, op] of salidas) {
  const fuente = svg(op);
  if (!tam) writeFileSync(ruta, fuente + '\n');
  else await sharp(Buffer.from(fuente)).resize(tam, tam).png({ compressionLevel: 9 }).toFile(ruta);
  console.log(ruta);
}
