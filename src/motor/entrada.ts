// Teclado, mando y pantalla táctil unificados en un único estado de botones.
import { BOTONES, entradaVacia, type Boton, type Entrada } from '../tipos';

const TECLAS: Record<string, Boton | 'arr' | 'aba' | 'izq' | 'der'> = {
  ArrowUp: 'arr', ArrowDown: 'aba', ArrowLeft: 'izq', ArrowRight: 'der',
  KeyW: 'arr', KeyS: 'aba', KeyA: 'izq', KeyD: 'der',
  KeyZ: 'a', KeyJ: 'a', KeyX: 'b', KeyK: 'b', Space: 'b', KeyC: 'c', KeyL: 'c',
  KeyV: 'd', KeyQ: 'd', Enter: 'e', Escape: 'e', KeyP: 'e',
};

export class Mandos {
  private teclas = new Set<string>();
  private tactil: Record<Boton, boolean> = { a: false, b: false, c: false, d: false, e: false };
  private palanca = { x: 0, y: 0 };
  private previo: Record<Boton, boolean> = { a: false, b: false, c: false, d: false, e: false };
  /** se llama con cualquier gesto del jugador (para arrancar el audio) */
  alTocar: () => void = () => {};

  constructor() {
    window.addEventListener('keydown', (e) => {
      const t = TECLAS[e.code];
      if (t) { this.teclas.add(t); e.preventDefault(); }
      this.alTocar();
    });
    window.addEventListener('keyup', (e) => { const t = TECLAS[e.code]; if (t) this.teclas.delete(t); });
    window.addEventListener('blur', () => this.teclas.clear());
  }

  /** Conecta la cruceta y los botones táctiles del HTML. */
  conectarTactil(raiz: HTMLElement): void {
    const cruz = raiz.querySelector<HTMLElement>('[data-cruz]');
    if (cruz) {
      let id = -1;
      const mover = (e: PointerEvent) => {
        const r = cruz.getBoundingClientRect();
        let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        const l = Math.hypot(x, y);
        if (l < 0.22) { x = 0; y = 0; } else { // ocho direcciones, como una cruceta
          const a = Math.round(Math.atan2(y, x) / (Math.PI / 4)) * (Math.PI / 4);
          x = Math.round(Math.cos(a)); y = Math.round(Math.sin(a));
        }
        this.palanca.x = x; this.palanca.y = y;
        cruz.dataset.dir = `${x},${y}`;
      };
      cruz.addEventListener('pointerdown', (e) => { id = e.pointerId; cruz.setPointerCapture(id); mover(e); this.alTocar(); e.preventDefault(); });
      cruz.addEventListener('pointermove', (e) => { if (e.pointerId === id) mover(e); });
      const soltar = (e: PointerEvent) => { if (e.pointerId === id) { id = -1; this.palanca.x = this.palanca.y = 0; cruz.dataset.dir = '0,0'; } };
      cruz.addEventListener('pointerup', soltar);
      cruz.addEventListener('pointercancel', soltar);
    }
    raiz.querySelectorAll<HTMLElement>('[data-boton]').forEach((el) => {
      const b = el.dataset.boton as Boton;
      const pon = (v: boolean) => (e: PointerEvent) => { this.tactil[b] = v; el.classList.toggle('pulsado', v); if (v) this.alTocar(); e.preventDefault(); };
      el.addEventListener('pointerdown', pon(true));
      el.addEventListener('pointerup', pon(false));
      el.addEventListener('pointercancel', pon(false));
      el.addEventListener('pointerleave', pon(false));
    });
    raiz.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Estado para un paso de simulación. */
  leer(): Entrada {
    const en = entradaVacia();
    const k = this.teclas;
    en.dx = (k.has('der') ? 1 : 0) - (k.has('izq') ? 1 : 0) + this.palanca.x;
    en.dy = (k.has('aba') ? 1 : 0) - (k.has('arr') ? 1 : 0) + this.palanca.y;
    const pulsado: Record<Boton, boolean> = { a: false, b: false, c: false, d: false, e: false };
    for (const b of BOTONES) pulsado[b] = k.has(b) || this.tactil[b];
    const mando = navigator.getGamepads?.().find((g) => g && g.connected);
    if (mando) {
      const [ax, ay] = mando.axes;
      if (Math.abs(ax) > 0.35) en.dx += Math.sign(ax);
      if (Math.abs(ay) > 0.35) en.dy += Math.sign(ay);
      const bt = (i: number) => !!mando.buttons[i]?.pressed;
      if (bt(14)) en.dx -= 1; if (bt(15)) en.dx += 1; if (bt(12)) en.dy -= 1; if (bt(13)) en.dy += 1;
      pulsado.a ||= bt(2) || bt(1); pulsado.b ||= bt(0); pulsado.c ||= bt(3); pulsado.d ||= bt(4) || bt(5); pulsado.e ||= bt(9);
    }
    en.dx = Math.max(-1, Math.min(1, en.dx)); en.dy = Math.max(-1, Math.min(1, en.dy));
    for (const b of BOTONES) { en.m[b] = pulsado[b]; en.p[b] = pulsado[b] && !this.previo[b]; this.previo[b] = pulsado[b]; }
    return en;
  }
}
