// Las cartas de «176 · La Batalla del 29N».
// Cada carta: PC (1-4) y un evento Progresista (P), Conservador (C) o Neutral (N). E = Encuesta.
// W = comodín de Podemos: su evento se activa siempre que se use por sus PC, lo juegue quien lo juegue.
// A = Agenda de Podemos: no se juega; Podemos destapa una cada semana y la sufre quien lidera la Ventaja.
// Neutralidad: cada carta de un bloque tiene su pareja espejo en el otro, con los mismos PC y un efecto equivalente.
// Los temas son públicos y reales; los textos describen situaciones genéricas, sin atribuir hechos a personas.
import type { Carta, Cond, Efecto, Filtro, TipoEfectoActivo, ZonaId } from '../engine/tipos';
import { PROVINCIAS } from './provincias';

type Bloque = 'P' | 'C';

const URBANAS = ['28', '08', '46', '29', '41', '07'];
const GALICIA = ['15', '27', '32', '36'];
const CLAVES = PROVINCIAS.filter((p) => p.clave).map((p) => p.id);

const pv = (n: number): Efecto => ({ e: 'pv', n });
const clima = (n: number, minimo?: number): Efecto => ({ e: 'clima', n, minimo });
const colocar = (n: number, filtro?: Filtro, maxPor?: number, unaSola?: boolean): Efecto => ({ e: 'colocar', n, filtro, maxPor, unaSola });
const retirar = (n: number, filtro?: Filtro, maxPor?: number, unaSola?: boolean): Efecto => ({ e: 'retirar', n, filtro, maxPor, unaSola });
const socio = (bloque: 'yo' | 'rival' | 'P' | 'C', n: number): Efecto => ({ e: 'socio', bloque, n });
const podemos = (fuerza: number, humor: number, pinza = 0): Efecto => ({ e: 'podemos', fuerza, humor, pinza });
const activar = (tipo: TipoEfectoActivo, hasta: 'turno' | 'partida' | 'uso', extra: Partial<Extract<Efecto, { e: 'activar' }>> = {}): Efecto => ({ e: 'activar', tipo, hasta, ...extra });
const si = (cond: Cond, entonces: Efecto[], sino?: Efecto[]): Efecto => ({ e: 'si', cond, entonces, sino });
const como = (bando: Bloque | 'rival', efectos: Efecto[]): Efecto => ({ e: 'como', bando, efectos });
const elegir = (opciones: [string, Efecto[]][], quien?: 'yo' | 'rival'): Efecto => ({ e: 'elegir', quien, opciones: opciones.map(([texto, efectos]) => ({ texto, efectos })) });
const bandera = (k: string): Efecto => ({ e: 'bandera', k });

type Def = Omit<Carta, 'retirar' | 'mazo'> & { retirar?: boolean };
type Mitad = Pick<Def, 'nombre' | 'texto' | 'contexto' | 'escena' | 'efectos'> & Partial<Pick<Def, 'requisito'>>;
type Extra = Partial<Pick<Def, 'retirar' | 'batalla' | 'transfuga' | 'noticia'>>;

const RIVAL_TXT: Record<Bloque, string> = { P: 'el Conservador', C: 'el Progresista' };
const RIVAL_ADJ: Record<Bloque, string> = { P: 'conservadora', C: 'progresista' };
/** Color del bloque con su concordancia: col('P', 'as') → «rojas», col('C', 'as') → «azules». */
const col = (b: Bloque, f: 'o' | 'a' | 'os' | 'as') => (b === 'P' ? 'roj' + f : f.endsWith('s') ? 'azules' : 'azul');

/** Pareja espejo: la misma carta para cada bloque, con su ambientación propia. */
const espejo = (idP: number, idC: number, ops: number, def: (b: Bloque) => Mitad, extra: Extra = {}): Def[] => [
  { ...extra, ...def('P'), id: idP, ops, lado: 'P', pareja: idC },
  { ...extra, ...def('C'), id: idC, ops, lado: 'C', pareja: idP },
];

const TEXTO_ENCUESTA = 'Puntúa la zona: presencia, dominio o control, +1 por cada provincia clave y por cada feudo rival que controles (saldo máx. 5 PV). Hay que publicarla la semana en que se roba. En la semana 8 (veda) no da PV.';

const encuesta = (id: number, zona: ZonaId, nombre: string, contexto: string, escena: string, extraTexto = ''): Def => ({
  id, nombre, ops: 0, lado: 'E', zona, contexto, escena,
  texto: TEXTO_ENCUESTA + extraTexto,
  efectos: [{ e: 'puntuar', zona }],
});

