// Mazo de Actualidad: la noticia de cada semana. Se destapa sola, calienta su tema (+2) y se resuelve
// como si la jugara quien lidera la Ventaja; los efectos dicen a quién beneficia cada cosa.
import type { Carta } from '../../motor/tipos';
import { clima, colocar, como, dado, noticia, podemos, pv, retirar, socio, URBANAS } from './ayudas';

export const CARTAS_ACTUALIDAD: Carta[] = [
  noticia(56, 'INM', {
    nombre: 'Torre Pacheco',
    texto: 'Se retira toda la presencia de Murcia, el medidor de Vox sube 1 y el Clima baja 1. Dado: con 1-3 el Progresista coloca 2 allí; con 4-6, el Conservador.',
    contexto: 'En julio de 2025, tras la agresión a un vecino de 68 años, el pueblo murciano vivió varias noches de disturbios contra vecinos de origen magrebí.',
    efectos: [{ e: 'retirarTodo', provs: ['30'], de: 'ambos' }, socio('C', 1), clima(-1), dado([
      [3, [como('P', [colocar(2, { filtro: { provs: ['30'] } })])]],
      [6, [como('C', [colocar(2, { filtro: { provs: ['30'] } })])]],
    ])],
  }),
  noticia(57, 'DER', {
    nombre: 'La Vuelta, sin podio',
    texto: 'Las protestas propalestinas paran la carrera: los medidores de Frente Amplio y de Vox suben 1 y el Clima baja 1. Quien controle Madrid gana 1 PV.',
    contexto: 'El 14 de septiembre de 2025 las protestas contra el equipo israelí obligaron a suspender en Madrid la última etapa de La Vuelta.',
    efectos: [socio('P', 1), socio('C', 1), clima(-1), { e: 'alQueControlaMas', provs: ['28'], efectos: [pv(1)] }],
  }),
  noticia(58, 'DER', {
    nombre: 'La flotilla a Gaza',
    texto: 'La izquierda se moviliza: Frente Amplio sube 1, Podemos gana 1 de fuerza y el Progresista coloca 1 en Barcelona. El Conservador lo tacha de postureo y gana 1 PV.',
    contexto: 'En octubre de 2025 Israel interceptó la Global Sumud Flotilla; Ada Colau, hoy candidata de Frente Amplio, fue detenida a bordo.',
    efectos: [socio('P', 1), podemos(1, 0), como('P', [colocar(1, { filtro: { provs: ['08'] } })]), como('C', [pv(1)])],
  }),
  noticia(59, 'SER', {
    nombre: 'Incendios del verano',
    texto: 'Cada bloque pierde 1 presencia en 3 provincias de Interior o la Cornisa Norte. Dado: con 1-3 se culpa al Gobierno (+2 PV Conservador); con 4-6, a las comunidades (+2 PV Progresista).',
    contexto: 'En agosto de 2025 ardieron más de 400.000 hectáreas; el Gobierno y las comunidades del PP se acusaron mutuamente de llegar tarde.',
    efectos: [retirar(3, { maxPor: 1, de: 'ambos', filtro: { zonas: ['INT', 'NOR'] } }), dado([
      [3, [como('C', [pv(2)])]],
      [6, [como('P', [pv(2)])]],
    ])],
  }),
  noticia(47, 'SER', {
    nombre: 'La DANA, en el foco',
    texto: 'Se retira toda la presencia de Valencia. Dado: con 1-3 el Progresista coloca 2 allí; con 4-6, el Conservador.',
    contexto: 'La riada del 29 de octubre de 2024 dejó más de doscientos muertos en Valencia. El president Mazón dimitió un año después.',
    efectos: [{ e: 'retirarTodo', provs: ['46'], de: 'ambos' }, dado([
      [3, [como('P', [colocar(2, { filtro: { provs: ['46'] } })])]],
      [6, [como('C', [colocar(2, { filtro: { provs: ['46'] } })])]],
    ])],
  }),
  noticia(48, 'ECO', {
    nombre: 'El apagón',
    texto: 'Dado: con 1-3 se culpa al Gobierno y el Conservador gana 2 PV; con 4-6 la respuesta convence y el Progresista gana 2 PV.',
    contexto: 'El 28 de abril de 2025 la península se quedó a oscuras durante horas. ¿Quién responde?',
    efectos: [dado([[3, [como('C', [pv(2)])]], [6, [como('P', [pv(2)])]]])],
  }),
  noticia(50, 'ECO', {
    nombre: 'Trump amenaza con aranceles',
    texto: 'Efecto bandera: el Progresista, que gobierna, gana 1 PV. El campo exportador protesta: el Conservador coloca 2 en Interior o Levante y Baleares.',
    contexto: 'Trump amenazó con castigar a España con aranceles por negarse al 5% de gasto en defensa que pedía la OTAN.',
    efectos: [como('P', [pv(1)]), como('C', [colocar(2, { maxPor: 1, filtro: { zonas: ['INT', 'LEV'] } })])],
  }),
  noticia(276, 'COR', {
    nombre: 'Vito Quiles, micrófono en mano',
    texto: 'Un agitador digital acorrala a ministros por los pasillos: el Conservador retira 2 presencia progresista de provincias clave, Vox sube 1 y el Clima baja 1.',
    contexto: 'El Congreso le retiró definitivamente la acreditación de prensa en septiembre por grabar en zonas restringidas e interrumpir ruedas de prensa.',
    efectos: [como('C', [retirar(2, { maxPor: 1, filtro: { clave: true } })]), socio('C', 1), clima(-1)],
  }),
  noticia(277, 'SER', {
    nombre: 'Huelga de médicos',
    texto: 'Paran contra el Estatuto Marco del Gobierno, y también en los hospitales de las comunidades: el Conservador gana 1 PV y el Progresista retira 2 presencia conservadora de provincias clave.',
    contexto: 'Los sindicatos médicos paran una semana al mes contra el Estatuto Marco y piden la dimisión de la ministra de Sanidad, de Más Madrid.',
    efectos: [como('C', [pv(1)]), como('P', [retirar(2, { maxPor: 1, filtro: { clave: true } })])],
  }),
  noticia(278, 'DER', {
    nombre: 'España se baja de Eurovisión',
    texto: 'La retirada divide a la audiencia: Frente Amplio y Vox suben 1. Después, cada bloque tira un dado y el mayor gana 1 PV.',
    contexto: 'RTVE decidió no participar en Eurovisión 2026 ni emitirlo por la presencia de Israel; el Gobierno lo aplaudió.',
    efectos: [socio('P', 1), socio('C', 1), { e: 'duelo', pv: 1 }],
  }),
  noticia(299, 'INM', {
    nombre: 'Cayucos rumbo a El Hierro',
    texto: 'El medidor de Vox sube 1 y el Conservador coloca 2 presencia en Canarias, Ceuta o Melilla.',
    contexto: 'La ruta atlántica sigue llevando cayucos a Canarias y la acogida de menores migrantes enfrenta a las administraciones.',
    efectos: [socio('C', 1), como('C', [colocar(2, { maxPor: 1, filtro: { zonas: ['CAN'] } })])],
  }),
  noticia(296, 'DER', {
    nombre: 'Debate a siete en RTVE',
    texto: 'Los socios ganan foco: Vox y Frente Amplio suben 1 y Podemos gana 1 de fuerza. Quien controle más provincias clave de Madrid y Centro gana 1 PV.',
    contexto: 'Como en 2023, RTVE sienta a los portavoces de siete partidos en el mismo plató.',
    efectos: [socio('P', 1), socio('C', 1), podemos(1, 0), { e: 'alQueControlaMas', provs: ['28', '45', '06'], efectos: [pv(1)] }],
  }),
  noticia(298, 'ESP', {
    nombre: 'Junts marca distancias',
    texto: 'Junts se mueve 1 hacia la neutralidad y crece un 10% en Cataluña.',
    contexto: 'Junts rompió con el PSOE y vota caso a caso: ni con unos ni con otros.',
    efectos: [{ e: 'afinidadNeutral', partido: 'JUNTS' }, { e: 'regional', partido: 'JUNTS', pct: 0.1 }],
  }),
  noticia(295, 'ESP', {
    nombre: 'Fuga del voto nacionalista',
    texto: 'El voto útil también funciona en Cataluña: ERC y Junts pierden un 10% de su voto, que va a los grandes bloques.',
    contexto: 'Las encuestas detectan trasvases de los nacionalistas hacia el PSC y el PP.',
    efectos: [{ e: 'regional', partido: 'ERC', pct: -0.1 }, { e: 'regional', partido: 'JUNTS', pct: -0.1 }],
  }),
  noticia(285, 'SER', {
    nombre: 'Cumbre de presidentes autonómicos',
    texto: 'La Conferencia de Presidentes, convertida en plató: cada bloque tira un dado y el mayor gana 2 PV.',
    contexto: 'Los presidentes autonómicos del PP y el Gobierno se reprochan la financiación de los servicios.',
    efectos: [{ e: 'duelo', pv: 2 }],
  }),
  noticia(283, 'ESP', {
    nombre: 'Crisis institucional',
    texto: 'Un choque entre instituciones del Estado en plena campaña: el Clima baja 2 (nunca por debajo de 2).',
    contexto: 'El Gobierno y el Poder Judicial cruzan reproches en público.',
    efectos: [clima(-2, 2)],
  }),
  noticia(284, 'ECO', {
    nombre: 'Pacto de caballeros',
    texto: 'Los dos grandes partidos acuerdan rebajar el tono: el Clima sube 2.',
    contexto: 'Un acontecimiento grave obliga a suspender los actos durante un día.',
    efectos: [clima(2)],
  }),
  noticia(294, 'DER', {
    nombre: 'Abstención de castigo',
    texto: 'El desencanto amenaza con quedarse en casa: cada bloque pierde 1 presencia en las 3 provincias más grandes donde la tenga.',
    contexto: 'Uno de cada tres votantes dice que no sabe si irá a votar.',
    efectos: [retirar(3, { maxPor: 1, de: 'ambos' })],
  }),
  noticia(53, 'SER', {
    nombre: 'Voto por correo',
    texto: 'Colas en Correos: quien va por detrás en la Ventaja coloca 2 presencia (máx. 1 por provincia).',
    contexto: 'El voto anticipado se dispara.',
    efectos: [{ e: 'aRezagado', efectos: [colocar(2, { maxPor: 1 })] }],
  }),
  noticia(54, 'VIV', {
    nombre: 'Debate sobre la vivienda',
    texto: 'Quien controle más provincias entre Madrid, Barcelona, Valencia, Málaga, Sevilla y Baleares gana 2 PV.',
    contexto: 'El precio del alquiler, en todos los debates.',
    efectos: [{ e: 'alQueControlaMas', provs: URBANAS, efectos: [pv(2)] }],
  }),
];
