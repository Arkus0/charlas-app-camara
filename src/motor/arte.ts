// Arte propio: lo que no existe en los packs (iconos, mecanismos, animales, proyectiles),
// dibujado píxel a píxel y ajustado a la misma paleta maestra que el resto.
import PALETA from '../recursos/paleta.json';

const MAESTRA = (PALETA as string[]).map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const memo = new Map<string, string>();

/** Color de la paleta maestra más cercano al pedido. */
export function col(r: number, g: number, b: number): string {
  const k = `${r},${g},${b}`;
  let v = memo.get(k);
  if (v) return v;
  let mejor = Infinity, m = MAESTRA[0];
  for (const c of MAESTRA) {
    const d = (c[0] - r) ** 2 * 3 + (c[1] - g) ** 2 * 4 + (c[2] - b) ** 2 * 2;
    if (d < mejor) { mejor = d; m = c; }
  }
  v = `rgb(${m[0]},${m[1]},${m[2]})`;
  memo.set(k, v);
  return v;
}

export function lienzo(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  return [c, x];
}

const K = col(16, 16, 16);
const TINTAS: Record<string, string> = {
  k: K, w: col(255, 255, 255), g: col(165, 165, 173), G: col(99, 99, 115), d: col(57, 57, 74),
  r: col(214, 49, 57), R: col(140, 33, 41), o: col(239, 140, 49), O: col(189, 99, 33), y: col(247, 214, 74), Y: col(198, 156, 41),
  b: col(140, 90, 49), B: col(99, 57, 33), n: col(239, 214, 181), N: col(189, 165, 132),
  v: col(82, 181, 99), V: col(41, 115, 66), a: col(82, 132, 214), A: col(41, 74, 148), p: col(239, 115, 165), P: col(181, 66, 115),
  m: col(148, 82, 181), c: col(107, 214, 231),
};

function pix(filas: string[]): HTMLCanvasElement {
  const [c, x] = lienzo(Math.max(...filas.map((f) => f.length)), filas.length);
  filas.forEach((fila, j) => {
    for (let i = 0; i < fila.length; i++) {
      const t = TINTAS[fila[i]];
      if (t) { x.fillStyle = t; x.fillRect(i, j, 1, 1); }
    }
  });
  return c;
}

function espejo(src: HTMLCanvasElement): HTMLCanvasElement {
  const [c, x] = lienzo(src.width, src.height);
  x.translate(src.width, 0); x.scale(-1, 1); x.drawImage(src, 0, 0);
  return c;
}