// ———————————————————————————————————————————————————————— MAZO I · PRECAMPAÑA (semanas 1-3)
const MAZO_1: Def[] = [
  encuesta(101, 'AND', 'Encuesta: Andalucía', 'La comunidad que más diputados reparte: 61.',
    'Un gráfico de barras gigante levantado como un decorado sobre un campo de olivos al atardecer, con barras rojas y azules de alturas parecidas'),
  encuesta(102, 'CAT', 'Encuesta: Cataluña', 'Donde el PSC compite con ERC y Junts por cada escaño.',
    'Un gráfico de barras gigante sobre un paseo marítimo mediterráneo, con barras de varios colores y una sombra alargada',
    ' Asalto a la Moncloa: quien controle a la vez Cataluña y Madrid y Centro cuando se publique gana la partida.'),
  encuesta(103, 'MAD', 'Encuesta: Madrid y Centro', 'Madrid estrena su diputado número 38.',
    'Un gráfico de barras gigante levantado en mitad de una meseta con una gran ciudad al fondo y nubes bajas',
    ' Asalto a la Moncloa: quien controle a la vez Madrid y Centro y Cataluña cuando se publique gana la partida.'),
  encuesta(104, 'LEV', 'Encuesta: Levante y Baleares', 'Valencia, Alicante, Castellón, Murcia y Baleares.',
    'Un gráfico de barras gigante entre huertas de naranjos con el mar y una isla al fondo'),

  ...espejo(1, 21, 3, (b) => ({
    nombre: b === 'P' ? 'Ferraz a toda máquina' : 'Génova a toda máquina',
    texto: 'Hasta el final de la semana, todas tus operaciones valen +1 PC (máx. 5).',
    contexto: b === 'P' ? 'La sede socialista activa su maquinaria de campaña a pleno rendimiento.' : 'La sede popular activa su maquinaria de campaña a pleno rendimiento.',
    escena: `Una sala de máquinas nocturna con grandes engranajes y palancas ${col(b, 'as')} a pleno rendimiento; siluetas anónimas con auriculares coordinan pantallas encendidas`,
    efectos: [activar('masOps', 'turno')],
  }), { retirar: true }),

  ...espejo(2, 22, 4, (b) => ({
    nombre: b === 'P' ? 'Fondos europeos' : 'Frente autonómico',
    texto: `Elige: coloca 1 presencia en 6 provincias que no controle ${RIVAL_TXT[b]} o retira 4 presencia ${RIVAL_ADJ[b]} (en ambos casos, máx. 1 por provincia). Habilita «Bloque de investidura» y «Pacto autonómico».`,
    contexto: b === 'P' ? 'Los proyectos de los fondos de recuperación llegan a ayuntamientos de toda España.' : 'Los presidentes autonómicos del PP coordinan su ofensiva frente al Gobierno.',
    escena: b === 'P'
      ? 'Un mapa de España de papel extendido sobre una mesa, con decenas de chinchetas rojas, grúas y obras públicas en miniatura'
      : 'Una mesa larga con sillas vacías y carpetas azules alineadas frente a un mapa autonómico recortado en piezas, luz de mañana',
    efectos: [elegir([
      ['Colocar 1 presencia en 6 provincias que no controle el rival', [colocar(6, { noControla: 'rival' }, 1)]],
      ['Retirar 4 presencia rival (máx. 1 por provincia)', [retirar(4, undefined, 1)]],
    ]), bandera('bloques')],
  }), { retirar: true }),

  ...espejo(3, 23, 3, (b) => ({
    nombre: b === 'P' ? '«Que viene la ultraderecha»' : '«Que se rompe España»',
    texto: 'El Clima baja 1. Después ganas tantos PV como 5 menos el Clima.',
    contexto: b === 'P' ? 'El miedo a un Gobierno con Vox como resorte para movilizar al electorado progresista.' : 'El miedo a las cesiones al independentismo como resorte para movilizar al electorado conservador.',
    escena: `Una sirena de alarma ${col(b, 'a')} girando sobre una plaza vacía al anochecer, con las sombras alargadas de una multitud que acude`,
    efectos: [clima(-1), { e: 'pvMenosClima', base: 5 }],
  })),

  ...espejo(4, 24, 3, (b) => ({
    nombre: b === 'P' ? 'Comisión de investigación en el Congreso' : 'Comisión de investigación en el Senado',
    texto: `${b === 'P' ? 'El Conservador' : 'El Progresista'} descarta una carta al azar. Si su evento es ${b === 'P' ? 'progresista' : 'conservador'}, se activa para ti.`,
    contexto: b === 'P' ? 'La mayoría del Congreso cita a comparecer a responsables de gobiernos autonómicos de la oposición.' : 'La mayoría absoluta del PP en el Senado cita a comparecer a miembros del Gobierno.',
    escena: `Una sala de comisión parlamentaria con un micrófono solitario ante una silla vacía, focos ${col(b, 'os')} y carpetas apiladas`,
    efectos: [{ e: 'comision' }],
  })),

  ...espejo(5, 25, 3, (b) => ({
    nombre: b === 'P' ? 'Marea por la sanidad pública' : 'Marea por la igualdad entre españoles',
    texto: b === 'P'
      ? 'Retira 3 presencia conservadora en Andalucía o Madrid y Centro (máx. 2 por provincia).'
      : 'Retira 3 presencia progresista en Cataluña o la Cornisa Norte (máx. 2 por provincia).',
    contexto: b === 'P' ? 'Las protestas por las listas de espera señalan a los gobiernos autonómicos.' : 'Las protestas contra la financiación singular y la amnistía señalan al Gobierno.',
    escena: b === 'P'
      ? 'Una marea de batas blancas y pancartas lisas avanzando por una avenida, vista desde arriba, con destellos rojos'
      : 'Una marea de banderas lisas avanzando por una avenida, vista desde arriba, con destellos azules',
    efectos: [retirar(3, { zonas: b === 'P' ? ['AND', 'MAD'] : ['CAT', 'NOR'] }, 2)],
  })),

  ...espejo(6, 26, 2, (b) => ({
    nombre: b === 'P' ? 'Alcaldía de progreso' : 'Alcaldía del cambio',
    texto: `Elige una provincia de 4 escaños o menos con presencia ${RIVAL_ADJ[b]}: la retiras toda y colocas la presencia necesaria para controlarla.`,
    contexto: b === 'P' ? 'Un vuelco municipal en una capital de provincia da aire al Gobierno.' : 'Un vuelco municipal en una capital de provincia da aire a la oposición.',
    escena: `El balcón de un ayuntamiento de provincia con la plaza llena y una lluvia de confeti ${col(b, 'o')}`,
    efectos: [{ e: 'tomar', filtro: { maxEscanos: 4 } }],
  }), { retirar: true }),

  ...espejo(7, 27, 2, (b) => ({
    nombre: b === 'P' ? 'Batalla por las capitales' : 'Pulso por las capitales',
    texto: `Batalla en una provincia clave que controle ${RIVAL_TXT[b]}: tira un dado y resta 1 por cada provincia vecina que controle. Con 4 o más, toda su presencia allí pasa a ser tuya y ganas 2 PV. Suma 2 a tu Exigencia.`,
    contexto: b === 'P' ? 'El Gobierno vuelca su aparato sobre una gran plaza de la oposición.' : 'La oposición vuelca su aparato sobre una gran plaza del Gobierno.',
    escena: `Dos ejércitos de paraguas, ${b === 'P' ? 'rojos y azules' : 'azules y rojos'}, chocando en una plaza mayor bajo la lluvia, vistos desde una torre; dominan los ${col(b, 'os')}`,
    efectos: [{ e: 'batalla', filtro: { clave: true, controla: 'rival' } }],
  }), { retirar: true, batalla: true }),

  ...espejo(8, 28, 1, (b) => ({
    nombre: b === 'P' ? 'Choque con la Comunidad de Madrid' : 'Choque con la Generalitat',
    texto: `${b === 'P' ? 'El Conservador' : 'El Progresista'} debe descartar una carta de 3 o más PC o pierde toda su presencia en ${b === 'P' ? 'Madrid' : 'Barcelona'}.`,
    contexto: b === 'P' ? 'El Gobierno y la Comunidad de Madrid chocan por la financiación y las competencias.' : 'La oposición choca con el Govern por el acuerdo de financiación con Cataluña.',
    escena: `Un muro de expedientes ${b === 'P' ? 'azules' : 'rojos'} levantándose ante la puerta de un edificio institucional genérico, con una cinta ${col(b, 'a')} que lo sujeta`,
    efectos: [{ e: 'bloqueo', prov: b === 'P' ? '28' : '08', minOps: 3 }],
  }), { retirar: true }),

  ...espejo(9, 29, 2, (b) => ({
    nombre: b === 'P' ? 'Marea en el sur' : 'Ola en el Levante',
    texto: b === 'P'
      ? 'Coloca 2 presencia en Sevilla. Hasta el final de la semana, +1 PC a las operaciones que hagas solo en Andalucía.'
      : 'Coloca 2 presencia en Valencia. Hasta el final de la semana, +1 PC a las operaciones que hagas solo en Levante y Baleares.',
    contexto: b === 'P' ? 'La movilización socialista en su antiguo granero andaluz.' : 'La ola popular en la Comunitat Valenciana y Murcia.',
    escena: b === 'P'
      ? 'Una ola roja de papel recortado rompiendo sobre un paisaje de olivos al atardecer'
      : 'Una ola azul de papel recortado rompiendo sobre una huerta mediterránea con naranjos',
    efectos: [colocar(2, { provs: [b === 'P' ? '41' : '46'] }), activar('bonoZona', 'turno', { zona: b === 'P' ? 'AND' : 'LEV' })],
  }), { retirar: true }),

  ...espejo(10, 30, 2, (b) => ({
    nombre: b === 'P' ? 'Ruta del Gobierno por la España vaciada' : 'Ruta del cambio por la España vaciada',
    texto: 'Coloca 1 presencia en 4 provincias de 4 escaños o menos.',
    contexto: 'Un autobús de campaña recorre las provincias que menos diputados eligen.',
    escena: `Un autobús de campaña ${col(b, 'o')} por una carretera solitaria entre campos de cereal, con un pueblo de piedra al fondo`,
    efectos: [colocar(4, { maxEscanos: 4 }, 1)],
  })),

  ...espejo(11, 31, 3, (b) => ({
    nombre: b === 'P' ? 'Relevo en las federaciones' : 'Relevo en las direcciones provinciales',
    texto: `Traslada hasta 4 de tu presencia a provincias que no controle ${RIVAL_TXT[b]} (máx. 2 por provincia de destino).`,
    contexto: b === 'P' ? 'El PSOE renueva a sus dirigentes territoriales antes de cerrar las listas.' : 'El PP renueva a sus dirigentes provinciales antes de cerrar las listas.',
    escena: `Una mano anónima desplazando fichas ${col(b, 'as')} por un mapa dibujado con flechas de tiza`,
    efectos: [{ e: 'mover', n: 4, maxPor: 2 }],
  }), { retirar: true }),

  ...espejo(12, 32, 1, (b) => ({
    nombre: b === 'P' ? 'Cordón sanitario a la ultraderecha' : 'Cordón sanitario al independentismo',
    texto: `Retira toda la presencia ${RIVAL_ADJ[b]} de una provincia que no controle nadie.`,
    contexto: b === 'P' ? 'El Progresista pide aislar a Vox y a quien pacte con él.' : 'El Conservador pide aislar al independentismo y a quien pacte con él.',
    escena: `Una cinta de balizamiento ${col(b, 'a')} rodeando una silla vacía en un salón de plenos`,
    efectos: [{ e: 'retirarTodoN', n: 1, filtro: { sinControl: true } }],
  })),

  ...espejo(13, 33, 2, (b) => ({
    nombre: b === 'P' ? 'Voto oculto progresista' : 'Voto oculto conservador',
    texto: b === 'P'
      ? 'En una de estas provincias, igualas la presencia conservadora: Madrid, Valencia, Málaga, Murcia o Zaragoza.'
      : 'En una de estas provincias, igualas la presencia progresista: Barcelona, Sevilla, Asturias, Bizkaia o Las Palmas.',
    contexto: b === 'P' ? 'Las encuestas no detectan a todos los votantes progresistas.' : 'Las encuestas no detectan a todos los votantes conservadores.',
    escena: `Una urna translúcida llena de sobres, la mitad en sombra, con un destello ${col(b, 'o')} en su interior`,
    efectos: [{ e: 'igualar', provs: b === 'P' ? ['28', '46', '29', '30', '50'] : ['08', '41', '33', '48', '35'] }],
  }), { retirar: true }),

  ...espejo(14, 34, 1, (b) => ({
    nombre: b === 'P' ? 'El gabinete de Moncloa' : 'El gabinete de Génova',
    texto: `Ves la mano ${b === 'P' ? 'del Conservador' : 'del Progresista'} durante esta semana y haces 1 PC de operaciones.`,
    contexto: b === 'P' ? 'Los analistas de Moncloa estudian cada movimiento de la oposición.' : 'Los analistas de Génova estudian cada movimiento del Gobierno.',
    escena: `Una sala de análisis en penumbra con pantallas de gráficas sin cifras y una lupa ${col(b, 'a')} sobre unas cartas boca arriba`,
    efectos: [{ e: 'verMano' }, { e: 'ops', pc: 1, tipo: 'cualquiera' }],
  })),

  ...espejo(15, 35, 4, (b) => ({
    nombre: b === 'P' ? 'Bastión de Barcelona' : 'Bastión de Madrid',
    texto: `Colocas la presencia necesaria para controlar ${b === 'P' ? 'Barcelona' : 'Madrid'}. Desde ahora ${RIVAL_TXT[b]} no puede lanzar ofensivas ni debates locales allí.`,
    contexto: b === 'P' ? 'El PSC convierte Barcelona en su fortaleza.' : 'El PP convierte Madrid en su fortaleza.',
    escena: b === 'P'
      ? 'Una fortaleza de bloques rojos sobre la silueta de una ciudad mediterránea con puerto y montaña'
      : 'Una fortaleza de bloques azules sobre la silueta de una gran capital en la meseta',
    efectos: [{ e: 'controlar', prov: b === 'P' ? '08' : '28' }, activar('bastion', 'partida', { prov: b === 'P' ? '08' : '28' })],
  }), { retirar: true }),

  ...espejo(16, 36, 3, (b) => ({
    nombre: b === 'P' ? 'Crisis en los gobiernos PP-Vox' : 'Crisis en los socios del Gobierno',
    texto: b === 'P'
      ? 'Retira 4 presencia conservadora en Valencia, Murcia, Zaragoza o Badajoz (máx. 2 por provincia).'
      : 'Retira 4 presencia progresista en Barcelona, Bizkaia, Gipuzkoa o Navarra (máx. 2 por provincia).',
    contexto: b === 'P' ? 'Vox rompió en 2024 los gobiernos autonómicos que compartía con el PP, y cada pacto nuevo se negocia entre reproches.' : 'Junts rompió con el PSOE y en octubre tumbó los decretos de vivienda que precipitaron el adelanto.',
    escena: `Una mesa de negociación partida en dos con sillas volcadas y papeles ${b === 'P' ? 'azules' : 'rojos'} por el suelo`,
    efectos: [retirar(4, { provs: b === 'P' ? ['46', '30', '50', '06'] : ['08', '48', '20', '31'] }, 2)],
  }), { retirar: true }),

  ...espejo(17, 37, 3, (b) => ({
    nombre: b === 'P' ? 'Disolución de las Cortes' : 'Ola autonómica',
    texto: 'Coloca 1 presencia en 3 provincias clave y gana 1 PV.',
    contexto: b === 'P' ? 'El 2 de octubre el Congreso tumbó los decretos de vivienda por 178 votos a 172. Tres días después, el presidente disolvió las Cortes.' : 'El PP gobierna la mayoría de las comunidades y ganó en mayo las andaluzas, aunque sin mayoría absoluta.',
    escena: b === 'P'
      ? 'Un gran reloj de pared junto a un decreto con lacre rojo sobre un atril vacío'
      : 'Un mapa autonómico iluminándose comunidad a comunidad en azul, como fichas de dominó que caen',
    efectos: [colocar(3, { clave: true }, 1), pv(1)],
  }), { retirar: true }),

  ...espejo(18, 38, 3, (b) => ({
    nombre: b === 'P' ? 'Escudo social' : 'Rebaja fiscal',
    texto: 'Coloca 1 presencia en 4 provincias de 5 escaños o menos.',
    contexto: b === 'P' ? 'Pensiones revalorizadas e ingreso mínimo en el centro del mensaje del Gobierno.' : 'Bajadas de impuestos autonómicos como escaparate de la oposición.',
    escena: b === 'P'
      ? 'Un paraguas rojo enorme protegiendo de la lluvia a un grupo de siluetas de distintas edades'
      : 'Una calculadora azul gigante de la que caen monedas de vuelta a unas manos abiertas',
    efectos: [colocar(4, { maxEscanos: 5 }, 1)],
  })),

  ...espejo(19, 39, 2, (b) => ({
    nombre: b === 'P' ? 'Topes al alquiler' : 'Okupación y seguridad',
    texto: 'Coloca 1 presencia en 3 de estas provincias: Madrid, Barcelona, Valencia, Málaga, Sevilla o Baleares.',
    contexto: b === 'P' ? 'Los decretos de vivienda que tumbó el Congreso son la bandera de la campaña progresista.' : 'La okupación y la multirreincidencia, en el centro del mensaje de la oposición.',
    escena: b === 'P'
      ? 'Un bloque de pisos con ventanas encendidas y una llave roja gigante colgando del cielo'
      : 'Una puerta blindada azul en un rellano, con una cerradura gigante y luz de escalera',
    efectos: [colocar(3, { provs: URBANAS }, 1)],
  })),

  ...espejo(20, 40, 3, (b) => ({
    nombre: b === 'P' ? 'Frenar a la ultraderecha' : 'Concentrar el voto del cambio',
    texto: b === 'P'
      ? 'La polarización moviliza a los extremos: el medidor de Vox sube 1, el de Frente Amplio baja 1 (voto útil al PSOE) y ganas 1 PV.'
      : 'La llamada a no dividir el voto: el medidor de Frente Amplio sube 1, el de Vox baja 1 (voto útil al PP) y ganas 1 PV.',
    contexto: b === 'P' ? 'El «que viene la derecha» concentra el voto en el PSOE.' : 'La apelación al voto que suma concentra a la derecha en el PP.',
    escena: `Un embudo ${col(b, 'o')} gigante que recoge papeletas que caen desde varias direcciones`,
    efectos: [socio('rival', 1), socio('yo', -1), pv(1)],
  }), { retirar: true }),

  // —— Noticias reales, también en espejo ——
  ...espejo(61, 71, 3, (b) => ({
    nombre: b === 'P' ? 'Caso Kitchen: Interior, en el banquillo' : 'Caso Koldo: 24 años para Ábalos',
    texto: b === 'P'
      ? 'El juicio a la cúpula de Interior del último Gobierno del PP abre los telediarios: ganas 2 PV y retiras 2 presencia conservadora de provincias clave (máx. 1 por provincia).'
      : 'La condena del exministro socialista abre los telediarios: ganas 2 PV y retiras 2 presencia progresista de provincias clave (máx. 1 por provincia).',
    contexto: b === 'P'
      ? 'La Audiencia Nacional juzgó en abril al exministro del Interior Jorge Fernández Díaz por el presunto espionaje a Bárcenas con fondos públicos. La sentencia está pendiente.'
      : 'En junio el Supremo condenó a José Luis Ábalos a 24 años de prisión y a su exasesor Koldo García a más de 19 por las mordidas de las mascarillas.',
    escena: b === 'P'
      ? 'Una cocina industrial en penumbra con carpetas azules sobre los fogones, una grabadora antigua y una lupa roja'
      : 'Cajas de mascarillas apiladas en un almacén con un mazo de juez sobre ellas y sobres rojos por el suelo',
    efectos: [pv(2), retirar(2, { clave: true }, 1)],
  }), { retirar: true, noticia: true }),

  ...espejo(62, 72, 3, (b) => ({
    nombre: b === 'P' ? 'Caso Montoro' : 'La «fontanera» de Ferraz',
    texto: `Retira 1 presencia ${RIVAL_ADJ[b]} en 3 provincias que controle ${RIVAL_TXT[b]}. El Clima baja 1.`,
    contexto: b === 'P'
      ? 'Un juez investiga al exministro de Hacienda Cristóbal Montoro por presuntamente favorecer con leyes a medida a gasistas que pagaban a su antiguo despacho.'
      : 'Los audios de Leire Díez, que se presentaba como mano derecha de Santos Cerdán, buscando información contra un mando de la UCO, están en los juzgados. Ella niega haber actuado por encargo del PSOE.',
    escena: b === 'P'
      ? 'Una calculadora azul sobre un expediente de Hacienda, con bombonas de gas industrial al fondo y un foco rojo'
      : 'Una caja de herramientas de fontanero roja abierta, con cintas de casete y unos auriculares, bajo una luz azul',
    efectos: [retirar(3, { controla: 'rival' }, 1), clima(-1)],
  }), { noticia: true }),

  ...espejo(63, 73, 2, (b) => ({
    nombre: b === 'P' ? 'Marcha por la vivienda' : 'Tractorada en Madrid',
    texto: b === 'P'
      ? 'Coloca 1 presencia en 3 de estas provincias: Madrid, Barcelona, Valencia, Málaga, Sevilla o Baleares. El medidor de Frente Amplio sube 1.'
      : 'Coloca 1 presencia en 3 provincias de Interior. El medidor de Vox sube 1.',
    contexto: b === 'P'
      ? 'Los sindicatos de inquilinos llenan las calles: la vivienda es la primera preocupación de los españoles.'
      : 'En febrero, cientos de tractores recorrieron Madrid de Colón al Ministerio de Agricultura contra el acuerdo con Mercosur y la nueva PAC.',
    escena: b === 'P'
      ? 'Una multitud con llaves en alto avanzando por una gran avenida, vista desde una azotea, con pancartas lisas rojas'
      : 'Una columna de tractores por una gran avenida de una capital al amanecer, con banderolas lisas azules',
    efectos: b === 'P' ? [colocar(3, { provs: URBANAS }, 1), socio('P', 1)] : [colocar(3, { zonas: ['INT'] }, 1), socio('C', 1)],
  }), { noticia: true }),

  // —— Neutrales ——
  { id: 56, nombre: 'Torre Pacheco', ops: 3, lado: 'N', retirar: true, noticia: true,
    texto: 'Se retira toda la presencia de Murcia, el medidor de Vox sube 1 y el Clima baja 1. Tira un dado: con 1-3 el Progresista coloca 2 presencia en Murcia; con 4-6, el Conservador.',
    contexto: 'En julio de 2025, tras la agresión a un vecino de 68 años, el pueblo murciano vivió varias noches de disturbios contra vecinos de origen magrebí.',
    escena: 'Una calle de pueblo de noche con contenedores volcados, humo y destellos de sirenas, sin personas reconocibles',
    efectos: [{ e: 'retirarTodo', provs: ['30'] }, socio('C', 1), clima(-1), { e: 'dado', tabla: [
      { hasta: 3, efectos: [como('P', [colocar(2, { provs: ['30'] })])] },
      { hasta: 6, efectos: [como('C', [colocar(2, { provs: ['30'] })])] },
    ] }] },
  { id: 57, nombre: 'La Vuelta, sin podio', ops: 2, lado: 'N', noticia: true,
    texto: 'Las protestas propalestinas paran la carrera: los medidores de Frente Amplio y de Vox suben 1 y el Clima baja 1. Quien controle Madrid gana 1 PV.',
    contexto: 'El 14 de septiembre de 2025 las protestas contra el equipo israelí obligaron a suspender en Madrid la última etapa de La Vuelta.',
    escena: 'Bicicletas de carretera detenidas ante una pancarta lisa tendida en una carretera de sierra, con banderines dorados',
    efectos: [socio('P', 1), socio('C', 1), clima(-1), { e: 'alQueControlaMas', provs: ['28'], efectos: [pv(1)] }] },
  { id: 58, nombre: 'La flotilla a Gaza', ops: 2, lado: 'N', noticia: true,
    texto: 'La izquierda se moviliza: el medidor de Frente Amplio sube 1, Podemos gana 1 de fuerza y el Progresista coloca 1 presencia en Barcelona. El Conservador lo tacha de postureo y gana 1 PV.',
    contexto: 'En octubre de 2025 Israel interceptó la Global Sumud Flotilla; Ada Colau, hoy candidata de Frente Amplio, fue detenida a bordo.',
    escena: 'Una flotilla de pequeños veleros en alta mar de noche, con los focos de buques grises a lo lejos',
    efectos: [socio('P', 1), podemos(1, 0), como('P', [colocar(1, { provs: ['08'] })]), como('C', [pv(1)])] },
  { id: 59, nombre: 'Incendios del verano', ops: 3, lado: 'N', retirar: true, noticia: true,
    texto: 'Cada bloque pierde 1 presencia en 3 provincias de Interior o la Cornisa Norte. Tira un dado: con 1-3 se culpa al Gobierno y el Conservador gana 2 PV; con 4-6 se culpa a las comunidades y el Progresista gana 2 PV.',
    contexto: 'En agosto de 2025 ardieron más de 400.000 hectáreas; el Gobierno y las comunidades del PP se acusaron mutuamente de llegar tarde.',
    escena: 'Una ladera de monte ardiendo de noche con un hidroavión dorado soltando agua',
    efectos: [{ e: 'retirar', n: 3, maxPor: 1, de: 'ambos', filtro: { zonas: ['INT', 'NOR'] } }, { e: 'dado', tabla: [
      { hasta: 3, efectos: [como('C', [pv(2)])] },
      { hasta: 6, efectos: [como('P', [pv(2)])] },
    ] }] },
  { id: 41, nombre: 'Gurú de campaña', ops: 1, lado: 'N', retirar: true,
    texto: 'Fichas a un estratega: avanza 1 casilla en la Carrera Programática sin tirar.',
    contexto: 'Los consultores que han ganado elecciones cotizan al alza.',
    escena: 'Una silueta con gafas frente a una pizarra llena de flechas y diagramas abstractos, luz dorada',
    efectos: [{ e: 'carrera', n: 1 }] },
  { id: 42, nombre: 'El debate de las redes', ops: 2, lado: 'N',
    texto: 'Retas al rival a un debate en redes. Si acepta, cada uno tira un dado (tú sumas 2) y el ganador se lleva 2 PV. Si lo boicotea, el Clima baja 1 por su culpa y tú haces 4 PC de operaciones.',
    contexto: 'Un cara a cara retransmitido en directo en las redes sociales.',
    escena: 'Dos atriles vacíos frente a una pared de pantallas de móvil encendidas, luz dorada',
    efectos: [{ e: 'olimpiadas' }] },
  { id: 43, nombre: 'Junta Electoral Central', ops: 1, lado: 'N', requisito: { c: 'tengoCartaRival' },
    texto: 'Elige una carta de tu mano con evento del rival o de Podemos: usas sus PC sin que se active su evento. Jugada como evento en la ronda siguiente a una denuncia del rival, la anula. No puede ser Portada.',
    contexto: 'El árbitro de las elecciones resuelve recursos y quejas a diario.',
    escena: 'Una balanza dorada sobre una mesa de madera con sobres electorales y un mazo de juez',
    efectos: [{ e: 'juntaElectoral' }] },
  { id: 44, nombre: 'Campaña de desprestigio', ops: 4, lado: 'N',
    texto: 'Hasta el final de la semana, las operaciones del rival valen 1 PC menos (mín. 1).',
    contexto: 'Una campaña de anuncios negativos centrada en el adversario.',
    escena: 'Un megáfono dorado proyectando sombras negras sobre una pared de carteles arrancados',
    efectos: [activar('menosOpsRival', 'turno')] },
  { id: 45, nombre: 'Pacto de no agresión', ops: 4, lado: 'N',
    texto: 'Ganas tantos PV como el Clima menos 2. Después el Clima sube 2.',
    contexto: 'Los jefes de campaña firman un compromiso de juego limpio.',
    escena: 'Dos manos anónimas, una roja y otra azul, estrechándose sobre un documento con lacre dorado',
    efectos: [{ e: 'pactoNoAgresion' }] },
  { id: 46, nombre: 'Pulso en Andalucía oriental', ops: 2, lado: 'N', batalla: true,
    texto: 'Batalla en Granada, Jaén o Almería, donde haya presencia rival: tira un dado y resta 1 por cada vecina que controle el rival. Con 4 o más, su presencia allí pasa a ser tuya y ganas 2 PV. Suma 2 a tu Exigencia.',
    contexto: 'Tres provincias que pueden cambiar de manos por un puñado de votos.',
    escena: 'Tres colinas de olivos con banderas lisas roja y azul disputándose las cumbres al amanecer',
    efectos: [{ e: 'batalla', filtro: { provs: ['18', '23', '04'] } }] },
  { id: 47, nombre: 'La DANA, en el foco', ops: 3, lado: 'N', retirar: true, noticia: true,
    texto: 'Se retira toda la presencia de Valencia. Tira un dado: con 1-3 el Progresista coloca 2 presencia allí; con 4-6, el Conservador.',
    contexto: 'La riada del 29 de octubre de 2024 dejó más de doscientos muertos en Valencia. El president Mazón dimitió un año después.',
    escena: 'Un barrio embarrado tras una riada, con voluntarios anónimos con escobas y cubos al amanecer, luz dorada que asoma entre nubes',
    efectos: [{ e: 'retirarTodo', provs: ['46'] }, { e: 'dado', tabla: [
      { hasta: 3, efectos: [como('P', [colocar(2, { provs: ['46'] })])] },
      { hasta: 6, efectos: [como('C', [colocar(2, { provs: ['46'] })])] },
    ] }] },
  { id: 48, nombre: 'El apagón', ops: 2, lado: 'N', retirar: true, noticia: true,
    texto: 'Tira un dado: con 1-3 se culpa al Gobierno y el Conservador gana 2 PV; con 4-6 la respuesta convence y el Progresista gana 2 PV.',
    contexto: 'El 28 de abril de 2025 la península se quedó a oscuras durante horas. ¿Quién responde?',
    escena: 'Una ciudad a oscuras vista de noche, con una sola vela encendida en una ventana',
    efectos: [{ e: 'dado', tabla: [
      { hasta: 3, efectos: [como('C', [pv(2)])] },
      { hasta: 6, efectos: [como('P', [pv(2)])] },
    ] }] },
  { id: 49, nombre: 'Bulo viral', ops: 2, lado: 'N',
    texto: 'Retira 2 presencia rival (máx. 1 por provincia). El Clima baja 1.',
    contexto: 'Un vídeo manipulado corre por las redes antes de ser desmentido.',
    escena: 'Un teléfono móvil del que brota una nube de papelitos negros que oscurece el cielo',
    efectos: [retirar(2, undefined, 1), clima(-1)] },
  { id: 50, nombre: 'Trump amenaza con aranceles', ops: 2, lado: 'N', noticia: true,
    texto: 'Efecto bandera: el Progresista, que gobierna, gana 1 PV. El campo exportador protesta: el Conservador coloca 2 presencia en Interior o Levante y Baleares (máx. 1 por provincia).',
    contexto: 'Trump amenazó con castigar a España con aranceles por negarse al 5% de gasto en defensa que pedía la OTAN.',
    escena: 'Contenedores de mercancías apilados en un puerto con cajas de naranjas y de aceite, y una barrera de aduana dorada',
    efectos: [como('P', [pv(1)]), como('C', [colocar(2, { zonas: ['INT', 'LEV'] }, 1)])] },
  { id: 51, nombre: 'Mitin multitudinario', ops: 3, lado: 'N',
    texto: 'Coloca 3 presencia en una sola provincia clave donde ya tengas presencia.',
    contexto: 'Una plaza de toros llena y todas las televisiones conectadas.',
    escena: 'Una plaza de toros llena vista desde lo alto, con miles de luces de móviles y un escenario vacío iluminado',
    efectos: [colocar(3, { clave: true, conPresencia: 'yo' }, 3, true)] },
  { id: 52, nombre: 'Filtración del argumentario', ops: 1, lado: 'N',
    texto: 'Ves la mano del rival durante esta semana y ganas 1 PV.',
    contexto: 'El argumentario del rival aparece publicado en un digital.',
    escena: 'Un sobre abierto sobre una mesa del que salen volando hojas por una ventana',
    efectos: [{ e: 'verMano' }, pv(1)] },
  { id: 53, nombre: 'Voto por correo', ops: 2, lado: 'N',
    texto: 'Quien tenga menos presencia total en el mapa coloca 2 presencia (máx. 1 por provincia).',
    contexto: 'Colas en Correos: el voto anticipado se dispara.',
    escena: 'Una cola de siluetas con sobres frente a una oficina de correos al amanecer',
    efectos: [{ e: 'alQueMenosPresencia', efectos: [colocar(2, undefined, 1)] }] },
  { id: 54, nombre: 'Debate sobre la vivienda', ops: 2, lado: 'N',
    texto: 'Quien controle más provincias entre Madrid, Barcelona, Valencia, Málaga, Sevilla y Baleares gana 2 PV.',
    contexto: 'El precio del alquiler, en todos los debates.',
    escena: 'Una maqueta de ciudad con edificios de cartón de los que cuelgan llaves doradas',
    efectos: [{ e: 'alQueControlaMas', provs: URBANAS, efectos: [pv(2)] }] },
  { id: 55, nombre: 'Entrevista en prime time', ops: 1, lado: 'N',
    texto: 'Ganas 1 PV y colocas 1 presencia en cualquier provincia.',
    contexto: 'Un programa de entretenimiento con millones de espectadores.',
    escena: 'Un plató de televisión con dos sillones vacíos, focos dorados y una cámara en primer plano',
    efectos: [pv(1), colocar(1)] },

  // —— Comodines de Podemos ——
  { id: 401, nombre: 'Podemos rompe la baraja', ops: 3, lado: 'W',
    texto: 'Podemos endurece sus condiciones: gana 1 de fuerza y su humor empeora 1. Planta un marcador morado en la provincia más grande que controle quien lidera la Ventaja.',
    contexto: 'Ni con el PSOE ni contra él: con sus propias condiciones.',
    escena: 'Una baraja de cartas moradas lanzada al aire sobre una mesa de negociación, con las cartas rojas y azules desordenadas',
    efectos: [podemos(1, -1), { e: 'moradoAuto', n: 1, de: 'lider' }] },
  { id: 402, nombre: 'Movilización en la calle', ops: 2, lado: 'W',
    texto: 'Podemos llena las calles de Madrid y Barcelona: gana 1 de fuerza y cada bloque pierde 1 presencia en Madrid y otra en Barcelona.',
    contexto: 'Una manifestación que nadie controla.',
    escena: 'Una gran avenida llena de una multitud con pancartas lisas moradas, vista desde una azotea al atardecer',
    efectos: [podemos(1, 0), { e: 'retirar', n: 2, maxPor: 1, de: 'ambos', filtro: { provs: ['28', '08'] } }] },
  { id: 403, nombre: 'Ultimátum al PSOE', ops: 2, lado: 'W',
    texto: 'Podemos exige compromisos por escrito. El Progresista elige: ceder (el Conservador gana 2 PV) o plantarse (el humor de Podemos empeora 2).',
    contexto: '«Sin vivienda pública no hay investidura».',
    escena: 'Un reloj de arena morado sobre una carta lacrada dirigida a una puerta roja cerrada',
    efectos: [como('P', [elegir([
      ['Ceder a Podemos: el Conservador gana 2 PV', [pv(-2)]],
      ['Plantarse: el humor de Podemos empeora 2', [podemos(0, -2)]],
    ])])] },
  { id: 404, nombre: 'Podemos señala a la derecha', ops: 2, lado: 'W',
    texto: 'Podemos centra su campaña contra el PP y Vox. El Conservador elige: responder (el medidor de Vox sube 2 con la polarización) o ignorarlo (el Progresista gana 2 PV).',
    contexto: '«El peligro es un Gobierno del PP con Vox».',
    escena: 'Un foco morado apuntando a una puerta azul cerrada en un callejón, con sombras alargadas',
    efectos: [como('C', [elegir([
      ['Responder: el medidor de Vox sube 2', [socio('C', 2)]],
      ['Ignorarlo: el Progresista gana 2 PV', [pv(-2)]],
    ])])] },
];

