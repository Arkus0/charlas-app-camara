// Temas gráficos: qué sprites usa cada tipo de terreno según la zona.

export interface Tema {
  suelo: string[];
  alt: string[];
  ter: string[];
  /** superficie de los suelos elevados */
  alto: string[];
  /** cara de los escalones: [fila superior…, fila intermedia] y base */
  cara: string[];
  caraBase: string;
  muroTop: string;
  muroCara: string[];
  muroBase: string;
  olas: string;
  colorAgua: string;
  colorFoso: string;
  /** luz ambiente (multiplica la escena) */
  ambiente: string;
  musica: string;
  /** el vacío deja ver el fondo nocturno */
  fondo?: boolean;
  exterior?: boolean;
}

const base: Tema = {
  suelo: ['adoquin0', 'adoquin1'],
  alt: ['hierba0', 'hierba1', 'hierba2', 'hierba3'],
  ter: ['asfalto0'],
  alto: ['losa0', 'losa1'],
  cara: ['muralla'], caraBase: 'muralla_base',
  muroTop: 'teja', muroCara: ['ladrillo_ama'], muroBase: 'ladrillo_ama',
  olas: 'ola', colorAgua: '#1878b8', colorFoso: '#100818',
  ambiente: '#6a72bc', musica: 'pueblo', exterior: true,
};

export const TEMAS: Record<string, Tema> = {
  pueblo: base,
  muelle: { ...base, suelo: ['tabla0', 'tabla1'], alt: ['adoquin0', 'adoquin1'], fondo: true },
  paseo: { ...base, suelo: ['losa0', 'losa1'], muroCara: ['ladrillo_ama'] },
  obra: { ...base, suelo: ['losa0', 'losa1'], alt: ['tierra0', 'tierra1'], alto: ['tabla0', 'tabla1'], cara: ['pared'], caraBase: 'pared_base', muroTop: 'techo', muroCara: ['pared_sup', 'pared'], muroBase: 'pared_base', fondo: true },
  interior: {
    suelo: ['tabla0', 'tabla1'], alt: ['baldosa'], ter: ['moqueta'], alto: ['tabla2'],
    cara: ['pared'], caraBase: 'pared_base',
    muroTop: 'techo', muroCara: ['pared_sup', 'pared'], muroBase: 'pared_base',
    olas: 'ola', colorAgua: '#1878b8', colorFoso: '#100818',
    ambiente: '#c8b89c', musica: 'bar',
  },
  lonja: {
    suelo: ['losa0', 'losa1'], alt: ['tabla0', 'tabla1'], ter: ['baldosa'], alto: ['ladrillo0', 'ladrillo1', 'ladrillo2', 'ladrillo3'],
    cara: ['muralla'], caraBase: 'muralla_base',
    muroTop: 'techo', muroCara: ['pared_sup', 'pared'], muroBase: 'pared_base',
    olas: 'ola', colorAgua: '#1878b8', colorFoso: '#100818',
    ambiente: '#8088b0', musica: 'mazmorra',
  },
  bodega: {
    suelo: ['cueva0', 'cueva1', 'cueva2'], alt: ['ladrillo_osc'], ter: ['tabla0', 'tabla1'], alto: ['tierra0', 'tierra1'],
    cara: ['cueva_cara0', 'cueva_cara1'], caraBase: 'cueva_base',
    muroTop: 'cueva_techo', muroCara: ['cueva_cara0', 'cueva_cara1'], muroBase: 'cueva_base',
    olas: 'cola', colorAgua: '#10608c', colorFoso: '#0c0614',
    ambiente: '#6a5c80', musica: 'mazmorra',
  },
  toros: {
    suelo: ['albero0', 'albero1'], alt: ['tierra0', 'tierra1'], ter: ['losa0', 'losa1'], alto: ['losa0', 'losa1'],
    cara: ['muralla'], caraBase: 'muralla_base',
    muroTop: 'techo', muroCara: ['muralla_sup', 'muralla'], muroBase: 'muralla_base',
    olas: 'ola', colorAgua: '#1878b8', colorFoso: '#100818',
    ambiente: '#9088a8', musica: 'mazmorra',
  },
  hotel: {
    suelo: ['marmol'], alt: ['moqueta'], ter: ['baldosa'], alto: ['tabla0', 'tabla1'],
    cara: ['pared'], caraBase: 'pared_base',
    muroTop: 'techo', muroCara: ['pared_sup', 'pared'], muroBase: 'pared_base',
    olas: 'ola', colorAgua: '#1878b8', colorFoso: '#100818',
    ambiente: '#a0a0c0', musica: 'mazmorra', fondo: true,
  },
};
