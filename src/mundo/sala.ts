// Carga de una sala a partir de su mapa ASCII: terreno, alturas y objetos.
//
// Terreno:  .  suelo      ,  suelo alternativo   _  tercer suelo
//           -  = +  suelo elevado a 1, 2 y 3 niveles
//           #  muro       (espacio) vacío        ~  agua      o  foso
//           > < ^ v  cintas transportadoras      x  puente retráctil sobre foso o agua
// Cualquier otro carácter es un objeto: hereda el terreno de la casilla vecina.
import { T, TERR, type DefSala } from '../tipos';
import { DECO } from '../datos/deco';

const TERRENO: Record<string, [number, number]> = {
  '.': [TERR.SUELO, 0], ',': [TERR.ALT, 0], '_': [TERR.TER, 0],
  '-': [TERR.SUELO, 1], '=': [TERR.SUELO, 2], '+': [TERR.SUELO, 3],
  '#': [TERR.MURO, 0], ' ': [TERR.VACIO, 0], '~': [TERR.AGUA, 0], 'o': [TERR.FOSO, 0],
  'v': [TERR.CINTA_S, 0], '>': [TERR.CINTA_E, 0], '^': [TERR.CINTA_N, 0], '<': [TERR.CINTA_O, 0],
};

export interface Objeto { c: string; col: number; fila: number; i: number }

export const FOSO_Z = -40;
export const AGUA_Z = -12;
export const SOLIDO_Z = 999;

export class Sala {
  an: number;
  al: number;
  terr: Uint8Array;
  alt: Uint8Array;
  /** altura añadida por el decorado fijo, en píxeles */
  extra: Uint8Array;
  /** en los muros: 1 = base de la cara, 2… = filas superiores, 0 = techo */
  cara: Uint8Array;
  objetos: Objeto[] = [];

  constructor(public def: DefSala) {
    const m = def.mapa;
    this.al = m.length;
    this.an = Math.max(...m.map((l) => l.length));
    const n = this.an * this.al;
    this.terr = new Uint8Array(n).fill(TERR.VACIO);
    this.alt = new Uint8Array(n);
    this.extra = new Uint8Array(n);
    this.cara = new Uint8Array(n);
    const pend: number[] = [];
    const cuenta: Record<string, number> = {};
    for (let f = 0; f < this.al; f++) {
      for (let c = 0; c < this.an; c++) {
        const ch = m[f][c] ?? ' ';
        const i = f * this.an + c;
        const tr = TERRENO[ch];
        if (tr) { this.terr[i] = tr[0]; this.alt[i] = tr[1]; continue; }
        cuenta[ch] = (cuenta[ch] ?? 0) + 1;
        this.objetos.push({ c: ch, col: c, fila: f, i: cuenta[ch] - 1 });
        pend.push(i);
        this.terr[i] = 255;
      }
    }
    // Los objetos heredan el terreno pisable de una casilla vecina (oeste, este, norte, sur).
    const vecinos = [-1, 1, -this.an, this.an];
    for (let ronda = 0; ronda < 8 && pend.length; ronda++) {
      for (let k = pend.length - 1; k >= 0; k--) {
        const i = pend[k];
        const ch = m[(i / this.an) | 0][i % this.an];
        const sobreHueco = ch === 'x' || ch === 'm';
        for (const d of vecinos) {
          const j = i + d;
          if (j < 0 || j >= n) continue;
          if ((d === -1 && i % this.an === 0) || (d === 1 && j % this.an === 0)) continue;
          const tj = this.terr[j];
          if (tj === 255) continue;
          const hueco = tj === TERR.AGUA || tj === TERR.FOSO;
          const pisable = tj === TERR.SUELO || tj === TERR.ALT || tj === TERR.TER;
          if (sobreHueco ? hueco : pisable) {
            this.terr[i] = tj; this.alt[i] = this.alt[j];
            pend.splice(k, 1);
            break;
          }
        }
      }
    }
    for (const i of pend) {
      const ch = m[(i / this.an) | 0][i % this.an];
      this.terr[i] = ch === 'x' || ch === 'm' ? TERR.FOSO : TERR.SUELO;
      this.alt[i] = 0;
    }
    // Muros: las casillas justo encima de un suelo enseñan su cara; el resto son techo.
    const filasCara = def.altoMuro ?? 2;
    for (let c = 0; c < this.an; c++) {
      for (let f = this.al - 1; f >= 0; f--) {
        const i = f * this.an + c;
        if (this.terr[i] !== TERR.MURO) continue;
        const debajo = f + 1 < this.al ? this.terr[i + this.an] : TERR.VACIO;
        if (debajo === TERR.MURO) { const d = this.cara[i + this.an]; this.cara[i] = d > 0 && d < filasCara ? d + 1 : 0; }
        else this.cara[i] = debajo === TERR.VACIO ? 0 : 1;
      }
    }
    // Decorado sólido.
    for (const [nombre, col, fila] of def.deco ?? []) {
      const d = DECO[nombre];
      if (!d) throw new Error(`decorado desconocido: ${nombre} en ${def.id}`);
      if (!d.alto) continue;
      for (let f = fila - d.fh + 1; f <= fila; f++) {
        for (let c = col; c < col + d.fw; c++) {
          if (c >= 0 && f >= 0 && c < this.an && f < this.al) this.extra[f * this.an + c] = d.alto;
        }
      }
    }
  }

  dentro(c: number, f: number): boolean {
    return c >= 0 && f >= 0 && c < this.an && f < this.al;
  }

  tipo(c: number, f: number): number {
    return this.dentro(c, f) ? this.terr[f * this.an + c] : TERR.VACIO;
  }

  nivel(c: number, f: number): number {
    return this.dentro(c, f) ? this.alt[f * this.an + c] : 0;
  }

  /** Altura del suelo de una casilla en píxeles (SOLIDO_Z si no se puede pisar). */
  suelo(c: number, f: number): number {
    if (!this.dentro(c, f)) return SOLIDO_Z;
    const i = f * this.an + c;
    const t = this.terr[i];
    if (t === TERR.MURO || t === TERR.VACIO) return SOLIDO_Z;
    if (t === TERR.FOSO) return FOSO_Z;
    if (t === TERR.AGUA) return AGUA_Z;
    const e = this.extra[i];
    if (e >= 40) return SOLIDO_Z;
    return this.alt[i] * T + e;
  }

  /** Terreno bajo un punto del mundo. */
  tipoEn(x: number, y: number): number {
    return this.tipo(Math.floor(x / T), Math.floor(y / T));
  }
}
