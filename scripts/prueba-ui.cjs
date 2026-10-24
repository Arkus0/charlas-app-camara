// Prueba de humo de la interfaz: juega una partida completa contra la IA haciendo clic.
// Uso: npm run build && node scripts/prueba-ui.cjs [carpeta-capturas]
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const dir = process.argv[2] || 'capturas';
  require('fs').mkdirSync(dir, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errores = [];
  p.on('pageerror', (e) => errores.push(String(e)));
  p.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  await p.goto('file://' + path.resolve('dist/index.html') + '#rapido');
  await p.click('text=Disolver las Cortes');
  let capturas = 0;
  for (let i = 0; i < 4000; i++) {
    if (await p.$('.noche')) break;
    const prov = await p.$('g.prov.opcion');
    if (prov) { await prov.click(); continue; }
    const principal = await p.$('.decision button.boton.principal');
    if (principal) { await principal.click(); continue; }
    const boton = await p.$('.decision .botones button');
    if (boton) { await boton.click(); continue; }
    const carta = await p.$('.mano button.carta:not(.inactiva)');
    if (carta) {
      await carta.click();
      if (capturas < 2 && i > 30) { await p.screenshot({ path: `${dir}/partida-${++capturas}.png` }); }
      continue;
    }
    await p.waitForTimeout(60);
  }
  const fin = await p.$('.noche');
  await p.screenshot({ path: `${dir}/noche-electoral.png`, fullPage: true });
  console.log(JSON.stringify({ terminada: !!fin, titular: fin ? await p.textContent('.titular') : null, motivo: fin ? await p.textContent('.motivo') : null, errores }, null, 1));
  await b.close();
  process.exit(fin && errores.length === 0 ? 0 : 1);
})();