export function crearArtePropio(): Record<string, HTMLCanvasElement> {
  const a: Record<string, HTMLCanvasElement> = {};

  // ── corazones del marcador ──
  a.cor2 = pix(['.kk.kk.', 'krrkrrk', 'krwrrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...']);
  a.cor1 = pix(['.kk.kk.', 'krrkddk', 'krwrddk', 'krrrddk', '.krrdk.', '..krk..', '...k...']);
  a.cor0 = pix(['.kk.kk.', 'kddkddk', 'kdddddk', 'kdddddk', '.kdddk.', '..kdk..', '...k...']);

  // ── iconos de objeto (12×12) ──
  a.i_bate = pix(['.........kk.', '........kbnk', '.......kbbnk', '......kbbbk.', '.....kbbbk..', '....kbbbk...', '...kbbbk....', '..kBbbk.....', '.kBBbk......', 'kwkBk.......', 'kkwk........', '.kk.........']);
  a.i_katana = pix(['..........kk', '.........kwk', '........kwgk', '.......kwgk.', '......kwgk..', '.....kwgk...', '....kwgk....', '.k.kwgk.....', 'kykkgk......', '.kyyk.......', 'kRkyk.......', 'kk.k........']);
  a.i_tracas = pix(['......y.....', '.....y.y....', '....kOk.....', '..kkkkkkkk..', '.krrkrrkrrk.', '.krRkrRkrRk.', '.kyykyykyyk.', '.krrkrrkrrk.', '.krRkrRkrRk.', '.krRkrRkrRk.', '..kkkkkkkk..', '............']);
  a.i_mechero = pix(['.....o......', '....oyo.....', '....oyyo....', '.....oo.....', '...kkkkkk...', '...kgGGgk...', '...kkkkkk...', '...kgwggk...', '...kgwggk...', '...kggggk...', '...kgGGgk...', '...kkkkkk...']);
  a.i_capote = pix(['..kkkkkkkk..', '.kppppppppk.', 'kpppppppppPk', 'kppppppppPPk', 'kpppppppPPyk', 'kppppppPPyyk', 'kpppppPPyyyk', '.kpppPPyyyk.', '.kppPPyyyyk.', '..kPPyyyyk..', '...kyyyyk...', '....kkkk....']);
  a.i_llave = pix(['....kkkk....', '...kyyyyk...', '..kyk..kyk..', '..kyk..kyk..', '...kyyyyk...', '....kyyk....', '....kyk.....', '....kyyk....', '....kyk.....', '....kyyk....', '....kyk.....', '.....k......']);
  a.i_tinta = pix(['....kkkk....', '....kBBk....', '...kkkkkk...', '...kwggk....', '..kkkkkkkk..', '.kcwddddddk.', '.kwddddddAk.', '.kdddddddAk.', '.kdddddddAk.', '.kddddddAAk.', '.kdAAAAAAAk.', '..kkkkkkkk..']);
  a.i_bocata = pix(['............', '............', '..kkkkkkkk..', '.knnnnnnnNk.', 'knnnnnnnnNNk', 'kvovovovovok', 'kyOyOyOyOyOk', 'kNNNNNNNNNNk', '.kNNNNNNNNk.', '..kkkkkkkk..', '............', '............']);
  a.i_cromo = pix(['.kkkkkkkkk..', '.kwwwwwwwk..', '.kwaaaaawk..', '.kwannnawk..', '.kwannnawk..', '.kwarrrawk..', '.kwrrrrrwk..', '.kwrrrrrwk..', '.kwwwwwwwk..', '.kwyyyyywk..', '.kwwwwwwwk..', '.kkkkkkkkk..']);
  a.i_sello = pix(['............', '...kkkkkk...', '..krrrrrrk..', '.krrwrrwrrk.', '.krwrwwrwrk.', '.krrwrrwrrk.', '.krwwrrwwrk.', '.krrwwwwrrk.', '..kRRRRRRk..', '..kbbbbbbk..', '..kBBBBBBk..', '...kkkkkk...']);
  a.i_clavel = pix(['...kk.kk....', '..krrkrrk...', '.krRrrrRrk..', '.krrRrRrrk..', '..krrrrrk...', '...kRRRk....', '....kvk.....', '....kvkvk...', '...kvkvvk...', '....kvkk....', '....kvk.....', '....kk......']);
  a.i_siete = pix(['............', '.kkkkkkkkkk.', '.kyyyyyyyyk.', '.kkkkkkyyyk.', '......kyyk..', '.....kyyk...', '....kyyk....', '....kyyk....', '...kyyk.....', '...kyyk.....', '...kkkk.....', '............']);

  // ── mecanismos ──
  a.placa0 = pix(['................', '.kkkkkkkkkkkkkk.', '.kgggggggggggGk.', '.kgwwwwwwwwwwGk.', '.kgwggggggggGGk.', '.kgwgkkkkkkgGGk.', '.kgwgkrrrrkgGGk.', '.kgwgkrrrrkgGGk.', '.kgwgkrrrrkgGGk.', '.kgwgkrrrrkgGGk.', '.kgwgkkkkkkgGGk.', '.kgwggggggggGGk.', '.kgGGGGGGGGGGGk.', '.kGGGGGGGGGGGGk.', '.kkkkkkkkkkkkkk.', '................']);
  a.placa1 = pix(['................', '................', '.kkkkkkkkkkkkkk.', '.kGGGGGGGGGGGGk.', '.kGggggggggggGk.', '.kGgkkkkkkkkgGk.', '.kGgkvvvvvvkgGk.', '.kGgkvvvvvvkgGk.', '.kGgkvvvvvvkgGk.', '.kGgkvvvvvvkgGk.', '.kGgkkkkkkkkgGk.', '.kGggggggggggGk.', '.kGGGGGGGGGGGGk.', '.kkkkkkkkkkkkkk.', '................', '................']);
  a.palanca0 = pix(['...kk.......', '..krrk......', '..krrk......', '...kgk......', '...kgk......', '....kgk.....', '....kgk.....', '..kkkgkkkk..', '.kGGkkkGGGk.', '.kGggggggGk.', '.kGGGGGGGGk.', '..kkkkkkkk..']);
  a.palanca1 = espejo(a.palanca0);
  a.palanca1 = (() => { const [c, x] = lienzo(12, 12); x.drawImage(a.palanca1, 0, 0); x.fillStyle = TINTAS.v; x.fillRect(8, 1, 2, 2); return c; })();
  a.brasero = pix(['..kkkkkk..', '.kGGGGGGk.', '.kGddddGk.', '..kGGGGk..', '...kGGk...', '...kGGk...', '...kGGk...', '..kGGGGk..', '.kGGGGGGk.', '.kkkkkkkk.']);
  a.traca = pix(['...y....', '..kOk...', '.kkkkkk.', '.krrrrk.', '.kyyyyk.', '.krRRrk.', '.kkkkkk.']);
  a.grieta = pix(['........k.......', '.......kk.......', '......kk....k...', '.....kkk...kk...', '....kk.kk.kk....', '...kk...kkk.....', '..kk....kk......', '.kk....kkkk.....', '.k....kk..kk....', '.....kk....kk...', '....kk......kk..', '...kk........k..', '..kk............', '..k.............']);
  a.onda = pix(['....cccc....', '..ccwwwwcc..', '.cwwc..cwwc.', 'cwc......cwc', 'cc........cc', 'c..........c']);
  a.botella = pix(['..kk..', '..kvk.', '..kvk.', '.kvvvk', '.kvwvk', '.kvvvk', '.kvvvk', '.kkkkk']);
  a.carta = pix(['kkkkkk', 'kwwwwk', 'kwrwwk', 'kwwrwk', 'kwwwwk', 'kwrwwk', 'kwwwwk', 'kkkkkk']);
  a.abanico = pix(['....kkkkk...', '..kkrrrrrkk.', '.krryrrryrrk', 'krrryrrryrrk', 'kryrryryrryk', '.krrrrrrrrk.', '..kkrbbrkk..', '....kbbk....', '.....kk.....']);
  a.bala = pix(['.kk.', 'kyyk', 'kywk', '.kk.']);
  a.gancho = pix(['..kkkk..', '.kggggk.', 'kgk..kgk', 'kgk..kgk', '.k...kgk', '....kgk.', '...kgk..', '...kk...']);

  // ── perro (dos fotogramas, mirando a la derecha y a la izquierda) ──
  const perro = (patas: string[]) => pix([
    '..........k..k..', '.........kBkkBk.', 'k........kbbbbkk', 'Bk......kbbwkbbk', 'kbkkkkkkkrbbbkk.', '.kbbbbbbbrbbk...', '.kbbbbbbbbbk....', '.kbBbbbbBbk.....', ...patas,
  ]);
  a.perro_d0 = perro(['.kbkkbkkbbk.....', '.kbk.kbkkbk.....', '.kk..kk..kk.....']);
  a.perro_d1 = perro(['..kbkkkkkbbk....', '.kbk....kkbk....', '.kk.......kk....']);
  a.perro_i0 = espejo(a.perro_d0);
  a.perro_i1 = espejo(a.perro_d1);

  // ── gato ──
  a.gato = pix(['.k....k.....', 'kok..kok....', 'koookook....', 'kovoovok....', 'kooopook....', '.koOoOok.kk.', '.kooooookook', '.koOoOoooook', '.kowoowokkk.', '..kk.kk.....']);

  // ── cabina telefónica ──
  {
    const [c, x] = lienzo(16, 30);
    x.fillStyle = K; x.fillRect(1, 0, 14, 30);
    x.fillStyle = col(41, 74, 148); x.fillRect(2, 1, 12, 28);
    x.fillStyle = col(82, 132, 214); x.fillRect(2, 1, 12, 5);
    x.fillStyle = col(107, 214, 231); x.fillRect(4, 8, 8, 11);
    x.fillStyle = col(255, 255, 255); x.fillRect(5, 9, 2, 6); x.fillRect(4, 2, 1, 3); x.fillRect(5, 2, 2, 1); x.fillRect(5, 4, 2, 1); x.fillRect(8, 2, 3, 1); x.fillRect(9, 2, 1, 3);
    x.fillStyle = K; x.fillRect(8, 11, 3, 5); x.fillRect(4, 20, 8, 1);
    x.fillStyle = col(165, 165, 173); x.fillRect(9, 12, 1, 3); x.fillRect(4, 22, 8, 5);
    x.fillStyle = col(99, 99, 115); x.fillRect(4, 26, 8, 1);
    a.cabina = c;
  }
  // ── barricada de tablones ──
  {
    const [c, x] = lienzo(16, 26);
    const m = col(140, 90, 49), o = col(99, 57, 33), l = col(189, 165, 132);
    x.fillStyle = K; x.fillRect(0, 2, 16, 24);
    for (let i = 0; i < 4; i++) {
      x.fillStyle = m; x.fillRect(1, 3 + i * 6, 14, 4);
      x.fillStyle = l; x.fillRect(1, 3 + i * 6, 14, 1);
      x.fillStyle = o; x.fillRect(1, 6 + i * 6, 14, 1);
    }
    x.fillStyle = K;
    for (let i = 0; i < 14; i++) { x.fillRect(1 + i, 3 + Math.round(i * 1.5), 2, 2); x.fillRect(13 - i, 3 + Math.round(i * 1.5), 2, 2); }
    x.fillStyle = col(165, 165, 173); x.fillRect(2, 4, 1, 1); x.fillRect(13, 4, 1, 1); x.fillRect(2, 22, 1, 1); x.fillRect(13, 22, 1, 1);
    a.barricada = c;
  }
  // ── cintas transportadoras: cuatro fotogramas hacia el sur; el motor las gira ──
  for (let f = 0; f < 4; f++) {
    const [c, x] = lienzo(16, 16);
    x.fillStyle = col(57, 57, 74); x.fillRect(0, 0, 16, 16);
    x.fillStyle = col(99, 99, 115);
    for (let y = -4; y < 16; y += 4) x.fillRect(1, y + f, 14, 2);
    x.fillStyle = K; x.fillRect(0, 0, 1, 16); x.fillRect(15, 0, 1, 16);
    x.fillStyle = col(247, 214, 74);
    const y = 4 + f;
    x.fillRect(7, y + 4, 2, 1); x.fillRect(6, y + 3, 4, 1); x.fillRect(5, y + 2, 6, 1);
    a['cinta' + f] = c;
  }
  // ── altar de Don Hideo ──
  {
    const [c, x] = lienzo(16, 24);
    const m = col(140, 90, 49), o = col(99, 57, 33), r = col(214, 49, 57);
    x.fillStyle = K; x.fillRect(0, 8, 16, 16); x.fillRect(4, 0, 8, 9);
    x.fillStyle = m; x.fillRect(1, 9, 14, 14); x.fillStyle = o; x.fillRect(1, 15, 14, 1); x.fillRect(1, 22, 14, 1);
    x.fillStyle = col(239, 214, 181); x.fillRect(5, 1, 6, 7);
    x.fillStyle = col(99, 99, 115); x.fillRect(6, 2, 4, 3); x.fillStyle = K; x.fillRect(7, 5, 2, 2);
    x.fillStyle = r; x.fillRect(2, 11, 2, 2); x.fillRect(12, 11, 2, 2);
    x.fillStyle = col(247, 214, 74); x.fillRect(2, 9, 1, 2); x.fillRect(13, 9, 1, 2);
    x.fillStyle = K; x.fillRect(5, 17, 2, 3); x.fillRect(7, 18, 2, 3); x.fillRect(9, 17, 2, 3);
    a.altar = c;
  }
  // ── plataforma flotante ──
  {
    const [c, x] = lienzo(16, 20);
    const m = col(140, 90, 49), o = col(99, 57, 33), l = col(189, 165, 132);
    x.fillStyle = K; x.fillRect(0, 0, 16, 20);
    x.fillStyle = m; x.fillRect(1, 1, 14, 14);
    x.fillStyle = l; x.fillRect(1, 1, 14, 1);
    x.fillStyle = o; for (let i = 0; i < 3; i++) x.fillRect(1, 4 + i * 4, 14, 1);
    x.fillStyle = o; x.fillRect(1, 15, 14, 4);
    x.fillStyle = K; x.fillRect(4, 15, 1, 4); x.fillRect(11, 15, 1, 4);
    a.plataforma = c;
  }
  return a;
}
