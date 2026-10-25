// Dibuja docs/mapa-referencia.png: la silueta exacta de España tal como la pinta el juego, en el lienzo 3:2 (1536 × 1024)
// que genera ChatGPT. Sirve de base para que la ilustración del relieve (src/assets/mapa/tierra.png) case con el mapa.
// Uso: node scripts/mapa-referencia.cjs
const { chromium } = require('playwright');
const path = require('path');
const mapa = require('../src/data/mapa.json');

(async () => {
  const W = 1536, H = 1024;
  const esc = H / mapa.alto; // el lienzo del juego (5:4) ocupa todo el alto, centrado
  const dx = (W - mapa.ancho * esc) / 2;
  const provincias = Object.values(mapa.provincias).map((d) => `<path d="${d}"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#ffffff"/>
    <g transform="translate(${dx} 0) scale(${esc})">
      <g fill="#1a1a1a" stroke="#1a1a1a" stroke-width="0.6" stroke-linejoin="round">${provincias}</g>
      <path d="${mapa.gibraltar}" fill="#1a1a1a"/>
      <path d="${mapa.recuadro}" fill="none" stroke="#9a9a9a" stroke-width="1.6" stroke-dasharray="7 6"/>
    </g>
  </svg>`;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: H } });
  await p.setContent(`<html><body style="margin:0">${svg}</body></html>`);
  const destino = path.resolve(__dirname, '../docs/mapa-referencia.png');
  await p.screenshot({ path: destino, clip: { x: 0, y: 0, width: W, height: H } });
  await b.close();
  console.log('→', destino);
})();
