// Decorado: sprites de varias casillas que se colocan sobre el mapa.
// fw × fh es su base en casillas; alto, la altura sólida en píxeles (0 = no estorba, ≥40 = no se puede subir).

export interface DefDeco {
  spr: string;
  fw: number;
  fh: number;
  alto: number;
  dx?: number;
  dy?: number;
  /** fotogramas de animación (se añade el índice al nombre del sprite) */
  anim?: number;
  /** pegado al suelo: se pinta antes que los personajes */
  plano?: boolean;
  /** luz propia: [dx, dy, radio, color] respecto a la esquina inferior izquierda */
  luz?: [number, number, number, string];
}

const d = (spr: string, fw: number, fh: number, alto: number, extra: Partial<DefDeco> = {}): DefDeco => ({ spr, fw, fh, alto, ...extra });
const CALIDA = '#ffb060';

export const DECO: Record<string, DefDeco> = {
  // exterior
  casa1: d('casa1', 5, 3, 48, { dx: 3 }), casa2: d('casa2', 5, 3, 48, { dx: 3 }),
  fuente: d('fuente', 3, 2, 48, { anim: 3 }),
  puesto: d('puesto', 5, 2, 48),
  fruta0: d('fruta0', 1, 1, 48), fruta1: d('fruta1', 1, 1, 48), fruta2: d('fruta2', 1, 1, 48), fruta3: d('fruta3', 1, 1, 48),
  caja: d('caja', 1, 1, 16), caja_g: d('caja_g', 2, 1, 48, { dx: 3 }),
  barril: d('barril', 1, 1, 48), saco: d('saco', 1, 1, 48), maceta: d('maceta', 1, 1, 48),
  planta: d('planta', 1, 1, 48), trebol: d('trebol', 1, 1, 48), cartel: d('cartel', 1, 1, 48),
  banco: d('banco', 3, 1, 48, { dx: 2 }), banco_v: d('banco_v', 1, 3, 48),
  estatua: d('estatua', 2, 2, 48), bandera: d('bandera0', 1, 1, 48, { dx: -4 }),
  canon: d('canon', 2, 1, 48, { dx: 4 }), arbol: d('arbol', 2, 1, 48), arbusto: d('arbusto', 2, 1, 48),
  valla: d('valla', 2, 1, 48, { dx: 3 }), valla_v: d('valla_v', 1, 2, 48),
  roca: d('roca', 2, 1, 48, { dx: 3 }), tronco: d('tronco', 3, 1, 12),
  lapida: d('lapida', 1, 1, 48, { dx: -2 }), pasarela: d('pasarela', 1, 1, 0, { plano: true, dx: -2 }),
  farola: d('farola', 1, 1, 48, { dx: 1, luz: [4, -24, 44, CALIDA] }),
  farola_v: d('farola_v', 1, 1, 48, { dx: 4, luz: [8, -26, 48, CALIDA] }),
  farola2: d('farola2', 1, 1, 48, { dx: -3, luz: [8, -26, 52, CALIDA] }),
  senal: d('senal', 1, 1, 48, { dx: 2 }), parada: d('parada', 1, 1, 48, { dx: 2 }),
  barrera: d('barrera', 1, 1, 48), barrera2: d('barrera2', 1, 1, 48), banco_k: d('banco_k', 1, 1, 48),
  buzon: d('buzon', 1, 1, 48), buzon2: d('buzon2', 1, 1, 48), papelera: d('papelera', 1, 1, 48), papelera2: d('papelera2', 1, 1, 48),
  bolsa: d('bolsa', 1, 1, 48), hidrante: d('hidrante', 1, 1, 48), bidon: d('bidon', 1, 1, 48), cono: d('cono', 1, 1, 48),
  maquina: d('maquina', 1, 1, 48, { luz: [8, -8, 22, '#80c0ff'] }), aire: d('aire', 1, 1, 0),
  valla_metal: d('valla_metal', 3, 1, 48), valla_naranja: d('valla_naranja', 3, 1, 48), seto: d('seto', 3, 1, 48),
  jardinera: d('jardinera', 1, 1, 48), jardinera2: d('jardinera2', 1, 1, 48), cajon: d('cajon', 1, 1, 48), cajon2: d('cajon2', 1, 1, 48),
  taxi: d('taxi', 2, 1, 48, { dx: 4 }), taxi_l: d('taxi_l', 1, 2, 48), coche_r: d('coche_r', 2, 1, 48, { dx: 5 }), coche_v: d('coche_v', 1, 2, 48),
  // fachadas (no estorban: van sobre la cara de los muros)
  portal: d('portal', 4, 1, 0), arco: d('arco', 3, 1, 0), puerta_madera: d('puerta_madera', 1, 1, 0),
  ventana: d('ventana', 1, 1, 0, { dy: -6 }), ventanal: d('ventanal', 3, 1, 0, { dy: -6, dx: 2 }),
  puerta_k: d('puerta_k', 1, 1, 0), puerta_k2: d('puerta_k2', 1, 1, 0), puerta_k3: d('puerta_k3', 1, 1, 0), escaparate: d('escaparate', 1, 1, 0),
  ventana_k: d('ventana_k', 1, 1, 0, { dy: -4 }), ventana_k2: d('ventana_k2', 1, 1, 0, { dy: -4 }), toldo_k: d('toldo_k', 3, 1, 0, { dy: -14 }),
  trampilla: d('trampilla', 2, 1, 0, { plano: true, dx: 2 }), bajada: d('bajada', 2, 1, 0, { plano: true }),
  reja: d('reja', 1, 1, 0),
  // interior
  mesa: d('mesa', 3, 2, 48), mantel: d('mantel', 3, 2, 48), cama: d('cama', 2, 3, 48), cama2: d('cama2', 2, 3, 48),
  silla: d('silla', 1, 1, 48), silla2: d('silla2', 1, 1, 48),
  mostrador: d('mostrador', 3, 2, 48), aparador: d('aparador', 3, 1, 48), barra: d('barra', 3, 1, 48, { dx: 1 }), arcon: d('arcon', 3, 1, 12, { dx: 1 }),
  estanteria: d('estanteria', 3, 1, 48), botellero: d('botellero', 3, 1, 48), armario: d('armario', 3, 1, 48), ropero: d('ropero', 2, 1, 48),
  chimenea: d('chimenea', 2, 1, 48, { dx: 1, luz: [16, -8, 40, CALIDA] }), planta_i: d('planta_i', 1, 1, 48),
  ventana_i: d('ventana_i', 2, 1, 0, { dx: 3, dy: -8 }),
  cuadro0: d('cuadro0', 1, 1, 0, { dy: -8 }), cuadro1: d('cuadro1', 2, 1, 0, { dy: -10 }), cuadro2: d('cuadro2', 2, 1, 0, { dy: -10 }), cuadro3: d('cuadro3', 2, 1, 0, { dy: -10 }),
  escalera_i: d('escalera_i', 2, 2, 0, { plano: true }), escalera_sub: d('escalera_sub', 2, 1, 0),
  lampara: d('lampara', 1, 1, 0, { dy: -8, luz: [8, -16, 46, CALIDA] }),
  antorcha: d('antorcha', 1, 1, 0, { dy: -8, luz: [8, -16, 50, '#ff9040'] }),
  alfombra: d('alfombra', 3, 3, 0, { plano: true, dx: 1 }), tapete: d('tapete', 2, 2, 0, { plano: true }),
  puerta_i: d('puerta_i', 1, 1, 0), puerta_doble: d('puerta_doble', 2, 1, 0, { dx: 1 }), arco_i: d('arco_i', 1, 1, 0),
  platos: d('platos', 1, 1, 0, { dy: -18 }), radiador: d('radiador', 1, 1, 48), libro: d('libro', 1, 1, 0, { dy: -18 }),
  maceta_i: d('maceta_i', 1, 1, 48), cesta: d('cesta', 2, 1, 48),
  // cueva
  idolo0: d('idolo0', 1, 1, 48), idolo1: d('idolo1', 1, 1, 48), idolo2: d('idolo2', 1, 1, 48), idolo3: d('idolo3', 1, 1, 48),
  pedrusco: d('pedrusco', 1, 1, 48), pedrusco2: d('pedrusco2', 1, 1, 48), penasco: d('penasco', 2, 1, 48), roca_musgo: d('roca_musgo', 2, 1, 48),
  // arte propio
  cabina_deco: d('cabina', 1, 1, 48), tragaperras: d('tragaperras', 1, 1, 48, { luz: [8, -10, 26, '#ff60c0'] }),
  altar: d('altar', 2, 1, 48, { luz: [16, -12, 34, '#ffd080'] }), ruleta: d('ruleta', 2, 2, 48),
  andamio: d('andamio', 1, 1, 0, { plano: true }), palmera: d('palmera', 1, 1, 48, { dx: -8 }),
  barca: d('barca', 3, 1, 48),
};
