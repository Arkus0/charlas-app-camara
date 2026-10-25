// Prueba de la interfaz móvil: juega una partida completa contra la IA en un móvil emulado, a toques.
// Comprueba que no hay errores, que nada desborda en horizontal y que los botones miden al menos 44 px.
// Uso: npm run build && node scripts/prueba-movil.cjs [carpeta-capturas] [dispositivo]
const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const dir = process.argv[2] || 'capturas-movil';
  const dispositivo = process.argv[3] || 'iPhone 13';
  fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices[dispositivo] });
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(String(e)));
  p.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  await p.goto('file://' + path.resolve('dist/index.html') + '#rapido');
  const foto = async (nombre) => { await p.waitForTimeout(250); await p.screenshot({ path: `${dir}/${nombre}.png` }); };
  const toca = async (sel) => { const el = await p.$(sel); if (!el) return false; try { await el.tap({ timeout: 1500 }); return true; } catch { return false; } };
  const pequenos = new Set();
  const medir = async () => {
    const r = await p.evaluate(() => {
      const malos = [];
      for (const el of document.querySelectorAll('.boton, .boton-icono, .boton-paso, .carta-mano, .insignia, .modo, button.fila')) {
        const b = el.getBoundingClientRect();
        if (b.width && b.height && (b.width < 43.5 || b.height < 43.5)) malos.push(`${el.className.split(' ')[0]} «${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)}» ${Math.round(b.width)}×${Math.round(b.height)}`);
      }
      return { malos, desborda: document.documentElement.scrollWidth > window.innerWidth + 1 };
    });
    r.malos.forEach((m) => pequenos.add(m));
    return r.desborda;
  };

  await foto('01-menu');
  // en fácil, para que la partida llegue hasta la noche electoral y pase por todas las pantallas
  await p.locator('.opcion-menu', { hasText: 'Fácil' }).tap();
  await toca('[data-testid=empezar]');
  let desborda = false;
  const hechas = new Set();
  const t0 = Date.now();
  let jugadas = 0;
  for (let i = 0; i < 4000 && Date.now() - t0 < 15 * 60 * 1000; i++) {
    if (await p.$('[data-testid=noche]')) break;
    if (i % 25 === 0) desborda = (await medir()) || desborda;
    if (await p.$('[data-testid=seguir]')) {
      const tipo = await p.$eval('.momento', (el) => el.className);
      const clave = tipo.includes('cierre') ? 'cierre' : tipo.includes('semana') ? 'semana' : tipo.includes('debate') ? 'debate' : 'rival';
      if (!hechas.has(clave)) { hechas.add(clave); await foto(`momento-${clave}`); }
      await toca('[data-testid=seguir]');
      continue;
    }
    if (await p.$('[data-testid=opcion-0]')) { await toca('[data-testid=opcion-0]'); continue; }
    if (await p.$('[data-testid=debatir]')) { if (!hechas.has('debatir')) { hechas.add('debatir'); await foto('debate'); } await toca('[data-testid=debatir]'); continue; }
    if (await p.$('[data-testid=jugar]:not([disabled])')) {
      if (!hechas.has('prevision')) { hechas.add('prevision'); await foto('prevision'); }
      await toca('[data-testid=jugar]');
      jugadas++;
      continue;
    }
    // dentro de la hoja de jugada: elegir modo y destino
    const modos = await p.$$('.modos .modo:not([disabled])');
    if (modos.length) {
      if (!hechas.has('modos')) { hechas.add('modos'); await foto('modos'); }
      const preferidos = ['evento', 'implantar', 'agenda', 'atacar', 'maquinaria', 'negociar'];
      const orden = jugadas % 4 === 0 ? preferidos : [preferidos[1], preferidos[0], ...preferidos.slice(2)];
      let tocado = false;
      for (const m of orden) if (await toca(`.modos [data-testid=modo-${m}]:not([disabled])`)) { tocado = true; break; }
      if (!tocado) await modos[0].tap();
      continue;
    }
    if (await toca('[data-testid^=sube-]')) continue;
    if (await p.$('[data-testid^=destino-]')) {
      if (!hechas.has('destinos')) { hechas.add('destinos'); await foto('destinos'); }
      await toca('[data-testid^=destino-]');
      continue;
    }
    // la mano
    if (await p.$('.mano.activa')) {
      if (!hechas.has('tablero')) { hechas.add('tablero'); await foto('tablero'); }
      const cartas = await p.$$('.mano.activa .carta-mano');
      if (cartas.length) { await cartas[jugadas % cartas.length].tap(); continue; }
    }
    await p.waitForTimeout(40);
  }
  const fin = await p.$('[data-testid=noche]');
  desborda = (await medir()) || desborda;
  await p.screenshot({ path: `${dir}/noche.png`, fullPage: true });
  const res = { dispositivo, terminada: !!fin, segundos: Math.round((Date.now() - t0) / 1000), jugadas, capturas: [...hechas], desbordaEnHorizontal: desborda, botonesPequenos: [...pequenos], errores };
  console.log(JSON.stringify(res, null, 1));
  await b.close();
  process.exit(fin && errores.length === 0 && !desborda && pequenos.size === 0 ? 0 : 1);
})();
