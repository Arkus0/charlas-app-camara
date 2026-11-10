// Recursos gráficos: atlas, arte propio, hojas de personaje con cambio de paleta, texto y luces.
import atlasUrl from '../recursos/atlas.png';
import pjUrl from '../recursos/pj.png';
import ATLAS from '../recursos/atlas.json';
import { ANCHOS } from '../juego/texto';
import { col, crearArtePropio, lienzo } from './arte';
import { PALETAS, type PaletaPj } from '../datos/paletas';

type RGB = [number, number, number];
interface Spr { img: CanvasImageSource; x: number; y: number; w: number; h: number }

function cargarImagen(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, mal) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => mal(new Error('no se pudo cargar ' + url));
    i.src = url;
  });
}

const clave = (c: RGB) => (c[0] << 16) | (c[1] << 8) | c[2];
// Colores del personaje base (ya en 15 bits).
const ORIGEN = {
  ropa: [[198, 57, 57], [140, 41, 41], [107, 24, 24]] as RGB[],
  pelo: [[107, 74, 49], [66, 41, 33]] as RGB[],
  piel: [[239, 214, 181], [189, 165, 132]] as RGB[],
  pantalon: [99, 99, 156] as RGB,
  arma: [[173, 198, 198], [82, 132, 189], [107, 132, 140]] as RGB[],
};

function rgbDe(css: string): RGB {
  const m = css.match(/\d+/g)!;
  return [+m[0], +m[1], +m[2]];
}

export class Graficos {
  private sprites = new Map<string, Spr>();
  private pjBase!: ImageData;
  private hojas = new Map<string, HTMLCanvasElement>();
  private glifos = new Map<string, HTMLCanvasElement>();
  private glifoX: Record<string, number> = {};
  private discos = new Map<string, HTMLCanvasElement>();
  cielo!: HTMLCanvasElement;

  async cargar(): Promise<void> {
    const [atlas, pj] = await Promise.all([cargarImagen(atlasUrl), cargarImagen(pjUrl)]);
    for (const [n, r] of Object.entries(ATLAS as unknown as Record<string, number[]>)) this.sprites.set(n, { img: atlas, x: r[0], y: r[1], w: r[2], h: r[3] });
    for (const [n, c] of Object.entries(crearArtePropio())) this.sprites.set(n, { img: c, x: 0, y: 0, w: c.width, h: c.height });
    const [c, x] = lienzo(pj.width, pj.height);
    x.drawImage(pj, 0, 0);
    this.pjBase = x.getImageData(0, 0, pj.width, pj.height);
    await document.fonts.load('8px "Tiny5"');
    this.crearGlifos();
    this.cielo = this.crearCielo();
    void c;
  }

  tiene(n: string): boolean { return this.sprites.has(n); }

  tam(n: string): [number, number] {
    const s = this.sprites.get(n);
    return s ? [s.w, s.h] : [0, 0];
  }

  /** Pinta un sprite con su esquina superior izquierda en (x, y). */
  d(ctx: CanvasRenderingContext2D, n: string, x: number, y: number): void {
    const s = this.sprites.get(n);
    if (!s) return;
    ctx.drawImage(s.img, s.x, s.y, s.w, s.h, Math.round(x), Math.round(y), s.w, s.h);
  }

  /** Pinta un trozo de un sprite (para rejas que se hunden, etc.). */
  dTrozo(ctx: CanvasRenderingContext2D, n: string, x: number, y: number, alto: number): void {
    const s = this.sprites.get(n);
    if (!s || alto <= 0) return;
    const h = Math.min(s.h, alto);
    ctx.drawImage(s.img, s.x, s.y, s.w, h, Math.round(x), Math.round(y), s.w, h);
  }

  // ───────────── personajes ─────────────

