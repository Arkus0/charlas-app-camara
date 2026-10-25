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
  let platos = 0;
  // el plató puede abrirse justo entre buscar un elemento y pulsarlo: los clics no deben bloquear la prueba
  const clic = async (el) => { try { await el.click({ timeout: 1500 }); } catch { /* se reintenta en la siguiente vuelta */ } };
  for (let i = 0; i < 6000; i++) {
    if (await p.$('.noche')) break;
    // el plató al cerrar cada semana
    if (await p.$('.plato')) {
      platos++;
      if (platos === 1) { await p.waitForTimeout(2200); await p.screenshot({ path: `${dir}/plato-semana.png` }); }
      await clic(await p.$('.plato-pie button.principal'));
      continue;
    }
    const prov = (await p.$('.prov-real.opcion')) || (await p.$('g.prov.opcion'));
    if (prov) {
      if (capturas === 0 && !(await p.$('.mapa-mostrado'))) {
        await p.screenshot({ path: `${dir}/mapa-real-eligiendo.png` });
        await p.evaluate(() => document.body.classList.add('mapa-mostrado'));
      }
      await prov.dispatchEvent('click');
      continue;
    }
    const principal = await p.$('.decision button.boton.principal');
    if (principal) { await clic(principal); continue; }
    const fila = await p.$('.decision .carta-fila:not(.sel)');
    if (fila && !(await p.$('.decision .carta-fila.sel'))) { await clic(fila); continue; }
    const boton = await p.$('.decision .botones button');
    if (boton) { await clic(boton); continue; }
    const carta = await p.$('.mano button.carta:not(.inactiva)');
    if (carta) {
      await clic(carta);
      if (capturas < 2 && i > 30) { await p.screenshot({ path: `${dir}/partida-${++capturas}.png` }); }
      continue;
    }
    await p.waitForTimeout(60);
  }
  const fin = await p.$('.noche');
  const especial = await p.$('.plato');
  if (especial) {
    await p.waitForTimeout(2500);
    await p.screenshot({ path: `${dir}/especial.png` });
    await p.click('.plato-pie button.principal');
  }
  await p.screenshot({ path: `${dir}/noche-electoral.png`, fullPage: true });
  console.log(JSON.stringify({ terminada: !!fin, platosSemanales: platos, especial: !!especial, titular: fin ? await p.textContent('.titular') : null, motivo: fin ? await p.textContent('.motivo') : null, errores }, null, 1));
  await b.close();
  process.exit(fin && errores.length === 0 ? 0 : 1);
})();