// ———————————————————————————————————————————————————————— MAZO II · CAMPAÑA (entra en la semana 4)
const MAZO_2: Def[] = [
  encuesta(105, 'INT', 'Encuesta: Interior', 'Castilla y León, Aragón y La Rioja: provincias pequeñas donde cada escaño se decide por pocos votos.',
    'Un gráfico de barras gigante levantado entre campos de cereal y un castillo en una loma'),
  encuesta(106, 'NOR', 'Encuesta: Cornisa Norte', 'Galicia, Asturias, Cantabria, País Vasco y Navarra.',
    'Un gráfico de barras gigante entre prados verdes y montañas con niebla, junto a un acantilado'),
  encuesta(107, 'CAN', 'Encuesta: Canarias, Ceuta y Melilla', 'Islas y ciudades autónomas.',
    'Un gráfico de barras gigante sobre una playa volcánica de arena negra con un faro'),
  { id: 108, nombre: 'Barómetro del CIS', ops: 0, lado: 'E',
    texto: 'Cada bando suma 1 por provincia clave que controle; la diferencia (máx. 3) va a la Ventaja. En la semana 8 no da PV.',
    contexto: 'La estimación oficial, siempre discutida.',
    escena: 'Un termómetro gigante de cristal con una columna de mercurio de colores frente a una fachada institucional genérica',
    efectos: [{ e: 'cis' }] },
  { id: 109, nombre: 'Encuesta: España vaciada', ops: 0, lado: 'E', retirar: true,
    texto: 'Cada bando gana 1 PV por cada provincia de 3 escaños o menos que controle (Soria y Teruel valen 2). Se retira tras jugarse. En la semana 8 no da PV.',
    contexto: 'Una docena de provincias que reparten muy pocos escaños, pero todos cuentan.',
    escena: 'Un gráfico de barras diminuto en mitad de una llanura inmensa con un pueblo deshabitado y un molino',
    efectos: [{ e: 'espanaVaciada' }] },

  ...espejo(201, 241, 4, (b) => ({
    nombre: b === 'P' ? 'Bloque de investidura' : 'Pacto autonómico',
    texto: b === 'P'
      ? 'Solo si ya se jugó «Fondos europeos» o «Frente autonómico». Desde ahora, el Conservador no puede lanzar ofensivas ni debates locales en las provincias que controles de Andalucía y la Cornisa Norte.'
      : 'Solo si ya se jugó «Fondos europeos» o «Frente autonómico». Desde ahora, el Progresista no puede lanzar ofensivas ni debates locales en las provincias que controles de Madrid y Centro y de Levante y Baleares.',
    contexto: b === 'P' ? 'Los socios de la investidura cierran filas en sus territorios.' : 'Los gobiernos autonómicos del PP cierran filas en sus territorios.',
    escena: `Un escudo de piezas ${col(b, 'as')} encajadas como un puzle, protegiendo un mapa en relieve`,
    requisito: { c: 'bandera', k: 'bloques' },
    efectos: [activar('protegeZonas', 'partida', { zonas: b === 'P' ? ['AND', 'NOR'] : ['MAD', 'LEV'] })],
  }), { retirar: true }),

  ...espejo(202, 242, 2, (b) => ({
    nombre: b === 'P' ? 'Militancia puerta a puerta' : 'Afiliados puerta a puerta',
    texto: 'Coloca 1 presencia en 3 provincias donde ya tengas presencia.',
    contexto: b === 'P' ? 'La militancia socialista recorre los barrios casa por casa.' : 'Los afiliados populares recorren los barrios casa por casa.',
    escena: `Una escalera de vecinos con puertas entreabiertas y folletos ${col(b, 'os')} asomando bajo cada felpudo`,
    efectos: [colocar(3, { conPresencia: 'yo' }, 1)],
  })),

  ...espejo(203, 243, 3, (b) => ({
    nombre: b === 'P' ? 'Guerra interna en la oposición' : 'Guerra interna en el Gobierno',
    texto: `${b === 'P' ? 'El Conservador' : 'El Progresista'} queda atascado: en cada una de sus rondas debe descartar una carta de 2 o más PC (sin efecto) y tirar un dado; con 1-4 sale del atasco.`,
    contexto: b === 'P' ? 'Las tensiones entre el PP y Vox paralizan a la oposición.' : 'Las tensiones entre los socios paralizan al Gobierno.',
    escena: `Un laberinto de setos donde dos figuras ${b === 'P' ? 'azules' : 'rojas'} tiran de una misma cuerda en direcciones opuestas`,
    efectos: [activar('atasco', 'partida')],
  }), { retirar: true }),

  ...espejo(204, 244, 2, (b) => ({
    nombre: b === 'P' ? 'Campaña limpia' : 'Campaña en positivo',
    texto: 'Hasta el final de la semana, tus ofensivas en provincias clave no bajan el Clima.',
    contexto: b === 'P' ? 'El Progresista promete no entrar en el barro.' : 'El Conservador promete hablar solo de propuestas.',
    escena: `Un cartel electoral en blanco recién pegado en una pared limpia, con un cubo de cola y una brocha ${col(b, 'a')}`,
    efectos: [activar('campanaLimpia', 'turno')],
  })),

  ...espejo(205, 245, 1, (b) => ({
    nombre: b === 'P' ? 'Cara a cara en la radio pública' : 'Cara a cara en la radio privada',
    texto: `Si controlas más provincias clave que ${RIVAL_TXT[b]}, ganas 2 PV.`,
    contexto: 'Los números dos de cada lista se miden en las ondas.',
    escena: `Un estudio de radio con dos micrófonos enfrentados y un piloto ${col(b, 'o')} de «en el aire» encendido`,
    efectos: [{ e: 'pvSiMasClaves', n: 2 }],
  })),

  ...espejo(206, 246, 4, (b) => ({
    nombre: b === 'P' ? 'Manifiesto de la cultura' : 'Manifiesto empresarial',
    texto: `Anula el «${b === 'P' ? 'Manifiesto empresarial' : 'Manifiesto de la cultura'}» si está en vigor. Desde ahora, cada vez que ${RIVAL_TXT[b]} juegue una carta de batalla (como evento o por sus PC), ganas 2 PV.`,
    contexto: b === 'P' ? 'Actores, músicos y escritores firman a favor del Gobierno.' : 'Empresarios y directivos firman a favor del cambio.',
    escena: `Una larga hoja con cientos de firmas a pluma ${col(b, 'a')} que se desenrolla sobre un escenario vacío`,
    efectos: [{ e: 'cancelarEfecto', tipo: 'manifiesto', de: 'rival' }, activar('manifiesto', 'partida')],
  }), { retirar: true }),

  ...espejo(207, 247, 3, (b) => ({
    nombre: b === 'P' ? 'Denuncia por propaganda autonómica' : 'Denuncia por propaganda del Gobierno',
    texto: `Presentas una denuncia: si ${RIVAL_TXT[b]} no juega la «Junta Electoral Central» como evento en su próxima ronda, ganas 3 PV al terminar esa ronda.`,
    contexto: b === 'P' ? 'El Gobierno denuncia el uso partidista de los medios autonómicos.' : 'La oposición denuncia el uso electoral de la publicidad institucional.',
    escena: `Un reloj de arena ${col(b, 'o')} sobre un expediente sellado en la mesa de un juzgado`,
    efectos: [activar('cuentaAtras', 'uso')],
  })),

  ...espejo(208, 248, 2, (b) => ({
    nombre: b === 'P' ? 'Guiño al centro' : 'Guiño a los moderados',
    texto: `Retira 2 presencia ${RIVAL_ADJ[b]} de una sola provincia clave. Habilita «${b === 'P' ? 'Gran acuerdo por la vivienda' : 'Gran acuerdo por la industria'}».`,
    contexto: b === 'P' ? 'El PSOE busca al votante de centro que dudó en 2023.' : 'El PP busca al socialista moderado desencantado.',
    escena: `Una mano ${col(b, 'a')} tendida hacia el centro de un tablero gris, con fichas grises que se acercan`,
    efectos: [retirar(2, { clave: true }, 2, true), bandera(b === 'P' ? 'guinoP' : 'guinoC')],
  })),

  ...espejo(209, 249, 3, (b) => ({
    nombre: b === 'P' ? 'Un barón rompe con Génova' : 'Un barón rompe con Ferraz',
    texto: b === 'P'
      ? 'El Conservador pierde toda su presencia en una provincia de 6 escaños o menos y el medidor de Vox sube 1.'
      : 'El Progresista pierde toda su presencia en una provincia de 6 escaños o menos y el medidor de Frente Amplio sube 1.',
    contexto: b === 'P' ? 'Un dirigente territorial popular se desmarca de la dirección nacional.' : 'Un dirigente territorial socialista se desmarca de la dirección federal.',
    escena: `Una pieza de ajedrez ${b === 'P' ? 'azul' : 'roja'} dando la espalda a su tablero y saliendo por el borde`,
    efectos: [{ e: 'retirarTodoN', n: 1, filtro: { maxEscanos: 6 } }, socio('rival', 1)],
  }), { retirar: true }),

  ...espejo(210, 250, 2, (b) => ({
    nombre: b === 'P' ? 'El voto útil vuelve a la izquierda' : 'El voto útil vuelve a la derecha',
    texto: `Si ${RIVAL_TXT[b]} tiene «El Voto Útil», pasa a ti boca abajo (podrás usarla la semana que viene). Si no, ganas 1 PV.`,
    contexto: 'El argumento del voto útil cambia de manos con cada encuesta.',
    escena: `Una papeleta dorada pasando de una mano ${b === 'P' ? 'azul' : 'roja'} a una mano ${col(b, 'a')} sobre una urna`,
    efectos: [{ e: 'votoUtilAMi' }],
  })),

  ...espejo(211, 251, 3, (b) => ({
    nombre: b === 'P' ? 'Las capitales progresistas' : 'Las capitales del cambio',
    texto: 'Ganas 1 PV por cada provincia clave que controles (máx. 3).',
    contexto: b === 'P' ? 'Las grandes ciudades donde gobierna la izquierda, en el escaparate.' : 'Las grandes ciudades donde gobierna la derecha, en el escaparate.',
    escena: `Un mapa nocturno donde se encienden luces ${col(b, 'as')} sobre las grandes ciudades, unidas por hilos de luz`,
    efectos: [{ e: 'pvPorControl', provs: CLAVES, max: 3 }],
  }), { retirar: true }),

  ...espejo(212, 252, 3, (b) => ({
    nombre: b === 'P' ? 'El tracking de Ferraz' : 'El tracking de Génova',
    texto: 'Descarta las cartas que quieras de tu mano (no Encuestas) y roba otras tantas.',
    contexto: 'El seguimiento diario obliga a replantear la campaña.',
    escena: `Un abanico de cartas ${col(b, 'as')} sobre una mesa junto a gráficas de seguimiento diario y una taza de café`,
    efectos: [{ e: 'redibujar' }],
  }), { retirar: true }),

  ...espejo(213, 253, 2, (b) => ({
    nombre: b === 'P' ? 'El PSOE andaluz quiere revancha' : 'Andalucía azul',
    texto: 'Coloca 3 presencia en Andalucía (máx. 2 por provincia).',
    contexto: b === 'P' ? 'Tras tocar suelo con 28 escaños en las andaluzas de mayo, el PSOE sale a recuperar su antiguo granero.' : 'Moreno ganó las andaluzas de mayo con 53 escaños, a dos de la mayoría absoluta.',
    escena: `Un patio andaluz encalado con macetas y un toldo ${col(b, 'o')} desplegándose al sol`,
    efectos: [colocar(3, { zonas: ['AND'] }, 2)],
  })),

  ...espejo(214, 254, 2, (b) => ({
    nombre: b === 'P' ? 'Ronda con los nacionalistas' : 'Ronda con los regionalistas',
    texto: 'Dos fuerzas regionales a tu elección se acercan 1 a ti, sin coste.',
    contexto: 'Cafés discretos pensando en el día después.',
    escena: `Una mesa redonda vista desde arriba con tazas de café de varios colores y una carpeta ${col(b, 'a')} en el centro`,
    efectos: [{ e: 'afinidadElegir', n: 1, veces: 2 }],
  })),

  ...espejo(215, 255, 2, (b) => ({
    nombre: b === 'P' ? 'Candidaturas de unidad local' : 'Candidaturas independientes afines',
    texto: 'Coloca 1 presencia en 3 provincias donde nadie tenga presencia.',
    contexto: 'Plataformas locales que se suman a una campaña nacional.',
    escena: `Tres sillas plegables ${col(b, 'as')} montadas en tres plazas de pueblo vacías`,
    efectos: [colocar(3, { vacia: true }, 1)],
  })),

  ...espejo(216, 256, 2, (b) => ({
    nombre: b === 'P' ? 'Fichaje independiente para el PSOE' : 'Fichaje independiente para el PP',
    texto: `Te llevas al azar una carta de la mano ${b === 'P' ? 'del Conservador' : 'del Progresista'}: puedes jugarla ahora como si fuera tuya o devolverla y hacer 2 PC de operaciones.`,
    contexto: 'Una figura independiente de prestigio se suma a las listas.',
    escena: `Una silueta con una maleta cruzando un puente de cuerda de una orilla ${b === 'P' ? 'azul' : 'roja'} a otra ${col(b, 'a')}`,
    efectos: [{ e: 'fichaje' }],
  })),

  ...espejo(217, 257, 2, (b) => ({
    nombre: b === 'P' ? 'La voz de los barrios' : 'La voz de los pueblos',
    texto: `Retira 4 presencia ${RIVAL_ADJ[b]} de provincias que no sean clave (máx. 2 por provincia).`,
    contexto: b === 'P' ? 'Las asociaciones vecinales toman la palabra.' : 'Las plataformas del mundo rural toman la palabra.',
    escena: b === 'P'
      ? 'Un altavoz rojo en el balcón de un barrio obrero con ropa tendida'
      : 'Un altavoz azul en un poste de un pueblo de piedra, con campos al fondo',
    efectos: [retirar(4, { clave: false }, 2)],
  })),

  ...espejo(218, 258, 3, (b) => ({
    nombre: b === 'P' ? 'Mediación con los socios' : 'Mediación con los barones',
    texto: `En la próxima Encuesta de zona que se publique, ${RIVAL_TXT[b]} cuenta una provincia clave menos.`,
    contexto: 'Llamadas a medianoche para ordenar los mensajes territoriales.',
    escena: `Un teléfono de mesa ${col(b, 'o')} con el cable estirado hacia varias mesas en penumbra`,
    efectos: [activar('mediacion', 'uso')],
  })),

  ...espejo(219, 259, 2, (b) => ({
    nombre: b === 'P' ? 'Plaza fuerte progresista' : 'Plaza fuerte conservadora',
    texto: 'Elige una provincia no clave que controles: desde ahora cuenta como provincia clave para ti en las Encuestas mientras la controles.',
    contexto: 'Una provincia pequeña convertida en símbolo de la campaña.',
    escena: `Una torre de vigía ${col(b, 'a')} en lo alto de una colina sobre un pueblo pequeño`,
    efectos: [activar('plazaFuerte', 'partida', { elegirProv: { clave: false, controla: 'yo' } })],
  })),

  ...espejo(220, 260, 3, (b) => ({
    nombre: b === 'P' ? 'Red de alerta progresista' : 'Red de alerta conservadora',
    texto: `Desde ahora, si el Clima cae a 2 durante una ronda ${b === 'P' ? 'del Conservador' : 'del Progresista'}, colocas 1 presencia en una provincia donde ya tengas presencia.`,
    contexto: 'Una red de voluntarios preparada para responder a cualquier ataque.',
    escena: `Una red de antenas en colinas oscuras con luces ${col(b, 'as')} parpadeando de noche`,
    efectos: [activar('redAlerta', 'partida')],
  }), { retirar: true }),

  ...espejo(221, 261, 2, (b) => ({
    nombre: b === 'P' ? 'Tránsfuga hacia el PSOE' : 'Tránsfuga hacia el PP',
    texto: `Jugada por ti como Portada, anula la Portada ${b === 'P' ? 'del Conservador' : 'del Progresista'} (y no da PV). En cualquier otro momento, ganas 1 PV.`,
    contexto: 'Un cargo cambia de bando en plena campaña.',
    escena: `Una silueta en un pasillo de columnas que se quita un abrigo ${b === 'P' ? 'azul' : 'rojo'} y deja ver un forro ${col(b, 'o')}`,
    efectos: [pv(1)],
  }), { transfuga: true }),

  ...espejo(222, 262, 3, (b) => ({
    nombre: b === 'P' ? 'La hemeroteca de la Gürtel' : 'El fiscal general, condenado',
    texto: b === 'P'
      ? 'La sentencia que señaló al PP como partícipe a título lucrativo vuelve a los titulares: ganas 2 PV y el Clima baja 1.'
      : 'La condena del fiscal general nombrado por el Gobierno vuelve a los titulares: ganas 2 PV y el Clima baja 1.',
    contexto: b === 'P' ? 'En 2018 la Audiencia Nacional condenó al PP como partícipe a título lucrativo de la trama Gürtel; la sentencia desencadenó la moción de censura.' : 'En noviembre de 2025 el Supremo condenó al fiscal general del Estado a dos años de inhabilitación por revelación de secretos; dimitió días después.',
    escena: b === 'P'
      ? 'Una pila de periódicos viejos atados con cuerda junto a una lupa roja'
      : 'Un mazo de juez sobre un montón de sumarios atados con cintas azules',
    efectos: [pv(2), clima(-1)],
  }), { noticia: true }),

  ...espejo(223, 263, 2, (b) => ({
    nombre: b === 'P' ? 'Récord de afiliación' : 'La cesta de la compra',
    texto: 'Ganas 2 PV si el Clima está en 3 o más; si no, 1 PV.',
    contexto: b === 'P' ? 'La Seguridad Social encadena máximos de afiliados.' : 'Los precios de los alimentos siguen en la conversación.',
    escena: b === 'P'
      ? 'Un gráfico de barras hecho de edificios en obras con cascos rojos que crecen hacia el cielo'
      : 'Un carrito de la compra azul casi vacío con una etiqueta de precio enorme y sin números',
    efectos: [si({ c: 'climaMin', n: 3 }, [pv(2)], [pv(1)])],
  })),

  ...espejo(224, 264, 2, (b) => ({
    nombre: b === 'P' ? 'Reducción de jornada' : 'Bajada del IRPF',
    texto: b === 'P'
      ? 'Ganas 1 PV y colocas 1 presencia en 2 provincias de Andalucía o Cataluña.'
      : 'Ganas 1 PV y colocas 1 presencia en 2 provincias de Madrid y Centro o de Levante y Baleares.',
    contexto: b === 'P' ? 'La jornada de 37,5 horas, bandera laboral del Gobierno.' : 'Deflactar el IRPF, promesa central de la oposición.',
    escena: b === 'P'
      ? 'Un reloj de fichar con las agujas rojas adelantadas y la puerta de una fábrica abierta al sol'
      : 'Una nómina azul gigante con unas tijeras recortando una esquina',
    efectos: [pv(1), colocar(2, { zonas: b === 'P' ? ['AND', 'CAT'] : ['MAD', 'LEV'] }, 1)],
  })),

  ...espejo(225, 265, 3, (b) => ({
    nombre: b === 'P' ? 'Ministros en campaña' : 'Presidentes autonómicos en campaña',
    texto: 'Coloca 2 presencia en cualquier provincia. El Clima baja 1.',
    contexto: b === 'P' ? 'La agenda del Consejo de Ministros se llena de actos por toda España.' : 'Los presidentes autonómicos del PP recorren España con el candidato.',
    escena: `Una fila de coches oficiales negros con banderines ${col(b, 'os')} por una carretera de montaña`,
    efectos: [colocar(2), clima(-1)],
  })),

  ...espejo(226, 266, 3, (b) => ({
    nombre: b === 'P' ? 'El miedo a la mayoría PP-Vox' : 'El miedo a la reedición del Gobierno',
    texto: b === 'P'
      ? 'Si la proyección da al Conservador 176 apoyos o más, ganas 2 PV y el medidor de Frente Amplio baja 1. Si no, ganas 1 PV.'
      : 'Si la proyección da al Progresista 176 apoyos o más, ganas 2 PV y el medidor de Vox baja 1. Si no, ganas 1 PV.',
    contexto: b === 'P' ? 'La posibilidad de Vox en el Consejo de Ministros moviliza a la izquierda.' : 'La posibilidad de cuatro años más del mismo Gobierno moviliza a la derecha.',
    escena: `Un hemiciclo vacío visto desde arriba con escaños ${b === 'P' ? 'azules' : 'rojos'} que se encienden uno a uno, en un ambiente inquietante`,
    efectos: [si({ c: 'mayoriaRival' }, [pv(2), socio('yo', -1)], [pv(1)])],
  }), { retirar: true }),

  ...espejo(227, 267, 3, (b) => ({
    nombre: b === 'P' ? 'La campaña del PSC' : 'Galicia, tierra del candidato',
    texto: b === 'P' ? 'Coloca 3 presencia en Cataluña (máx. 2 por provincia).' : 'Coloca 3 presencia en Galicia (máx. 2 por provincia).',
    contexto: b === 'P' ? 'El socialismo catalán, primera fuerza en el Parlament.' : 'El candidato del PP gobernó la Xunta con cuatro mayorías absolutas.',
    escena: b === 'P'
      ? 'Un paseo marítimo mediterráneo al anochecer con farolillos rojos'
      : 'Un hórreo gallego bajo la lluvia con una bufanda azul colgada',
    efectos: [colocar(3, b === 'P' ? { zonas: ['CAT'] } : { provs: GALICIA }, 2)],
  })),

  // —— Noticias reales, también en espejo ——
  ...espejo(228, 268, 2, (b) => ({
    nombre: b === 'P' ? 'El novio de Ayuso' : 'Begoña Gómez, al banquillo',
    texto: `Ganas 1 PV y, hasta el final de la semana, las operaciones ${b === 'P' ? 'del Conservador' : 'del Progresista'} valen 1 PC menos (mín. 1).`,
    contexto: b === 'P'
      ? 'La pareja de la presidenta madrileña espera juicio por un presunto fraude fiscal de 350.000 euros.'
      : 'En septiembre el juez Peinado envió a juicio con jurado a la esposa del presidente por malversación y tráfico de influencias. La Fiscalía había pedido el archivo.',
    escena: b === 'P'
      ? 'Un ático con terraza sobre una gran ciudad, con un sobre oficial azul abierto en la mesa y una luz roja'
      : 'Un banquillo vacío en una sala de tribunal con nueve sillas de jurado, bajo una luz azul',
    efectos: [pv(1), activar('menosOpsRival', 'turno')],
  }), { noticia: true }),

  ...espejo(229, 269, 2, (b) => ({
    nombre: b === 'P' ? 'Las fotos del yate' : 'El Delcygate',
    texto: `Ganas 1 PV y retiras 2 presencia ${RIVAL_ADJ[b]} de una sola provincia clave que controle ${RIVAL_TXT[b]}. El Clima baja 1.`,
    contexto: b === 'P'
      ? 'Vuelven a circular las fotos de los años noventa del candidato del PP con Marcial Dorado, condenado después por narcotráfico. Él siempre ha dicho que desconocía sus actividades.'
      : 'La madrugada de enero de 2020 en que el entonces ministro Ábalos recibió en Barajas a la vicepresidenta venezolana, que tenía prohibida la entrada en la UE.',
    escena: b === 'P'
      ? 'Una vieja fotografía de bordes blancos de un yate en una ría gallega, sin personas, con una lupa roja encima'
      : 'Una pista de aeropuerto de noche con un avión privado y unas maletas al pie de la escalerilla, bajo una luz azul',
    efectos: [pv(1), retirar(2, { clave: true, controla: 'rival' }, 2, true), clima(-1)],
  }), { noticia: true }),

  ...espejo(230, 270, 2, (b) => ({
    nombre: b === 'P' ? 'Regularización extraordinaria' : 'Prioridad nacional',
    texto: b === 'P'
      ? 'Ganas 1 PV, el humor de Podemos mejora 1 y el medidor de Vox sube 1.'
      : 'Ganas 1 PV y colocas 1 presencia en 2 provincias de Levante y Baleares o de Andalucía.',
    contexto: b === 'P'
      ? 'El real decreto de abril, pactado con Podemos, abrió la regularización de unas 500.000 personas que ya vivían en España.'
      : 'Vox exige al PP la «prioridad nacional» en el acceso a las ayudas como condición para sus pactos autonómicos.',
    escena: b === 'P'
      ? 'Una cola de sobres oficiales que se convierten en llaves al pasar por una ventanilla, con luz roja'
      : 'Una ventanilla administrativa con una flecha azul pintada en el suelo y una fila de sillas vacías',
    efectos: b === 'P' ? [pv(1), podemos(0, 1), socio('C', 1)] : [pv(1), colocar(2, { zonas: ['LEV', 'AND'] }, 1)],
  }), { noticia: true }),

  ...espejo(231, 271, 2, (b) => ({
    nombre: b === 'P' ? 'Revuelta y el dinero de la DANA' : 'La sombra de los ERE',
    texto: b === 'P'
      ? 'Ganas 1 PV y retiras 2 presencia conservadora en Levante y Baleares (máx. 1 por provincia).'
      : 'Ganas 1 PV y retiras 2 presencia progresista en Andalucía (máx. 1 por provincia).',
    contexto: b === 'P'
      ? 'Exdirigentes de Revuelta, la asociación juvenil del entorno de Vox, denunciaron ante la Fiscalía el destino de las donaciones para la DANA. Vox se desvinculó y también denunció.'
      : 'La oposición rescata los ERE, la mayor causa de corrupción de la Junta socialista, aunque el Constitucional anuló en 2024 parte de las condenas.',
    escena: b === 'P'
      ? 'Una hucha de donativos rota sobre el barro, con monedas azules dispersas'
      : 'Archivadores verdes y blancos amontonados en un sótano, con una lámpara roja colgando',
    efectos: [pv(1), retirar(2, { zonas: [b === 'P' ? 'LEV' : 'AND'] }, 1)],
  }), { noticia: true }),

  // La pinza: la vía difícil para que Podemos apoye al bloque conservador, y su antídoto
  ...espejo(232, 272, 2, (b) => ({
    nombre: b === 'P' ? 'El decreto, otra vez' : 'La pinza',
    texto: b === 'P'
      ? 'La pinza de Podemos con la derecha retrocede 1 y su humor mejora 1.'
      : 'Si Podemos está en ruptura con el PSOE (humor −2 o menos), la pinza avanza 1. Si no, su humor empeora 1.',
    contexto: b === 'P'
      ? 'En junio de 2024 Podemos apoyó la segunda versión del decreto del subsidio de desempleo que había tumbado en enero.'
      : 'Como la «pinza» de Anguita y Aznar contra González en los noventa. En enero de 2024 los cinco diputados de Podemos tumbaron, junto a PP, Vox y UPN, el decreto del subsidio de desempleo.',
    escena: b === 'P'
      ? 'Una mano roja que separa con cuidado las dos patas de unas tenazas, una morada y otra azul'
      : 'Unas tenazas con una pata morada y otra azul que se cierran sobre una rosa roja de papel',
    efectos: b === 'P' ? [podemos(0, 1, -1)] : [si({ c: 'humorPodemosMax', n: -2 }, [podemos(0, 0, 1)], [podemos(0, -1)])],
  }), { noticia: true }),

  // —— Neutrales ——
  { id: 276, nombre: 'Vito Quiles, micrófono en mano', ops: 2, lado: 'N', noticia: true,
    texto: 'Un agitador digital acorrala a ministros por los pasillos: el Conservador retira 2 presencia progresista de provincias clave (máx. 1 por provincia), el medidor de Vox sube 1 y el Clima baja 1.',
    contexto: 'El Congreso le retiró definitivamente la acreditación de prensa en septiembre por grabar en zonas restringidas e interrumpir ruedas de prensa.',
    escena: 'Un micrófono y un móvil grabando que persiguen una sombra alargada por un pasillo de columnas',
    efectos: [como('C', [retirar(2, { clave: true }, 1)]), socio('C', 1), clima(-1)] },
  { id: 277, nombre: 'Huelga de médicos', ops: 2, lado: 'N', noticia: true,
    texto: 'Los médicos paran contra el Estatuto Marco del Gobierno, pero también en los hospitales de las comunidades: el Conservador gana 1 PV y el Progresista retira 2 presencia conservadora de provincias clave (máx. 1 por provincia).',
    contexto: 'Los sindicatos médicos paran una semana al mes contra el Estatuto Marco y piden la dimisión de la ministra de Sanidad, de Más Madrid.',
    escena: 'Batas blancas colgadas vacías a lo largo del pasillo de un hospital, con un reloj dorado al fondo',
    efectos: [como('C', [pv(1)]), como('P', [retirar(2, { clave: true }, 1)])] },
  { id: 278, nombre: 'España se baja de Eurovisión', ops: 1, lado: 'N', noticia: true,
    texto: 'La retirada divide a la audiencia: los medidores de Frente Amplio y de Vox suben 1. Después, cada bando tira un dado y el mayor gana 1 PV.',
    contexto: 'RTVE decidió no participar en Eurovisión 2026 ni emitirlo por la presencia de Israel; el Gobierno lo aplaudió.',
    escena: 'Un gran escenario de festival con un micrófono solitario y los focos apagados',
    efectos: [socio('P', 1), socio('C', 1), { e: 'duelo', pv: 1 }] },
  { id: 281, nombre: 'Batalla por una provincia bisagra', ops: 3, lado: 'N', batalla: true,
    texto: 'Batalla en una provincia de Fidelidad 2 o menos con presencia rival: tira un dado y resta 1 por cada vecina que controle el rival. Con 4 o más, su presencia allí pasa a ser tuya y ganas 2 PV. Suma 2 a tu Exigencia.',
    contexto: 'Una provincia donde el último escaño baila por unos cientos de votos.',
    escena: 'Un tablero de ajedrez sobre un campo de girasoles con dos peones, rojo y azul, frente a frente',
    efectos: [{ e: 'batalla', filtro: { maxFidelidad: 2 } }] },
  { id: 282, nombre: 'Guerra de anuncios', ops: 3, lado: 'N',
    texto: 'Si esta semana llevas más PC de ofensiva que el rival, ganas 1 PV; 3 PV si además ya cubres la Exigencia de las bases.',
    contexto: 'La batalla de las vallas y los anuncios en las redes.',
    escena: 'Dos vallas publicitarias gigantes en blanco enfrentadas en una autopista de noche, con focos dorados',
    efectos: [si({ c: 'exigenciaMas' }, [si({ c: 'exigenciaCumplida' }, [pv(3)], [pv(1)])])] },
  { id: 283, nombre: 'Crisis institucional', ops: 3, lado: 'N', retirar: true,
    texto: 'El Clima pasa a 2. Si el rival lanza una ofensiva esta semana, pierde la partida. Puede desactivarlo al empezar una de sus rondas retirando 2 de su presencia en Madrid o en Barcelona.',
    contexto: 'Un choque entre instituciones del Estado en plena campaña.',
    escena: 'Un salón de plenos vacío con las luces de emergencia encendidas y una grieta dorada en el suelo',
    efectos: [{ e: 'crisisInstitucional' }] },
  { id: 284, nombre: 'Pacto de caballeros', ops: 3, lado: 'N', retirar: true,
    texto: 'El Clima sube 2. Hasta el final de la semana, todas las ofensivas tienen −1. Recuperas a tu mano una carta del descarte (no una Encuesta).',
    contexto: 'Los dos grandes partidos acuerdan rebajar el tono.',
    escena: 'Dos sombreros, uno rojo y otro azul, colgados del mismo perchero en un despacho de madera',
    efectos: [clima(2), activar('tregua', 'turno'), { e: 'recuperar', jugar: false }] },
  { id: 285, nombre: 'Cumbre de presidentes autonómicos', ops: 1, lado: 'N',
    texto: 'Cada bloque tira un dado y suma las zonas que domina o controla. El ganador se lleva 2 PV y puede subir o bajar el Clima 1.',
    contexto: 'La Conferencia de Presidentes, convertida en escenario de campaña.',
    escena: 'Una mesa en herradura con atriles dorados vacíos y micrófonos, vista de lado',
    efectos: [{ e: 'cumbre' }] },
  { id: 286, nombre: 'Doctrina de la tensión', ops: 2, lado: 'N', retirar: true,
    texto: 'Fijas el Clima en el nivel que quieras (de 2 a 5) y sumas 5 a tu Exigencia de esta semana.',
    contexto: '«Nos conviene que haya tensión», dice el manual de campaña.',
    escena: 'Una mano anónima girando el dial dorado de un termostato con niveles de color',
    efectos: [{ e: 'fijarClima' }] },
  { id: 287, nombre: 'Golpe de mano en una diputación', ops: 2, lado: 'N',
    texto: 'Coloca 2 presencia en una sola provincia de 4 escaños o menos y lanza una ofensiva gratuita de 2 PC en una provincia de 4 escaños o menos.',
    contexto: 'Una diputación provincial cambia de manos en una noche.',
    escena: 'Un palacio provincial de piedra de noche con una única ventana iluminada y siluetas reunidas',
    efectos: [colocar(2, { maxEscanos: 4 }, 2, true), { e: 'ops', pc: 2, tipo: 'ofensiva', filtro: { maxEscanos: 4 } }] },
  { id: 288, nombre: 'Intercambio de argumentarios', ops: 2, lado: 'N',
    texto: 'El rival te entrega su carta de más PC (no Encuestas) y tú le das a cambio una de tu mano.',
    contexto: 'Las ideas del adversario, recicladas con otro envoltorio.',
    escena: 'Dos carpetas, una roja y otra azul, cruzándose en el aire sobre una mesa',
    efectos: [{ e: 'intercambio' }] },
  { id: 289, nombre: 'Fontanería electoral', ops: 2, lado: 'N',
    texto: 'Elige una zona: hasta el final de la semana, tus ofensivas allí tienen +1 y las del rival, −1.',
    contexto: 'Los aparatos de los partidos trabajan donde no llegan las cámaras.',
    escena: 'Tuberías doradas bajo el suelo de un mapa, con una llave inglesa girando una válvula',
    efectos: [activar('fontaneria', 'turno', { elegirZona: true })] },
  { id: 290, nombre: 'Remontada en la Carrera', ops: 2, lado: 'N',
    texto: 'Si vas por detrás en la Carrera Programática, avanzas 2 casillas (solo la segunda da PV).',
    contexto: 'Un programa presentado a toda prisa que sorprende a los analistas.',
    escena: 'Una corredora dorada adelantando en la última curva de una pista de atletismo vacía',
    efectos: [{ e: 'carreraSiDetras', n: 2 }] },
  { id: 291, nombre: 'Tregua en la campaña', ops: 4, lado: 'N',
    texto: 'El Clima sube 1 y haces 4 PC de operaciones.',
    contexto: 'Un acontecimiento grave obliga a suspender los actos durante un día.',
    escena: 'Una bandera blanca ondeando entre dos sedes de campaña enfrentadas al amanecer',
    efectos: [clima(1), { e: 'ops', pc: 4, tipo: 'cualquiera' }] },
  { id: 292, nombre: 'Tertulia radiofónica', ops: 1, lado: 'N',
    texto: 'Cada bando tira un dado; el mayor gana 1 PV (empate: nada).',
    contexto: 'Los portavoces se enzarzan en la radio de la mañana.',
    escena: 'Una mesa de radio con cinco micrófonos y tazas humeantes, luz dorada de primera hora',
    efectos: [{ e: 'duelo', pv: 1 }] },
  { id: 293, nombre: 'Encuestas contradictorias', ops: 2, lado: 'N',
    texto: 'Ganas 1 PV; 2 si la Ventaja te es contraria por 5 o más.',
    contexto: 'Cada encuesta cuenta una campaña distinta.',
    escena: 'Varios gráficos de tarta que no encajan entre sí apilados sobre una mesa, con una lupa dorada',
    efectos: [si({ c: 'rivalAventaja', n: 5 }, [pv(2)], [pv(1)])] },
  { id: 294, nombre: 'Abstención de castigo', ops: 2, lado: 'N',
    texto: 'Elige 3 provincias: en cada una, cada bando pierde 1 presencia (si la tiene).',
    contexto: 'El desencanto amenaza con quedarse en casa.',
    escena: 'Un colegio electoral vacío con urnas solitarias y sillas apiladas, luz fría por la ventana',
    efectos: [{ e: 'retirar', n: 3, maxPor: 1, de: 'ambos' }] },
  { id: 295, nombre: 'Fuga del voto nacionalista', ops: 2, lado: 'N',
    texto: 'Elige una fuerza nacionalista: pierde el 15% de su voto, que va a los grandes bloques, y colocas 1 presencia en su territorio.',
    contexto: 'El voto útil también funciona en Cataluña, Euskadi o Galicia.',
    escena: 'Un río que se bifurca hacia dos grandes embalses, uno rojo y otro azul, desde un valle verde',
    efectos: [{ e: 'fugaNacionalista', pct: 0.15 }] },
  { id: 296, nombre: 'Debate a siete en RTVE', ops: 2, lado: 'N',
    texto: 'Los socios ganan foco: los medidores de Vox y de Frente Amplio suben 1 y Podemos gana 1 de fuerza. Quien controle más provincias clave de Madrid y Centro gana 1 PV.',
    contexto: 'Como en 2023, RTVE sienta a los portavoces de siete partidos en el mismo plató.',
    escena: 'Siete atriles de colores en semicírculo en un plató, con focos dorados',
    efectos: [socio('P', 1), socio('C', 1), podemos(1, 0), { e: 'alQueControlaMas', provs: ['28', '45', '06'], efectos: [pv(1)] }] },
  { id: 297, nombre: 'Campaña en redes', ops: 2, lado: 'N',
    texto: 'Coloca 2 presencia en provincias de 8 o más escaños (máx. 1 por provincia).',
    contexto: 'Vídeos cortos para un electorado que ya no ve la tele.',
    escena: 'Un mosaico de pantallas de móvil verticales formando el mapa de una ciudad',
    efectos: [colocar(2, { minEscanos: 8 }, 1)] },
  { id: 298, nombre: 'Junts marca distancias', ops: 2, lado: 'N',
    texto: 'Junts se mueve 1 hacia la neutralidad y crece un 10% en Cataluña.',
    contexto: 'Junts rompió con el PSOE y vota caso a caso: ni con unos ni con otros.',
    escena: 'Una barca sola alejándose de dos muelles, uno rojo y otro azul, en una bahía mediterránea',
    efectos: [{ e: 'afinidadNeutral', partido: 'JUNTS' }, { e: 'regional', partido: 'JUNTS', pct: 0.1 }] },
  { id: 299, nombre: 'Cayucos rumbo a El Hierro', ops: 2, lado: 'N', noticia: true,
    texto: 'El medidor de Vox sube 1 y colocas 2 presencia en Canarias, Ceuta o Melilla (máx. 1 por provincia).',
    contexto: 'La ruta atlántica sigue llevando cayucos a Canarias y la acogida de menores migrantes enfrenta a las administraciones.',
    escena: 'Un faro iluminando el mar de noche frente a una costa volcánica, con un pequeño puerto',
    efectos: [socio('C', 1), colocar(2, { zonas: ['CAN'] }, 1)] },

  // —— Comodines de Podemos ——
  { id: 405, nombre: 'Vetos cruzados', ops: 2, lado: 'W',
    texto: 'Podemos y Frente Amplio se enzarzan: el medidor de Frente Amplio baja 1 y Podemos gana 1 de fuerza. El ruido en la izquierda también da alas a Vox (+1).',
    contexto: 'La izquierda del PSOE, otra vez dividida.',
    escena: 'Dos caminos morados que se cruzan y se bloquean con vallas en mitad de un campo',
    efectos: [socio('P', -1), podemos(1, 0), socio('C', 1)] },
  { id: 406, nombre: 'Podemos tiende la mano', ops: 2, lado: 'W',
    texto: 'El humor de Podemos mejora 2, pero pierde 1 de fuerza: parte de su electorado vuelve al PSOE.',
    contexto: 'Podemos pactó con el PSOE la regularización extraordinaria: «lo primero es que no gobiernen PP y Vox».',
    escena: 'Una mano morada abierta sobre una mesa de negociación vacía, con una silla roja enfrente',
    efectos: [podemos(-1, 2)] },
  { id: 407, nombre: 'Canal Red, a pleno rendimiento', ops: 3, lado: 'W',
    texto: 'Podemos dispara contra todos: el Clima baja 1 y cada bloque retira 2 presencia rival (máx. 1 por provincia), empezando por quien va por detrás en la Ventaja.',
    contexto: 'La televisión impulsada por Pablo Iglesias dispara contra «el bipartidismo», contra el PSOE y contra la derecha.',
    escena: 'Una tormenta de notificaciones moradas cayendo sobre dos sedes de campaña, una roja y otra azul',
    efectos: [clima(-1), { e: 'aCadaBloque', efectos: [retirar(2, undefined, 1)] }] },
  { id: 408, nombre: 'Asambleas moradas', ops: 2, lado: 'W',
    texto: 'Podemos gana 1 de fuerza y planta un marcador morado en la provincia más grande que controle cada bloque.',
    contexto: 'Círculos y asambleas vuelven a llenar los locales de barrio.',
    escena: 'Un círculo de sillas moradas en un local de barrio con las luces encendidas de noche',
    efectos: [podemos(1, 0), { e: 'moradoAuto', n: 1, de: 'ambos' }] },
];

