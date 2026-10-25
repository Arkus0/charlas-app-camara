// Prueba de humo de la interfaz móvil: juega una partida completa en un móvil emulado (390 × 844, táctil).
// Uso: npm run build && node scripts/prueba-movil.cjs [carpeta-capturas]
const { chromium, devices } = require('playwright');
const path = require('path');

(async () => {
  const dir = process.argv[2] || 'capturas-movil';
  require('fs').mkdirSync(dir, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], defaultBrowserType: undefined });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(String(e)));
  p.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  await p.goto('file://' + path.resolve('dist/index.html') + '#rapido');
  await p.screenshot({ path: `${dir}/menu.png`, fullPage: true });
  await p.click('text=Disolver las Cortes');
  const clic = async (el) => { try { await el.click({ timeout: 1500 }); } catch { /* el plató puede abrirse en medio */ } };
  const foto = async (nombre) => { await p.waitForTimeout(400); await p.screenshot({ path: `${dir}/${nombre}.png` }); };
  let platos = 0;
  const hechas = new Set();
  const t0 = Date.now();
  for (let i = 0; i < 8000 && Date.now() - t0 < 20 * 60 * 1000; i++) {
    if (await p.$('.noche')) break;
    if (await p.$('.plato')) {
      platos++;
      if (platos === 1) { await p.waitForTimeout(2200); await foto('plato'); }
      await clic(await p.$('.plato-pie button.principal'));
      continue;
    }
    // capturas de cada pantalla, una vez
    if (!hechas.has('mapa') && (await p.$('.mapa-tactil .prov-real.opcion'))) {
      hechas.add('mapa');
      await foto('mapa-eligiendo');
      await clic(await p.$('.conmutador button:has-text("Tablero")'));
      await foto('tablero-eligiendo');
      await clic(await p.$('.conmutador button:has-text("Lista")'));
      await foto('lista-eligiendo');
      await clic(await p.$('.conmutador button:has-text("Mapa")'));
    }
    if (!hechas.has('marcadores') && i > 60) {
      hechas.add('marcadores');
      await clic(await p.$('.barra-toque'));
      await foto('marcadores');
      await clic(await p.$('.hoja-cab button'));
      await clic(await p.$('.pestanas button:has-text("Congreso")'));
      await foto('congreso');
      await clic(await p.$('.pestanas button:has-text("Campaña")'));
      await foto('campana');
      await clic(await p.$('.pestanas button:has-text("Mapa")'));
      continue;
    }
    const fila = await p.$('.fila-prov.opcion');
    if (fila) { await clic(fila); continue; }
    // en el mapa, el centro de la caja de una provincia puede caer en la vecina: se dispara el clic sobre la propia forma
    const prov = (await p.$('.prov-real.opcion')) || (await p.$('g.prov.opcion'));
    if (prov) { await prov.dispatchEvent('click'); continue; }
    const principal = await p.$('.dock button.boton.principal');
    if (principal) { await clic(principal); continue; }
    const filaCarta = await p.$('.dock .carta-fila:not(.sel)');
    if (filaCarta && !(await p.$('.dock .carta-fila.sel'))) { await clic(filaCarta); continue; }
    const boton = await p.$('.dock .botones button');
    if (boton) { await clic(boton); continue; }
    const carta = await p.$('.mano-movil .fila-carta.usable');
    if (carta) {
      await clic(carta);
      if (!hechas.has('mano')) { hechas.add('mano'); await foto('mano'); }
      continue;
    }
    // la decisión de carta puede estar en la mano: ir a la pestaña
    if (await p.$('.pestanas button.aviso')) { await clic(await p.$('.pestanas button.aviso')); continue; }
    await p.waitForTimeout(60);
  }
  const fin = await p.$('.noche');
  if (await p.$('.plato')) {
    await p.waitForTimeout(2500);
    await foto('especial');
    await clic(await p.$('.plato-pie button.principal'));
  }
  await p.screenshot({ path: `${dir}/noche.png`, fullPage: true });
  const anchoDesborda = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  console.log(JSON.stringify({ terminada: !!fin, segundos: Math.round((Date.now() - t0) / 1000), platos, capturas: [...hechas], desbordaEnHorizontal: anchoDesborda, errores }, null, 1));
  await b.close();
  process.exit(fin && errores.length === 0 && !anchoDesborda ? 0 : 1);
})();