  /** Hoja del personaje base recoloreada con una paleta; 'blanco' es la silueta para los destellos. */
  pj(nombre: string): HTMLCanvasElement {
    let h = this.hojas.get(nombre);
    if (h) return h;
    const src = this.pjBase;
    const out = new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
    const d = out.data;
    if (nombre === 'blanco') {
      for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { d[i] = d[i + 1] = d[i + 2] = 255; }
    } else {
      const p: PaletaPj = PALETAS[nombre] ?? PALETAS.rai;
      const mapa = new Map<number, RGB | null>();
      const pon = (o: RGB[], n: RGB[]) => o.forEach((c, i) => mapa.set(clave(c), rgbDe(col(...n[Math.min(i, n.length - 1)]))));
      pon(ORIGEN.ropa, p.ropa); pon(ORIGEN.pelo, p.pelo); pon(ORIGEN.piel, p.piel); pon([ORIGEN.pantalon], [p.pantalon]);
      if (p.arma === null) { for (const c of ORIGEN.arma) mapa.set(clave(c), null); mapa.set(0xffffff, null); }
      else if (p.arma) pon(ORIGEN.arma, p.arma);
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue;
        const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
        if (!mapa.has(k)) continue;
        const n = mapa.get(k);
        if (n === null || n === undefined) d[i + 3] = 0; else { d[i] = n[0]; d[i + 1] = n[1]; d[i + 2] = n[2]; }
      }
    }
    const grande = nombre.endsWith('@2');
    void grande;
    const [c, x] = lienzo(src.width, src.height);
    x.putImageData(out, 0, 0);
    h = c;
    this.hojas.set(nombre, h);
    return h;
  }

  /** Versión al doble de tamaño (Scale2x) de una hoja, para el jefe grande. */
  pjDoble(nombre: string): HTMLCanvasElement {
    const k = nombre + '@2';
    let h = this.hojas.get(k);
    if (h) return h;
    const base = this.pj(nombre);
    const w = base.width, al = base.height;
    const s = base.getContext('2d')!.getImageData(0, 0, w, al);
    const px = new Uint32Array(s.data.buffer);
    const out = new ImageData(w * 2, al * 2);
    const o = new Uint32Array(out.data.buffer);
    const g = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= al ? 0 : px[y * w + x]);
    for (let y = 0; y < al; y++) {
      for (let x = 0; x < w; x++) {
        const p = g(x, y), a = g(x, y - 1), b = g(x + 1, y), c = g(x - 1, y), dd = g(x, y + 1);
        let e0 = p, e1 = p, e2 = p, e3 = p;
        if (c === a && c !== dd && a !== b) e0 = a;
        if (a === b && a !== c && b !== dd) e1 = b;
        if (dd === c && dd !== b && c !== a) e2 = c;
        if (b === dd && b !== a && dd !== c) e3 = dd;
        const i = y * 2 * w * 2 + x * 2;
        o[i] = e0; o[i + 1] = e1; o[i + w * 2] = e2; o[i + w * 2 + 1] = e3;
      }
    }
    const [cv, cx] = lienzo(w * 2, al * 2);
    cx.putImageData(out, 0, 0);
    h = cv;
    this.hojas.set(k, h);
    return h;
  }

  // ───────────── texto ─────────────

  private crearGlifos(): void {
    const chars = Object.keys(ANCHOS);
    let total = 0;
    for (const ch of chars) { this.glifoX[ch] = total; total += ANCHOS[ch] + 2; }
    const [c, x] = lienzo(total, 12);
    x.font = '8px "Tiny5"';
    x.textBaseline = 'alphabetic';
    x.fillStyle = '#fff';
    for (const ch of chars) x.fillText(ch, this.glifoX[ch], 8);
    const d = x.getImageData(0, 0, total, 12);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = d.data[i + 3] > 110;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = 255;
      d.data[i + 3] = v ? 255 : 0;
    }
    x.putImageData(d, 0, 0);
    this.glifos.set('#fff', c);
  }

  private glifosDe(color: string): HTMLCanvasElement {
    let g = this.glifos.get(color);
    if (g) return g;
    const b = this.glifos.get('#fff')!;
    const [c, x] = lienzo(b.width, b.height);
    x.drawImage(b, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, b.width, b.height);
    g = c;
    this.glifos.set(color, g);
    return g;
  }

  ancho(t: string, escala = 1): number {
    let n = 0;
    for (const ch of t) n += ANCHOS[ch] ?? 4;
    return n * escala;
  }

  /** Escribe una línea. alin: 0 izquierda, 1 centrada en x, 2 a la derecha de x. */
  t(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number, color = '#fff', alin = 0, sombra: string | null = '#101018', escala = 1): void {
    x = Math.round(x); y = Math.round(y);
    if (alin) x -= alin === 1 ? Math.round(this.ancho(texto, escala) / 2) : this.ancho(texto, escala);
    const pasadas: [string, number, number][] = sombra ? [[sombra, escala, escala], [color, 0, 0]] : [[color, 0, 0]];
    for (const [c, ox, oy] of pasadas) {
      const g = this.glifosDe(c);
      let cx = x + ox;
      for (const ch of texto) {
        const w = ANCHOS[ch];
        if (w === undefined) { cx += 4 * escala; continue; }
        if (ch !== ' ') ctx.drawImage(g, this.glifoX[ch], 0, w + 1, 12, cx, y + oy, (w + 1) * escala, 12 * escala);
        cx += w * escala;
      }
    }
  }

  // ───────────── luces ─────────────

  /** Disco de luz en tres escalones con tramado, como un degradado de 16 bits. */
  disco(r: number, color: string): HTMLCanvasElement {
    r = Math.round(r);
    const k = r + color;
    let c = this.discos.get(k);
    if (c) return c;
    const m = color.match(/[0-9a-f]{2}/gi)!;
    const [cr, cg, cb] = [parseInt(m[0], 16), parseInt(m[1], 16), parseInt(m[2], 16)];
    const [cv, x] = lienzo(r * 2, r * 2);
    const d = x.createImageData(r * 2, r * 2);
    const niveles = [1, 0.72, 0.46, 0.24, 0];
    for (let j = 0; j < r * 2; j++) {
      for (let i = 0; i < r * 2; i++) {
        const dist = Math.hypot(i - r + 0.5, j - r + 0.5) / r;
        if (dist >= 1) continue;
        const f = dist * 4;
        let n = Math.floor(f);
        if (f - n > 0.62 && (i + j) % 2 === 0) n++;
        const v = niveles[Math.min(4, n)];
        const o = (j * r * 2 + i) * 4;
        d.data[o] = cr * v; d.data[o + 1] = cg * v; d.data[o + 2] = cb * v; d.data[o + 3] = 255;
      }
    }
    x.putImageData(d, 0, 0);
    c = cv;
    this.discos.set(k, c);
    return c;
  }

  // ───────────── fondo nocturno ─────────────

  private crearCielo(): HTMLCanvasElement {
    const W = 512, H = 224;
    const [c, x] = lienzo(W, H);
    const bandas = ['#0c0a24', '#120e30', '#1a1240', '#261650', '#3a1c5c', '#5a2464', '#84305c'];
    bandas.forEach((b, i) => { x.fillStyle = b; x.fillRect(0, i * 20, W, 20); });
    // tramado entre bandas
    for (let i = 1; i < bandas.length; i++) {
      x.fillStyle = bandas[i];
      for (let px = 0; px < W; px += 2) { x.fillRect(px, i * 20 - 2, 1, 1); x.fillRect(px + 1, i * 20 - 1, 1, 1); x.fillRect(px, i * 20 - 4, 1, 1); }
    }
    let s = 12345;
    const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < 90; i++) { x.fillStyle = rnd() < 0.3 ? '#fff' : '#8890c8'; x.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * 96), 1, 1); }
    // luna
    x.fillStyle = '#f8f0c0'; x.beginPath(); x.arc(400, 40, 14, 0, 7); x.fill();
    x.fillStyle = '#120e30'; x.beginPath(); x.arc(394, 36, 12, 0, 7); x.fill();
    // mar
    x.fillStyle = '#101848'; x.fillRect(0, 140, W, 84);
    for (let i = 0; i < 70; i++) { x.fillStyle = rnd() < 0.5 ? '#2a3a80' : '#84305c'; x.fillRect(Math.floor(rnd() * W), 142 + Math.floor(rnd() * 80), 2 + Math.floor(rnd() * 5), 1); }
    // edificios lejanos con ventanas encendidas
    for (const [capa, tono, base] of [[0, '#181038', 150], [1, '#0c0820', 176]] as [number, string, number][]) {
      let px = 0;
      while (px < W) {
        const w = 14 + Math.floor(rnd() * 26), h = 24 + Math.floor(rnd() * (capa ? 70 : 46));
        x.fillStyle = tono; x.fillRect(px, base - h, w, H - (base - h));
        for (let wy = base - h + 4; wy < base - 4; wy += 6) {
          for (let wx = px + 3; wx < px + w - 3; wx += 5) {
            if (rnd() < 0.3) { x.fillStyle = rnd() < 0.2 ? '#ff4fa0' : rnd() < 0.3 ? '#40e0ff' : '#f8d868'; x.fillRect(wx, wy, 2, 3); }
          }
        }
        px += w + Math.floor(rnd() * 6);
      }
    }
    return c;
  }
}