// ———————————————————————————————————————————————————————— MAZO III · RECTA FINAL (entra en la semana 7)
const MAZO_3: Def[] = [
  ...espejo(301, 321, 3, (b) => ({
    nombre: b === 'P' ? 'Escándalo en una consejería' : 'Escándalo en un ministerio',
    texto: `${b === 'P' ? 'El Conservador' : 'El Progresista'} pierde toda su presencia en una provincia de 8 escaños o menos y tú colocas 2 allí.`,
    contexto: b === 'P' ? 'Un caso en un gobierno autonómico de la oposición salta a los titulares.' : 'Un caso en un departamento del Gobierno salta a los titulares.',
    escena: `Un archivador abierto del que salen volando expedientes ${b === 'P' ? 'azules' : 'rojos'} bajo un foco ${col(b, 'o')}`,
    efectos: [{ e: 'escandalo', filtro: { maxEscanos: 8 }, poner: 2 }],
  })),

  ...espejo(302, 322, 2, (b) => ({
    nombre: b === 'P' ? 'Giro social' : 'Giro al centro',
    texto: `Ganas 1 PV y colocas 1 presencia en 2 feudos ${b === 'P' ? 'del Conservador' : 'del Progresista'}.`,
    contexto: b === 'P' ? 'El PSOE sale a buscar votos en territorio conservador.' : 'El PP sale a buscar votos en territorio progresista.',
    escena: `Una flecha ${col(b, 'a')} pintada en el asfalto que gira hacia una calle ${b === 'P' ? 'azul' : 'roja'}`,
    efectos: [pv(1), colocar(2, { feudo: 'rival' }, 1)],
  })),

  ...espejo(303, 323, 4, (b) => ({
    nombre: b === 'P' ? 'Patinazo de la oposición en directo' : 'Patinazo del Gobierno en directo',
    texto: `Ganas 2 PV y el Clima baja 1. Si controlas más provincias clave que ${RIVAL_TXT[b]}, además haces 2 debates locales.`,
    contexto: 'Un error ante las cámaras que se repite en bucle todo el día.',
    escena: `Una piel de plátano en el suelo de un plató con focos y una cámara ${col(b, 'a')} grabando`,
    efectos: [pv(2), clima(-1), si({ c: 'masClaves' }, [{ e: 'ops', pc: 2, tipo: 'debate' }])],
  })),

  ...espejo(304, 324, 2, (b) => ({
    nombre: b === 'P' ? 'Big data progresista' : 'Big data conservador',
    texto: 'Solo si vas por delante en la Carrera Programática. Elige una carta del descarte (no Encuestas ni eventos del rival) y juega su evento.',
    contexto: 'Los modelos de microsegmentación encuentran a los indecisos.',
    escena: `Una nube de puntos de luz ${col(b, 'os')} formando la silueta de un mapa sobre un fondo oscuro`,
    requisito: { c: 'carreraDelante' },
    efectos: [{ e: 'recuperar', jugar: true }],
  }), { retirar: true }),

  ...espejo(305, 325, 3, (b) => ({
    nombre: b === 'P' ? 'Caravana del Gobierno' : 'Caravana del cambio',
    texto: 'Esta semana tienes una ronda de acción extra.',
    contexto: 'Una semana de campaña con tres mítines diarios.',
    escena: `Una caravana de furgonetas ${col(b, 'as')} cruzando un puente al amanecer, con el sol en el horizonte`,
    efectos: [{ e: 'rondaExtra' }],
  }), { retirar: true }),

  ...espejo(306, 326, 4, (b) => ({
    nombre: b === 'P' ? 'Campaña del optimismo' : 'Campaña de la esperanza',
    texto: 'El Clima sube 1 y ganas 2 PV.',
    contexto: b === 'P' ? 'El Gobierno apuesta por el balance y la economía.' : 'La oposición apuesta por un mensaje de ilusión.',
    escena: `Un amanecer luminoso sobre una ciudad con globos ${col(b, 'os')} elevándose`,
    efectos: [clima(1), pv(2)],
  }), { retirar: true }),

  ...espejo(307, 327, 2, (b) => ({
    nombre: b === 'P' ? 'Desembarco en un feudo azul' : 'Desembarco en un feudo rojo',
    texto: `${b === 'P' ? 'El Conservador' : 'El Progresista'} pierde toda su presencia en uno de sus feudos de 10 escaños o menos. Después lanzas una ofensiva gratuita de 2 PC.`,
    contexto: 'La campaña entra en el territorio más fiel del adversario.',
    escena: `Unas barcas ${col(b, 'as')} llegando a una playa ${b === 'P' ? 'azul' : 'roja'} al amanecer`,
    efectos: [{ e: 'retirarTodoN', n: 1, filtro: { feudo: 'rival', maxEscanos: 10 } }, { e: 'ops', pc: 2, tipo: 'ofensiva' }],
  })),

  ...espejo(308, 328, 2, (b) => ({
    nombre: b === 'P' ? 'Sombra de sospecha sobre la oposición' : 'Sombra de sospecha sobre el Gobierno',
    texto: `Hasta el final de la semana, los debates locales ${b === 'P' ? 'del Conservador' : 'del Progresista'} tienen −1.`,
    contexto: 'Una información sin confirmar que nadie consigue despejar.',
    escena: `Una sombra alargada cayendo sobre un atril ${b === 'P' ? 'azul' : 'rojo'} en un escenario vacío`,
    efectos: [activar('sombra', 'turno')],
  })),

  ...espejo(309, 329, 3, (b) => ({
    nombre: b === 'P' ? 'Cerrojo informativo progresista' : 'Cerrojo informativo conservador',
    texto: `Elige una zona: hasta el final de la semana, ${RIVAL_TXT[b]} no puede colocar presencia allí con operaciones.`,
    contexto: 'Los medios afines cierran filas en un territorio.',
    escena: `Un candado ${col(b, 'o')} gigante cerrando una antena de televisión sobre un mapa`,
    efectos: [activar('cerrojo', 'turno', { elegirZona: true })],
  })),

  ...espejo(310, 330, 2, (b) => ({
    nombre: b === 'P' ? 'Crisis de financiación autonómica' : 'Crisis de deuda del Gobierno',
    texto: `${b === 'P' ? 'El Conservador' : 'El Progresista'} debe descartar una carta de 3 o más PC; si no lo hace, duplicas tu presencia en 2 provincias de 6 escaños o menos.`,
    contexto: b === 'P' ? 'Las comunidades de la oposición reclaman más fondos.' : 'La oposición señala el déficit y la deuda pública.',
    escena: `Una balanza desequilibrada con monedas ${col(b, 'as')} amontonadas en uno de sus platos`,
    efectos: [{ e: 'duplicar', n: 2, filtro: { maxEscanos: 6 } }],
  })),

  ...espejo(311, 331, 3, (b) => ({
    nombre: b === 'P' ? 'Asalto a Madrid' : 'Asalto a Barcelona',
    texto: b === 'P'
      ? 'Coloca 3 presencia en Madrid y lanza una ofensiva gratuita de 3 PC en Madrid y Centro, aunque el Clima lo impida y sin que baje.'
      : 'Coloca 3 presencia en Barcelona y lanza una ofensiva gratuita de 3 PC en Cataluña, aunque el Clima lo impida y sin que baje.',
    contexto: b === 'P' ? 'El Gobierno se vuelca en la plaza de la oposición.' : 'La oposición se vuelca en la plaza del Gobierno.',
    escena: b === 'P'
      ? 'Una escalera roja apoyada en las murallas de una ciudad de la meseta, con banderolas rojas'
      : 'Una escalera azul apoyada en las murallas de una ciudad mediterránea, con banderolas azules',
    efectos: [colocar(3, { provs: [b === 'P' ? '28' : '08'] }), { e: 'ops', pc: 3, tipo: 'ofensiva', filtro: { zonas: [b === 'P' ? 'MAD' : 'CAT'] }, ignorarClima: true }],
  }), { retirar: true }),

  ...espejo(312, 332, 3, (b) => ({
    nombre: b === 'P' ? 'Topo en Génova' : 'Topo en Ferraz',
    texto: `Ves la mano ${b === 'P' ? 'del Conservador' : 'del Progresista'} y eliges una carta que debe descartar (no Encuestas).`,
    contexto: 'Alguien filtra los planes de campaña desde dentro.',
    escena: `Una silueta escondida tras una cortina ${b === 'P' ? 'azul' : 'roja'}, con un cuaderno ${col(b, 'o')} en la mano`,
    efectos: [{ e: 'topo' }],
  }), { retirar: true }),

  ...espejo(313, 333, 3, (b) => ({
    nombre: b === 'P' ? 'Ofensiva en el Levante' : 'Ofensiva en Cataluña',
    texto: b === 'P'
      ? 'Ganas 1 PV y retiras 3 presencia conservadora en Levante y Baleares (máx. 1 por provincia).'
      : 'Ganas 1 PV y retiras 3 presencia progresista en Cataluña (máx. 1 por provincia).',
    contexto: 'Una semana entera de campaña en el territorio del rival.',
    escena: b === 'P'
      ? 'Flechas rojas sobre un mapa en relieve de la costa levantina y las islas'
      : 'Flechas azules sobre un mapa en relieve de la costa catalana y el Pirineo',
    efectos: [pv(1), retirar(3, { zonas: [b === 'P' ? 'LEV' : 'CAT'] }, 1)],
  }), { retirar: true }),

  ...espejo(314, 334, 2, (b) => ({
    nombre: b === 'P' ? 'Gran acuerdo por la vivienda' : 'Gran acuerdo por la industria',
    texto: `Solo si jugaste «${b === 'P' ? 'Guiño al centro' : 'Guiño a los moderados'}». Coloca 3 presencia en una sola provincia clave.`,
    contexto: b === 'P' ? 'Sindicatos y constructoras firman un plan de vivienda pública.' : 'Patronal e industria firman un plan de reindustrialización.',
    escena: b === 'P'
      ? 'Un apretón de manos sobre los planos de un barrio de viviendas, con cascos rojos encima de la mesa'
      : 'Un apretón de manos sobre los planos de una fábrica, con cascos azules encima de la mesa',
    requisito: { c: 'bandera', k: b === 'P' ? 'guinoP' : 'guinoC' },
    efectos: [colocar(3, { clave: true }, 3, true)],
  }), { retirar: true }),

  ...espejo(315, 335, 2, (b) => ({
    nombre: b === 'P' ? 'Campaña de los jóvenes' : 'Campaña de los mayores',
    texto: `Hasta el final de la semana, ganas 1 PV cada vez que ${RIVAL_TXT[b]} lance una ofensiva.`,
    contexto: b === 'P' ? 'Los jóvenes castigan la crispación en las redes.' : 'Los mayores castigan la crispación en las urnas.',
    escena: b === 'P'
      ? 'Un grupo de siluetas jóvenes con mochilas mirando un horizonte rojo desde una azotea'
      : 'Un banco de parque con siluetas de mayores dando de comer a las palomas bajo un cielo azul',
    efectos: [activar('jovenes', 'turno')],
  }), { retirar: true }),

  ...espejo(316, 336, 3, (b) => ({
    nombre: b === 'P' ? 'Llamamiento al voto útil' : 'Voto útil al PP',
    texto: b === 'P' ? 'El medidor de Frente Amplio baja 2.' : 'El medidor de Vox baja 2.',
    contexto: b === 'P' ? '«Cada voto a la izquierda del PSOE en una provincia pequeña es un escaño para la derecha».' : '«Para echar al Gobierno, el voto que suma es el del PP».',
    escena: `Varios ríos pequeños que desembocan en un gran río ${col(b, 'o')}, vistos desde el aire`,
    efectos: [socio('yo', -2)],
  }), { retirar: true }),

  ...espejo(317, 337, 3, (b) => ({
    nombre: b === 'P' ? 'Remontada' : 'Remontada del cambio',
    texto: `Si ${RIVAL_TXT[b]} te aventaja por 5 o más, ganas 3 PV; si no, 1 PV.`,
    contexto: 'El relato de que las encuestas vuelven a equivocarse.',
    escena: `Una flecha ${col(b, 'a')} que sale de un pozo y sube en vertical por encima de una gráfica`,
    efectos: [si({ c: 'rivalAventaja', n: 5 }, [pv(3)], [pv(1)])],
  }), { retirar: true }),

  ...espejo(318, 338, 2, (b) => ({
    nombre: b === 'P' ? 'Mitin de cierre en el sur' : 'Mitin de cierre en la capital',
    texto: b === 'P'
      ? 'Coloca 2 presencia en una sola provincia clave de Andalucía y gana 1 PV.'
      : 'Coloca 2 presencia en una sola provincia clave de Madrid y Centro y gana 1 PV.',
    contexto: b === 'P' ? 'Cierre de campaña en un feudo histórico del sur.' : 'Cierre de campaña en la capital.',
    escena: b === 'P'
      ? 'Un escenario al aire libre con luces rojas en una explanada andaluza de noche'
      : 'Un escenario con luces azules en una gran plaza de la capital de noche',
    efectos: [colocar(2, { clave: true, zonas: [b === 'P' ? 'AND' : 'MAD'] }, 2, true), pv(1)],
  })),

  ...espejo(319, 339, 3, (b) => ({
    nombre: b === 'P' ? 'Pacto de investidura' : 'Mayoría suficiente',
    texto: 'Dos fuerzas regionales a tu elección se acercan 1 a ti, sin coste.',
    contexto: 'Negociaciones discretas para el día después.',
    escena: `Un bolígrafo ${col(b, 'o')} sobre un documento a medio firmar, con varias firmas de colores`,
    efectos: [{ e: 'afinidadElegir', n: 1, veces: 2 }],
  }), { retirar: true }),

  ...espejo(320, 340, 3, (b) => ({
    nombre: b === 'P' ? 'Marea roja' : 'Ola azul',
    texto: 'Si aventajas al rival en la Ventaja, ganas 2 PV; si no, colocas 1 presencia en 3 provincias clave.',
    contexto: 'Las encuestas de la última semana hablan de tendencia.',
    escena: `Una ola ${col(b, 'a')} gigante a punto de romper sobre un hemiciclo de arena en la playa`,
    efectos: [si({ c: 'yoAventajo', n: 1 }, [pv(2)], [colocar(3, { clave: true }, 1)])],
  }), { retirar: true }),

  // —— Neutrales ——
  { id: 341, nombre: 'Gran coalición', ops: 4, lado: 'N', retirar: true, requisito: { c: 'climaIgual', n: 2 },
    texto: 'Solo con el Clima en 2. Puedes forzar el final de la campaña: el rival gana 6 PV y se pasa directamente a la noche electoral.',
    contexto: 'Voces de ambos partidos piden un gran acuerdo ante el bloqueo.',
    escena: 'Dos piezas de puzle gigantes, una roja y otra azul, que casi encajan sobre una mesa dorada',
    efectos: [{ e: 'granCoalicion' }] },
  { id: 342, nombre: 'Pulso en el Norte', ops: 2, lado: 'N', retirar: true, batalla: true,
    texto: 'Batalla en Asturias, Cantabria o Navarra, donde haya presencia rival: tira un dado y resta 1 por cada vecina que controle el rival. Con 4 o más, su presencia allí pasa a ser tuya y ganas 2 PV. Suma 2 a tu Exigencia.',
    contexto: 'Tres provincias del norte donde el último escaño está en el aire.',
    escena: 'Tres montañas verdes con niebla y banderas lisas roja y azul en sus cimas',
    efectos: [{ e: 'batalla', filtro: { provs: ['33', '39', '31'] } }] },
  { id: 343, nombre: 'El Periódico de Andorra', ops: 2, lado: 'N', retirar: true,
    texto: 'Publicas una encuesta saltándote la veda: puntúa ahora la zona que elijas (también en la semana 8).',
    contexto: 'La ley prohíbe publicar sondeos en España los últimos cinco días… pero no en Andorra.',
    escena: 'Un periódico doblado sobre una mesa de montaña con picos nevados al fondo y un gráfico sin cifras en portada',
    efectos: [{ e: 'puntuar', ignorarVeda: true }] },
  { id: 344, nombre: 'Voto por correo récord', ops: 2, lado: 'N',
    texto: 'Coloca 2 presencia en provincias de 10 o más escaños (máx. 1 por provincia).',
    contexto: 'Millones de votos por correo antes del domingo.',
    escena: 'Montañas de sobres en una nave de correos iluminada con luz dorada',
    efectos: [colocar(2, { minEscanos: 10 }, 1)] },
  { id: 345, nombre: 'Jornada de reflexión', ops: 1, lado: 'N', retirar: true,
    texto: 'El Clima sube 2.',
    contexto: 'Sábado 28: silencio de campaña.',
    escena: 'Una calle vacía de sábado por la mañana con carteles electorales despegándose y un gato durmiendo',
    efectos: [clima(2)] },
  { id: 346, nombre: 'Error de campaña', ops: 2, lado: 'N',
    texto: 'El rival descarta una carta al azar de su mano (sin evento).',
    contexto: 'Un micrófono abierto en el peor momento.',
    escena: 'Un micrófono de solapa olvidado encendido sobre una silla, con una luz dorada parpadeando',
    efectos: [{ e: 'descarteAzar' }] },
  { id: 347, nombre: 'Indecisos de última hora', ops: 2, lado: 'N',
    texto: 'Quien vaya por detrás en la Ventaja gana 1 PV y coloca 1 presencia.',
    contexto: 'Uno de cada cinco votantes decide en la última semana.',
    escena: 'Una silueta ante dos caminos en un cruce, con una papeleta dorada en la mano',
    efectos: [{ e: 'alQueVaDetras', efectos: [pv(1), colocar(1)] }] },
  { id: 348, nombre: 'Lluvia el 29N', ops: 1, lado: 'N',
    texto: 'Baja la participación: los medidores de socios de ambos bloques bajan 1.',
    contexto: 'La previsión anuncia temporal en media España.',
    escena: 'Paraguas de colores ante la puerta de un colegio electoral bajo una lluvia intensa',
    efectos: [socio('P', -1), socio('C', -1)] },
  { id: 349, nombre: 'Último sondeo interno', ops: 1, lado: 'N',
    texto: 'Ves la mano del rival esta semana y avanzas 1 casilla en la Carrera sin tirar.',
    contexto: 'El tracking diario que solo ven los jefes de campaña.',
    escena: 'Una carpeta dorada marcada con un candado sobre una mesa de despacho de noche',
    efectos: [{ e: 'verMano' }, { e: 'carrera', n: 1 }] },

  // —— Comodines de Podemos ——
  { id: 409, nombre: 'La llave morada', ops: 3, lado: 'W', retirar: true,
    texto: 'Tira un dado: con 1-2 Podemos anuncia que no apoyará a Sánchez sin acuerdo (su humor empeora 2); con 3-4, nada; con 5-6 pacta in extremis (su humor mejora 2).',
    contexto: 'Sus escaños pueden decidir la investidura.',
    escena: 'Una llave morada gigante suspendida sobre la cerradura de una gran puerta de hemiciclo',
    efectos: [{ e: 'dado', tabla: [
      { hasta: 2, efectos: [podemos(0, -2)] },
      { hasta: 4, efectos: [] },
      { hasta: 6, efectos: [podemos(0, 2)] },
    ] }] },
  { id: 410, nombre: 'Remontada morada', ops: 2, lado: 'W',
    texto: 'Podemos gana 2 de fuerza y la polarización también da alas a Vox (+1).',
    contexto: 'Los mítines morados se llenan en la recta final.',
    escena: 'Un pabellón lleno de luces moradas visto desde la grada más alta',
    efectos: [podemos(2, 0), socio('C', 1)] },
  { id: 411, nombre: 'Podemos se planta', ops: 2, lado: 'W',
    texto: 'Podemos avisa de que no apoyará a nadie gratis: su humor se acerca 1 a «exigente» (abstención) y quien lidera la Ventaja pierde 1 PV.',
    contexto: '«Nuestros votos no son un cheque en blanco».',
    escena: 'Una silla morada plantada sola en mitad de una calle, frente a dos coches oficiales detenidos',
    efectos: [si({ c: 'humorPodemosMin', n: 1 }, [podemos(0, -1)], [si({ c: 'humorPodemosMax', n: -1 }, [podemos(0, 1)])]), { e: 'aLider', efectos: [pv(-1)] }] },
];

