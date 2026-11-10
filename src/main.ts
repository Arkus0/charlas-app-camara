// Arranque: carga de recursos, escalado entero de la pantalla y bucle a paso fijo.
import '@fontsource/tiny5/latin-400.css';
import '@fontsource/tiny5/latin-ext-400.css';
import { ALTO, ANCHO } from './tipos';
import { Juego, type Almacen } from './juego/juego';
import { Graficos } from './motor/graficos';
import { Vista } from './motor/vista';
import { Mandos } from './motor/entrada';
import { Sonido } from './motor/audio';

const CLAVE = 'clavel-negro:partida';
const almacen: Almacen = {
  leer: () => { try { return localStorage.getItem(CLAVE); } catch { return null; } },
  escribir: (s) => { try { localStorage.setItem(CLAVE, s); } catch { /* sin almacenamiento: no se guarda */ } },
};

async function arrancar(): Promise<void> {
  const lienzo = document.getElementById('pantalla') as HTMLCanvasElement;
  const ctx = lienzo.getContext('2d', { alpha: false })!;
  ctx.imageSmoothingEnabled = false;
  const tactil = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  document.documentElement.classList.toggle('tactil', tactil);

  // Escala entera en píxeles físicos: cada píxel del juego ocupa un número exacto de píxeles de pantalla.
  const ajustar = () => {
    const dpr = window.devicePixelRatio || 1;
    const vertical = innerHeight > innerWidth;
    const altoUtil = tactil && vertical ? innerHeight - 250 : innerHeight;
    const k = Math.max(1, Math.floor(Math.min((innerWidth * dpr) / ANCHO, (altoUtil * dpr) / ALTO)));
    lienzo.style.width = `${(ANCHO * k) / dpr}px`;
    lienzo.style.height = `${(ALTO * k) / dpr}px`;
  };
  ajustar();
  addEventListener('resize', ajustar);

  const graficos = new Graficos();
  await graficos.cargar();
  const juego = new Juego(almacen);
  const vista = new Vista(graficos, ctx);
  const mandos = new Mandos();
  const sonido = new Sonido();
  mandos.alTocar = () => sonido.iniciar();
  mandos.conectarTactil(document.getElementById('tactil')!);
  (window as any).__clavel = { juego, mandos, sonido };

  const PASO = 1000 / 60;
  let antes = performance.now(), acumulado = 0;
  const cuadro = (ahora: number) => {
    acumulado += Math.min(100, ahora - antes);
    antes = ahora;
    let n = 0;
    while (acumulado >= PASO && n < 4) {
      juego.paso(mandos.leer());
      acumulado -= PASO; n++;
    }
    if (n) {
      for (const s of juego.sonidos) sonido.sfx(s);
      juego.sonidos.length = 0;
      sonido.musica(juego.musica);
      vista.pintar(juego);
    }
    sonido.tic();
    requestAnimationFrame(cuadro);
  };
  requestAnimationFrame(cuadro);
}

arrancar().catch((e) => {
  document.body.innerHTML = `<pre style="color:#f88;padding:16px;white-space:pre-wrap">No se pudo arrancar el juego:\n${e?.stack ?? e}</pre>`;
});
