// Alcance dentro de una sala: relleno por inundación con las reglas de movimiento del jugador
// (subir un escalón saltando, cruzar huecos de hasta 2 casillas, o de 4 con el capote).
import { DX, DY, T, TERR, type DefSala } from '../src/tipos';
import { AGUA_Z, SOLIDO_Z, Sala } from '../src/mundo/sala';

export interface Equipo { tracas: boolean; mechero: boolean; capote: boolean; llave: boolean }
export const TODO: Equipo = { tracas: true, mechero: true, capote: true, llave: true };

export interface Mapa {
  sala: Sala;
  /** índices de casilla alcanzables */
  visto: Set<number>;
  puertas: Map<string, number[]>;
}

/** Casillas a las que se puede llegar desde `inicio` con ese equipo. */
export function alcance(def: DefSala, inicio: number[], eq: Equipo): Mapa {
  const s = new Sala(def);
  const obj = new Map<number, string>();
  const puertas = new Map<string, number[]>();
  for (const o of s.objetos) {
    const i = o.fila * s.an + o.col;
    obj.set(i, o.c);
    if (o.c >= '1' && o.c <= '9') puertas.set(o.c, [...(puertas.get(o.c) ?? []), i]);
  }
  // Las plataformas móviles hacen pisable todo su recorrido.
  const flota = new Set<number>();
  let nPlat = 0;
  for (const o of s.objetos) {
    if (o.c !== 'm') continue;
    const [dx, dy, n] = def.plataformas?.[nPlat++] ?? [1, 0, 3];
    for (let k = 0; k <= n; k++) flota.add((o.fila + dy * k) * s.an + o.col + dx * k);
  }
  const suelo = (c: number, f: number): number => {
    if (!s.dentro(c, f)) return SOLIDO_Z;
    const i = f * s.an + c;
    if (flota.has(i)) return 0;
    const ch = obj.get(i);
    if (ch === 'x') return s.alt[i] * T; // puente retráctil: se da por tendido
    if (ch === 'g' && !eq.tracas) return SOLIDO_Z;
    if (ch === 'f' && !eq.mechero) return SOLIDO_Z;
    if (ch === 'K' && !eq.llave) return SOLIDO_Z;
    if (ch === 'T' || ch === 'S' || ch === 'N' || ch === '*' || ch === 'L' || ch === 'i' || ch === 'I' || ch === 'C') return SOLIDO_Z;
    return s.suelo(c, f);
  };
  const pisable = (h: number) => h < SOLIDO_Z && h > AGUA_Z;
  const visto = new Set<number>();
  const cola: number[] = [];
  for (const i of inicio) if (pisable(suelo(i % s.an, (i / s.an) | 0))) { visto.add(i); cola.push(i); }
  const salto = eq.capote ? 4 : 2;
  while (cola.length) {
    const i = cola.pop()!;
    const c = i % s.an, f = (i / s.an) | 0;
    const h = suelo(c, f);
    for (let d = 0; d < 4; d++) {
      // paso a la casilla vecina (subiendo como mucho un nivel)
      const nc = c + DX[d], nf = f + DY[d];
      const hn = suelo(nc, nf);
      const j = nf * s.an + nc;
      if (pisable(hn) && hn <= h + T && !visto.has(j)) { visto.add(j); cola.push(j); }
      // salto sobre un hueco en línea recta
      for (let k = 1; k <= salto; k++) {
        const gc = c + DX[d] * k, gf = f + DY[d] * k;
        const hg = suelo(gc, gf);
        if (hg >= SOLIDO_Z || (pisable(hg) && hg > h - T)) break; // muro o suelo: no es un hueco
        const tc = gc + DX[d], tf = gf + DY[d];
        const ht = suelo(tc, tf);
        const t = tf * s.an + tc;
        if (pisable(ht) && ht <= h && !visto.has(t)) { visto.add(t); cola.push(t); }
      }
    }
  }
  void TERR;
  return { sala: s, visto, puertas };
}

/** ¿Se puede llegar a una casilla contigua a esta (para hablar, abrir o encender)? */
export function junto(m: Mapa, i: number): boolean {
  const an = m.sala.an;
  return [i - 1, i + 1, i - an, i + an, i - 2 * an, i + 2 * an].some((k) => m.visto.has(k)) || m.visto.has(i);
}