// ———————————————————————————————————————————————————————— AGENDA DE PODEMOS (una por semana)
// Se resuelve tras las Portadas como si la jugara quien lidera la Ventaja («tú»), así que casi siempre le perjudica.
const AGENDA: Def[] = [
  { id: 501, nombre: 'Podemos señala al favorito', ops: 0, lado: 'A',
    texto: 'Podemos dispara contra quien va primero: el líder de la Ventaja pierde 1 PV.',
    contexto: '«Las encuestas dan por hecho un Gobierno; nosotros no».',
    escena: 'Un dedo morado gigante señalando la cima de una gráfica de barras',
    efectos: [pv(-1)] },
  { id: 502, nombre: 'Acampada morada en Sol', ops: 0, lado: 'A',
    texto: 'Podemos acampa en la Puerta del Sol: planta un marcador morado en Madrid, cada bloque pierde 1 presencia allí y el Clima baja 1 (nunca por debajo de 2).',
    contexto: 'Las tiendas de campaña vuelven al kilómetro cero.',
    escena: 'Tiendas de campaña moradas en una gran plaza bajo un reloj, al anochecer',
    efectos: [{ e: 'morado', n: 1, filtro: { provs: ['28'] } }, { e: 'retirar', n: 1, de: 'ambos', filtro: { provs: ['28'] } }, clima(-1, 2)] },
  { id: 503, nombre: 'Votación trampa en el Congreso', ops: 0, lado: 'A',
    texto: 'Podemos registra una votación incómoda para el PSOE. El Progresista elige: apoyarla (el humor de Podemos mejora 1 y el Conservador gana 1 PV) o tumbarla (el humor empeora 1 y Podemos gana 1 de fuerza).',
    contexto: 'Una proposición de ley pensada para retratar al Gobierno.',
    escena: 'Un pulsador de votación morado en un escaño, con los otros botones apagados',
    efectos: [como('P', [elegir([
      ['Apoyarla: humor de Podemos +1 y el Conservador gana 1 PV', [podemos(0, 1), pv(-1)]],
      ['Tumbarla: humor −1 y Podemos gana 1 de fuerza', [podemos(1, -1)]],
    ])])] },
  { id: 504, nombre: 'Gira morada por Andalucía', ops: 0, lado: 'A',
    texto: 'Podemos planta un marcador morado en la provincia andaluza más grande que controle cada bloque.',
    contexto: 'Una semana de actos de Podemos de Huelva a Almería.',
    escena: 'Una furgoneta morada por una carretera entre olivos con el sol de frente',
    efectos: [{ e: 'moradoAuto', n: 1, de: 'ambos', zona: 'AND' }] },
  { id: 505, nombre: 'Oferta envenenada a Sánchez', ops: 0, lado: 'A',
    texto: 'Podemos ofrece su apoyo a cambio de un programa de máximos. El Progresista elige: aceptar (el humor de Podemos mejora 2 y el Conservador gana 2 PV) o rechazar (el humor empeora 1 y Podemos gana 1 de fuerza).',
    contexto: '«Si quiere nuestros votos, que firme».',
    escena: 'Una copa morada sobre una bandeja de plata ofrecida ante una puerta roja',
    efectos: [como('P', [elegir([
      ['Aceptar: humor de Podemos +2 y el Conservador gana 2 PV', [podemos(0, 2), pv(-2)]],
      ['Rechazar: humor −1 y Podemos gana 1 de fuerza', [podemos(1, -1)]],
    ])])] },
  { id: 506, nombre: 'Podemos carga contra el PP y Vox', ops: 0, lado: 'A',
    texto: 'Podemos centra sus ataques en la derecha: el Conservador pierde 1 PV y Vox crece con la polarización (+1).',
    contexto: 'Un mitin morado dedicado entero a la oposición.',
    escena: 'Un ariete morado golpeando una puerta azul cerrada',
    efectos: [como('C', [pv(-1)]), socio('C', 1)] },
  { id: 507, nombre: 'Podemos pide la cabeza de un ministro', ops: 0, lado: 'A',
    texto: 'Podemos exige una dimisión en el Gobierno: el Progresista pierde 1 PV y el humor de Podemos empeora 1.',
    contexto: '«O dimite o no hay nada que hablar».',
    escena: 'Una silla de despacho roja vacía bajo un foco morado',
    efectos: [como('P', [pv(-1)]), podemos(0, -1)] },
  { id: 508, nombre: 'Podemos denuncia a la banca', ops: 0, lado: 'A',
    texto: 'Cada bloque pierde 1 presencia en la provincia más grande que controle.',
    contexto: 'Una campaña contra los beneficios bancarios que salpica a todos.',
    escena: 'Una caja fuerte abierta con un foco morado y dos sombras, roja y azul, que se alejan',
    efectos: [{ e: 'castigoCapitales' }] },
  { id: 509, nombre: 'Encuesta propia de Podemos', ops: 0, lado: 'A',
    texto: 'Tira un dado: con 1-2 Podemos pierde 1 de fuerza; con 3-4, nada; con 5-6 gana 1 de fuerza y su humor empeora 1.',
    contexto: 'Un sondeo encargado por Podemos que nadie se cree… o sí.',
    escena: 'Un gráfico de barras morado dibujado a mano en una pizarra de un local de barrio',
    efectos: [{ e: 'dado', tabla: [
      { hasta: 2, efectos: [podemos(-1, 0)] },
      { hasta: 4, efectos: [] },
      { hasta: 6, efectos: [podemos(1, -1)] },
    ] }] },
  { id: 510, nombre: 'Podemos tiende puentes con ERC y EH Bildu', ops: 0, lado: 'A',
    texto: 'ERC y EH Bildu crecen un 5% a costa de los grandes bloques.',
    contexto: 'Una foto conjunta de las izquierdas soberanistas y Podemos.',
    escena: 'Un puente colgante morado entre dos acantilados con banderas lisas de colores',
    efectos: [{ e: 'regional', partido: 'ERC', pct: 0.05 }, { e: 'regional', partido: 'BILDU', pct: 0.05 }] },
  { id: 511, nombre: 'Podemos no apoyará a nadie gratis', ops: 0, lado: 'A',
    texto: 'Su humor se acerca 1 a «exigente» (abstención) y Podemos gana 1 de fuerza.',
    contexto: '«Primero el programa, después los nombres».',
    escena: 'Un cartel de «cerrado» sin texto, solo un aspa morada, colgado en la puerta de una sede',
    efectos: [si({ c: 'humorPodemosMin', n: 1 }, [podemos(0, -1)], [si({ c: 'humorPodemosMax', n: -1 }, [podemos(0, 1)])]), podemos(1, 0)] },
  { id: 512, nombre: 'Podemos exige una vicepresidencia', ops: 0, lado: 'A',
    texto: 'El Progresista elige: aceptar (el humor de Podemos mejora 1 y el Conservador gana 1 PV) o rechazar (el humor de Podemos empeora 1).',
    contexto: '«Queremos estar en el Consejo de Ministros».',
    escena: 'Una silla morada colocada junto a una mesa de consejo vacía con sillas rojas',
    efectos: [como('P', [elegir([
      ['Aceptar: humor de Podemos +1 y el Conservador gana 1 PV', [podemos(0, 1), pv(-1)]],
      ['Rechazar: el humor de Podemos empeora 1', [podemos(0, -1)]],
    ])])] },
  { id: 513, nombre: 'Podemos rompe una negociación', ops: 0, lado: 'A',
    texto: 'El PNV y Junts se alejan 1 de quien tuvieran más cerca.',
    contexto: 'Una filtración de Podemos dinamita una mesa discreta.',
    escena: 'Una mesa de negociación con tazas volcadas y un sobre morado abierto en el centro',
    efectos: [{ e: 'afinidadNeutral', partido: 'PNV' }, { e: 'afinidadNeutral', partido: 'JUNTS' }] },
  { id: 514, nombre: 'Vídeo viral morado', ops: 0, lado: 'A',
    texto: 'Un vídeo de Podemos arrasa: Podemos gana 1 de fuerza y quien va por detrás en la Ventaja gana 1 PV.',
    contexto: 'Millones de reproducciones en una noche.',
    escena: 'Un móvil vertical con un destello morado que ilumina una habitación a oscuras',
    efectos: [podemos(1, 0), { e: 'alQueVaDetras', efectos: [pv(1)] }] },
  { id: 515, nombre: 'Podemos hace campaña con ERC', ops: 0, lado: 'A',
    texto: 'ERC crece un 5% y Podemos planta un marcador morado en la provincia catalana más grande que controle cada bloque.',
    contexto: 'En Cataluña, Podemos concurre junto a ERC.',
    escena: 'Una pancarta morada y amarilla lisa colgada de un balcón modernista',
    efectos: [{ e: 'regional', partido: 'ERC', pct: 0.05 }, { e: 'moradoAuto', n: 1, de: 'ambos', zona: 'CAT' }] },
  { id: 516, nombre: 'Podemos baja el tono', ops: 0, lado: 'A',
    texto: 'El Clima sube 1 y el humor de Podemos mejora 1.',
    contexto: 'Una semana sin choques con el PSOE.',
    escena: 'Un dial morado de volumen girado hacia abajo sobre un altavoz silencioso',
    efectos: [clima(1), podemos(0, 1)] },
  { id: 517, nombre: 'Podemos irrumpe en la agenda', ops: 0, lado: 'A',
    texto: 'Quien va por detrás en la Ventaja retira 2 presencia de su rival en provincias clave (máx. 1 por provincia).',
    contexto: 'Una propuesta morada que obliga a todos a posicionarse.',
    escena: 'Un pie morado que entra en un plató de televisión iluminado y aparta dos atriles',
    efectos: [{ e: 'aRezagado', efectos: [retirar(2, { clave: true }, 1)] }] },
  { id: 519, nombre: 'Podemos tumba un decreto con la derecha', ops: 0, lado: 'A',
    texto: 'Los votos de Podemos, junto a los de PP y Vox, tumban una ley del Gobierno: el Progresista pierde 1 PV y, si Podemos está en ruptura con el PSOE (humor −2 o menos), la pinza avanza 1.',
    contexto: 'No sería la primera vez: en enero de 2024 sus cinco diputados tumbaron así el decreto del subsidio.',
    escena: 'Tres botones de votación encendidos, morado, azul y verde, frente a uno rojo apagado',
    efectos: [como('P', [pv(-1)]), si({ c: 'humorPodemosMax', n: -2 }, [podemos(0, 0, 1)])] },
  { id: 520, nombre: 'Podemos, ni con Vox ni con el PP', ops: 0, lado: 'A',
    texto: 'Podemos recuerda que nunca gobernará con la derecha: el Conservador pierde 1 PV y la pinza retrocede 1.',
    contexto: '«Una cosa es votar contra un decreto y otra muy distinta abrirle la puerta a Vox».',
    escena: 'Una puerta azul cerrada con un candado morado',
    efectos: [como('C', [pv(-1)]), podemos(0, 0, -1)] },
  { id: 518, nombre: 'Marcha morada', ops: 0, lado: 'A',
    texto: 'Podemos planta un marcador morado en la provincia más grande que controle quien lidera la Ventaja y el Clima baja 1 (nunca por debajo de 2).',
    contexto: 'Una marcha que acaba frente a la sede del favorito.',
    escena: 'Una columna de antorchas moradas avanzando por una avenida hacia un edificio iluminado',
    efectos: [{ e: 'moradoAuto', n: 1, de: 'lider' }, clima(-1, 2)] },
];

