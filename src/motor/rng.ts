// Generador pseudoaleatorio con semilla (mulberry32): el estado vive dentro de la partida,
// así una partida guardada se reanuda con los mismos dados.
export function aleatorio(e: { rng: number }): number {
  let t = (e.rng = (e.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function d6(e: { rng: number }): number {
  return 1 + Math.floor(aleatorio(e) * 6);
}

export function barajar<T>(e: { rng: number }, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio(e) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
