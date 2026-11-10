// Paletas de los personajes: todos comparten la hoja base y cambian de ropa, pelo, piel y arma.
type RGB = [number, number, number];

export interface PaletaPj {
  /** claro, sombra, oscuro */
  ropa: [RGB, RGB, RGB];
  /** claro, oscuro */
  pelo: [RGB, RGB];
  /** claro, sombra */
  piel: [RGB, RGB];
  pantalon: RGB;
  /** tres tonos del arma; null = sin arma; sin definir = acero */
  arma?: [RGB, RGB, RGB] | null;
}

const PIEL: [RGB, RGB] = [[239, 214, 181], [189, 165, 132]];
const MORENO: [RGB, RGB] = [[214, 165, 123], [165, 115, 82]];
const NEGRO: [RGB, RGB] = [[74, 66, 90], [33, 33, 41]];
const CASTANO: [RGB, RGB] = [[107, 74, 49], [66, 41, 33]];
const CANO: [RGB, RGB] = [[222, 222, 231], [165, 165, 181]];
const MADERA: [RGB, RGB, RGB] = [[189, 165, 132], [140, 90, 49], [99, 57, 33]];
const HIERRO: [RGB, RGB, RGB] = [[132, 132, 148], [74, 74, 90], [49, 49, 66]];

const p = (ropa: [RGB, RGB, RGB], pelo: [RGB, RGB], pantalon: RGB, piel = PIEL, arma?: [RGB, RGB, RGB] | null): PaletaPj => ({ ropa, pelo, piel, pantalon, arma });

const TRAJE_BLANCO: [RGB, RGB, RGB] = [[239, 239, 231], [189, 189, 206], [132, 132, 156]];

export const PALETAS: Record<string, PaletaPj> = {
  // Rai, traje blanco: sin arma, con el bate y con la katana
  rai: p(TRAJE_BLANCO, NEGRO, [165, 173, 198], PIEL, null),
  rai_bate: p(TRAJE_BLANCO, NEGRO, [165, 173, 198], PIEL, MADERA),
  rai_katana: p(TRAJE_BLANCO, NEGRO, [165, 173, 198]),
  // enemigos
  maton: p([[148, 82, 181], [107, 49, 132], [66, 24, 90]], NEGRO, [57, 57, 74], PIEL, MADERA),
  navajero: p([[82, 181, 99], [49, 132, 74], [33, 90, 57]], [[239, 214, 99], [189, 156, 57]], [41, 107, 66]),
  botellero: p([[239, 140, 49], [189, 99, 33], [132, 66, 24]], [[165, 74, 41], [107, 41, 24]], [74, 74, 107], PIEL, null),
  estibador: p([[82, 132, 214], [49, 90, 165], [33, 57, 115]], [[214, 165, 123], [165, 115, 82]], [49, 66, 115], MORENO, HIERRO),
  crupier: p([[148, 41, 57], [107, 24, 41], [66, 16, 24]], NEGRO, [41, 41, 57], PIEL, null),
  novillero: p([[239, 206, 74], [198, 156, 41], [140, 99, 24]], NEGRO, [231, 115, 156], MORENO, null),
  guardaespaldas: p([[66, 74, 115], [41, 49, 82], [24, 24, 49]], CANO, [41, 41, 66], PIEL, HIERRO),
  // jefes
  percebe: p([[239, 206, 74], [198, 156, 41], [140, 99, 24]], CANO, [49, 66, 115], MORENO, HIERRO),
  faraona: p([[222, 49, 82], [165, 24, 57], [107, 16, 41]], [[57, 41, 66], [24, 16, 33]], [165, 24, 57], MORENO, [[239, 206, 74], [198, 156, 41], [140, 33, 41]]),
  miura: p([[90, 74, 90], [57, 41, 57], [24, 16, 24]], [[33, 33, 41], [16, 16, 16]], [140, 33, 41], MORENO, null),
  notario: p([[156, 156, 173], [107, 107, 132], [74, 74, 90]], CANO, [107, 107, 132], PIEL, null),
  notario2: p([[239, 239, 239], [198, 198, 214], [148, 148, 165]], CANO, [107, 107, 132]),
  // vecinos
  maruja: p([[82, 173, 165], [49, 123, 123], [33, 82, 90]], [[181, 148, 132], [132, 99, 90]], [107, 74, 90], PIEL, null),
  chema: p([[107, 148, 214], [66, 107, 165], [41, 66, 115]], CANO, [107, 99, 82], MORENO, null),
  turista: p([[247, 132, 148], [198, 82, 107], [140, 49, 74]], [[247, 222, 132], [198, 165, 82]], [222, 206, 165], [[247, 173, 156], [206, 123, 115]], null),
  kevin: p([[222, 57, 49], [165, 33, 41], [107, 24, 33]], CASTANO, [41, 66, 148], PIEL, null),
  frutera: p([[115, 189, 82], [74, 140, 57], [41, 90, 41]], CASTANO, [181, 148, 115], MORENO, null),
  abuelo: p([[165, 123, 82], [123, 82, 57], [82, 49, 33]], CANO, [90, 90, 107], PIEL, null),
  remedios: p([[66, 57, 82], [41, 33, 57], [24, 16, 33]], CANO, [41, 33, 57], PIEL, null),
  taquillero: p([[148, 156, 82], [107, 115, 57], [66, 74, 33]], CASTANO, [90, 82, 66], PIEL, null),
  paca: p([[214, 82, 181], [156, 49, 132], [107, 24, 90]], [[239, 148, 57], [189, 99, 33]], [90, 57, 107], PIEL, null),
  chino: p([[57, 57, 74], [41, 41, 57], [24, 24, 33]], NEGRO, [74, 82, 115], PIEL, null),
};