export const VOTO_UTIL: Carta = {
  id: 0, nombre: 'El Voto Útil', ops: 4, lado: 'N', mazo: 0, retirar: false,
  texto: 'Solo para operaciones: 4 PC (+1 si todas se emplean en circunscripciones de 5 escaños o menos). Después pasa boca abajo al rival, que podrá usarla a partir de la semana siguiente. No puede ser Portada. Quien la tenga al final de la campaña gana 1 PV.',
  contexto: 'En las provincias pequeñas, D\'Hondt castiga a quien divide el voto.',
  escena: 'Una papeleta dorada luminosa entrando en una urna transparente, sobre un fondo de mapa con provincias pequeñas resaltadas',
  efectos: [],
};

/** La Junta Electoral Central (anula la Cuenta atrás y no puede ser Portada). */
export const ID_JUNTA = 43;

const montar = (defs: Def[], mazo: 1 | 2 | 3 | 4): Carta[] => defs.map((d) => ({ retirar: false, ...d, mazo }));

export const CARTAS_LISTA: Carta[] = [VOTO_UTIL, ...montar(MAZO_1, 1), ...montar(MAZO_2, 2), ...montar(MAZO_3, 3), ...montar(AGENDA, 4)];
export const CARTAS: Record<number, Carta> = Object.fromEntries(CARTAS_LISTA.map((c) => [c.id, c]));
export const MAZO_IDS: Record<1 | 2 | 3, number[]> = {
  1: CARTAS_LISTA.filter((c) => c.mazo === 1).map((c) => c.id),
  2: CARTAS_LISTA.filter((c) => c.mazo === 2).map((c) => c.id),
  3: CARTAS_LISTA.filter((c) => c.mazo === 3).map((c) => c.id),
};
export const AGENDA_IDS: number[] = CARTAS_LISTA.filter((c) => c.mazo === 4).map((c) => c.id);
