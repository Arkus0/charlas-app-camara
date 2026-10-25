// Mazos de los bloques. Cada carta progresista tiene su pareja conservadora con la misma fuerza, la misma fase
// y el mismo tipo de tema: propio, del rival (fuerte, pero le hace la campaña al otro) o Corrupción.
// Temas del Progresista: Vivienda (VIV), Servicios públicos (SER), Derechos (DER).
// Temas del Conservador: Economía (ECO), Inmigración y seguridad (INM), Unidad de España (ESP).
import type { Carta } from '../../motor/tipos';
import {
  activar, calor, clima, colocar, como, enAmbos, espejo, GALICIA, podemos, pv, retirar, salpicar, si, socio, URBANAS, dado,
} from './ayudas';

// ———————————————————————————————————————————————————— PRECAMPAÑA (semanas 1-3)
const PRECAMPANA: Carta[] = [
  ...espejo(1, 21, { fuerza: 3, fase: 1, retirar: true }, (b) => ({
    nombre: b === 'P' ? 'Ferraz a toda máquina' : 'Génova a toda máquina',
    tema: b === 'P' ? 'SER' : 'ECO',
    texto: 'Hasta el final de la semana, tus cartas valen +1 PC.',
    contexto: b === 'P' ? 'La sede socialista activa su maquinaria de campaña a pleno rendimiento.' : 'La sede popular activa su maquinaria de campaña a pleno rendimiento.',
    efectos: [activar('masPC', 'semana')],
  })),

  ...espejo(2, 22, { fuerza: 4, fase: 1, retirar: true }, (b) => ({
    nombre: b === 'P' ? 'Fondos europeos' : 'Frente autonómico',
    tema: b === 'P' ? 'ECO' : 'SER',
    texto: 'Elige una zona: coloca 1 presencia en hasta 4 provincias que no controle el rival.',
    contexto: b === 'P' ? 'Los proyectos de los fondos de recuperación llegan a ayuntamientos de toda España.' : 'Los presidentes autonómicos del PP, que gestionan la sanidad, coordinan su ofensiva frente al Gobierno.',
    destino: { d: 'zona' },
    efectos: [colocar(4, { maxPor: 1, filtro: { noControla: 'rival' }, reparto: true })],
  })),

  ...espejo(3, 23, { fuerza: 3, fase: 1 }, (b) => ({
    nombre: b === 'P' ? '«Que viene la ultraderecha»' : '«Que se rompe España»',
    tema: b === 'P' ? 'DER' : 'ESP',
    texto: 'El Clima baja 1. Ganas 2 PV si queda en 3 o menos; si no, 1 PV.',
    contexto: b === 'P' ? 'El miedo a un Gobierno con Vox como resorte para movilizar al electorado progresista.' : 'El miedo a las cesiones al independentismo como resorte para movilizar al electorado conservador.',
    efectos: [clima(-1), si({ c: 'climaMax', n: 3 }, [pv(2)], [pv(1)])],
  })),

  ...espejo(4, 24, { fuerza: 3, fase: 1 }, (b) => ({
    nombre: b === 'P' ? 'Comisión de investigación en el Congreso' : 'Comisión de investigación en el Senado',
    tema: 'COR',
    texto: 'La corrupción salpica al rival, que descarta una carta al azar. Ganas 1 PV.',
    contexto: b === 'P' ? 'La mayoría del Congreso cita a comparecer a responsables de gobiernos autonómicos de la oposición.' : 'La mayoría absoluta del PP en el Senado cita a comparecer a miembros del Gobierno.',
    efectos: [salpicar(), { e: 'descarteAzar' }, pv(1)],
  })),

  ...espejo(5, 25, { fuerza: 3, fase: 1 }, (b) => ({
    nombre: b === 'P' ? 'Marea por la sanidad pública' : 'Marea por la igualdad entre españoles',
    tema: b === 'P' ? 'SER' : 'ESP',
    texto: b === 'P'
      ? 'Elige Andalucía o Madrid y Centro: retira 3 presencia conservadora (máx. 2 por provincia).'
      : 'Elige Cataluña o la Cornisa Norte: retira 3 presencia progresista (máx. 2 por provincia).',
    contexto: b === 'P' ? 'Las protestas por las listas de espera señalan a los gobiernos autonómicos.' : 'Las protestas contra la financiación singular y la amnistía señalan al Gobierno.',
    destino: { d: 'zona' },
    efectos: [retirar(3, { maxPor: 2, filtro: { zonas: b === 'P' ? ['AND', 'MAD'] : ['CAT', 'NOR'] }, reparto: true })],
  })),

  ...espejo(6, 26, { fuerza: 2, fase: 1, retirar: true }, (b) => ({
    nombre: b === 'P' ? 'Alcaldía de progreso' : 'Alcaldía del cambio',
    tema: b === 'P' ? 'VIV' : 'ECO',
    texto: 'Elige una provincia de 4 escaños o menos con presencia rival: la retiras toda y colocas la necesaria para controlarla.',
    contexto: b === 'P' ? 'Un vuelco municipal en una capital de provincia da aire al Gobierno.' : 'Un vuelco municipal en una capital de provincia da aire a la oposición.',
    destino: { d: 'provincia', filtro: { maxEscanos: 4, conPresencia: 'rival' } },
    efectos: [{ e: 'tomar' }],
  })),

  ...espejo(7, 27, { fuerza: 2, fase: 1, retirar: true }, (b) => ({
    nombre: b === 'P' ? 'Batalla por las capitales' : 'Pulso por las capitales',
    tema: b === 'P' ? 'INM' : 'VIV',
    texto: 'Elige una provincia clave que controle el rival y tira un dado: con 4 o más la tomas y ganas 1 PV; si no, el Clima baja 1.',
    contexto: b === 'P' ? 'El Gobierno vuelca su aparato sobre una gran plaza de la oposición, con la seguridad ciudadana de fondo.' : 'La oposición vuelca su aparato sobre una gran plaza del Gobierno, con el precio de la vivienda de fondo.',
    destino: { d: 'provincia', filtro: { clave: true, controla: 'rival' } },
    efectos: [dado([[3, [clima(-1)]], [6, [{ e: 'tomar' }, pv(1)]]])],
  })),

  ...espejo(8, 28, { fuerza: 1, fase: 1, retirar: true }, (b) => ({
    nombre: b === 'P' ? 'Choque con la Comunidad de Madrid' : 'Choque con la Generalitat',
    tema: b === 'P' ? 'SER' : 'ESP',
    texto: b === 'P' ? 'El Conservador pierde 2 presencia en Madrid.' : 'El Progresista pierde 2 presencia en Barcelona.',
    contexto: b === 'P' ? 'El Gobierno y la Comunidad de Madrid chocan por la financiación y las competencias.' : 'La oposición choca con el Govern por el acuerdo de financiación con Cataluña.',
    efectos: [retirar(2, { filtro: { provs: [b === 'P' ? '28' : '08'] } })],
  })),

  ...espejo(9, 29, { fuerza: 2, fase: 1, retirar: true }, (b) => ({
    nombre: b === 'P' ? 'Marea en el sur' : 'Ola en el Levante',
    tema: b === 'P' ? 'SER' : 'ECO',
    texto: b === 'P'
      ? 'Coloca 2 presencia en Sevilla. Esta semana, +1 PC a tus operaciones en Andalucía.'
      : 'Coloca 2 presencia en Valencia. Esta semana, +1 PC a tus operaciones en Levante y Baleares.',
    contexto: b === 'P' ? 'La movilización socialista en su antiguo granero andaluz.' : 'La ola popular en la Comunitat Valenciana y Murcia.',
    efectos: [colocar(2, { filtro: { provs: [b === 'P' ? '41' : '46'] } }), activar('bonoZona', 'semana', { zona: b === 'P' ? 'AND' : 'LEV' })],
  })),

  ...espejo(10, 30, { fuerza: 2, fase: 1 }, (b) => ({
    nombre: b === 'P' ? 'Ruta del Gobierno por la España vaciada' : 'Ruta del cambio por la España vaciada',
    tema: b === 'P' ? 'SER' : 'ECO',
    texto: 'Elige una zona: coloca 1 presencia en hasta 3 provincias de 4 escaños o menos.',
    contexto: 'Un autobús de campaña recorre las provincias que menos diputados eligen.',
    destino: { d: 'zona' },
    efectos: [colocar(3, { maxPor: 1, filtro: { maxEscanos: 4 }, reparto: true })],
  })),

  ...espejo(12, 32, { fuerza: 1, fase: 1 }, (b) => ({
    nombre: b === 'P' ? 'Cordón sanitario a la ultraderecha' : 'Cordón sanitario al independentismo',
    tema: b === 'P' ? 'DER' : 'ESP',
    texto: 'Retira toda la presencia rival de una provincia que no controle nadie.',
    contexto: b === 'P' ? 'El Progresista pide aislar a Vox y a quien pacte con él.' : 'El Conservador pide aislar al independentismo y a quien pacte con él.',
    destino: { d: 'provincia', filtro: { sinControl: true, conPresencia: 'rival' } },
    efectos: [{ e: 'retirarTodo', enDestino: true }],
  })),

  ...espejo(13, 33, { fuerza: 2, fase: 1, retirar: true }, (b) => ({
    nombre: b === 'P' ? 'Voto oculto progresista' : 'Voto oculto conservador',
    tema: b === 'P' ? 'DER' : 'INM',
    texto: b === 'P'
      ? 'En Madrid, Valencia, Málaga, Murcia o Zaragoza: igualas la presencia conservadora.'
      : 'En Barcelona, Sevilla, Asturias, Bizkaia o Las Palmas: igualas la presencia progresista.',
    contexto: b === 'P' ? 'Las encuestas no detectan a todos los votantes progresistas.' : 'Las encuestas no detectan a todos los votantes conservadores.',
    destino: { d: 'provincia', filtro: { provs: b === 'P' ? ['28', '46', '29', '30', '50'] : ['08', '41', '33', '48', '35'], conPresencia: 'rival' } },
    efectos: [{ e: 'igualar' }],
  })),

  ...espejo(15, 35, { fuerza: 4, fase: 1, retirar: true }, (b) => ({
    nombre: b === 'P' ? 'Bastión de Barcelona' : 'Bastión de Madrid',
    tema: b === 'P' ? 'ESP' : 'VIV',
    texto: b === 'P'
      ? 'Colocas la presencia necesaria para controlar Barcelona, y el Conservador ya no puede atacarla.'
      : 'Colocas la presencia necesaria para controlar Madrid, y el Progresista ya no puede atacarla.',
    contexto: b === 'P' ? 'El PSC convierte Barcelona en su fortaleza, en plena discusión sobre la financiación singular.' : 'El PP convierte Madrid en su fortaleza, la comunidad con el alquiler más caro.',
    efectos: [{ e: 'controlar', prov: b === 'P' ? '08' : '28' }, activar('bastion', 'partida', { prov: b === 'P' ? '08' : '28' })],
  })),

  ...espejo(16, 36, { fuerza: 3, fase: 1, retirar: true }, (b) => ({
    nombre: b === 'P' ? 'Crisis en los gobiernos PP-Vox' : 'Crisis en los socios del Gobierno',
    tema: b === 'P' ? 'DER' : 'ESP',
    texto: b === 'P'
      ? 'Retira 3 presencia conservadora en Valencia, Murcia, Zaragoza o Badajoz (en una zona, máx. 2 por provincia).'
      : 'Retira 3 presencia progresista en Barcelona, Bizkaia, Gipuzkoa o Navarra (en una zona, máx. 2 por provincia).',
    contexto: b === 'P' ? 'Vox rompió en 2024 los gobiernos autonómicos que compartía con el PP, y cada pacto nuevo se negocia entre reproches.' : 'Junts rompió con el PSOE y en octubre tumbó los decretos de vivienda que precipitaron el adelanto.',
    destino: { d: 'zona' },
    efectos: [retirar(3, { maxPor: 2, filtro: { provs: b === 'P' ? ['46', '30', '50', '06'] : ['08', '48', '20', '31'] }, reparto: true })],
  })),

  ...espejo(17, 37, { fuerza: 3, fase: 1, retirar: true }, (b) => ({
    nombre: b === 'P' ? 'Disolución de las Cortes' : 'Ola autonómica',
    tema: b === 'P' ? 'VIV' : 'ECO',
    texto: 'Elige una zona: coloca 1 presencia en hasta 2 provincias clave y gana 1 PV.',
    contexto: b === 'P' ? 'El 2 de octubre el Congreso tumbó los decretos de vivienda por 178 votos a 172. Tres días después, el presidente disolvió las Cortes.' : 'El PP gobierna la mayoría de las comunidades y ganó en mayo las andaluzas, aunque sin mayoría absoluta.',
    destino: { d: 'zona' },
    efectos: [colocar(2, { maxPor: 1, filtro: { clave: true }, reparto: true }), pv(1)],
  })),

  ...espejo(18, 38, { fuerza: 3, fase: 1 }, (b) => ({
    nombre: b === 'P' ? 'Escudo social' : 'Rebaja fiscal',
    tema: b === 'P' ? 'SER' : 'ECO',
    texto: 'Elige una zona: coloca 1 presencia en hasta 3 provincias de 5 escaños o menos.',
    contexto: b === 'P' ? 'Pensiones revalorizadas e ingreso mínimo en el centro del mensaje del Gobierno.' : 'Bajadas de impuestos autonómicos como escaparate de la oposición.',
    destino: { d: 'zona' },
    efectos: [colocar(3, { maxPor: 1, filtro: { maxEscanos: 5 }, reparto: true })],
  })),

  ...espejo(19, 39, { fuerza: 2, fase: 1 }, (b) => ({
    nombre: b === 'P' ? 'Topes al alquiler' : 'Okupación y seguridad',
    tema: b === 'P' ? 'VIV' : 'INM',
    texto: 'Coloca 2 presencia en Madrid, Barcelona, Valencia, Málaga, Sevilla o Baleares (en una zona).',
    contexto: b === 'P' ? 'Los decretos de vivienda que tumbó el Congreso son la bandera de la campaña progresista.' : 'La okupación y la multirreincidencia, en el centro del mensaje de la oposición.',
    destino: { d: 'zona' },
    efectos: [colocar(2, { maxPor: 2, filtro: { provs: URBANAS }, reparto: true })],
  })),

  ...espejo(20, 40, { fuerza: 3, fase: 1, retirar: true }, (b) => ({
    nombre: b === 'P' ? 'Frenar a la ultraderecha' : 'Concentrar el voto del cambio',
    tema: b === 'P' ? 'DER' : 'ECO',
    texto: b === 'P'
      ? 'Voto útil al PSOE: el medidor de Frente Amplio baja 1, el de Vox sube 1 y ganas 1 PV.'
      : 'El voto que suma: el medidor de Vox baja 1, el de Frente Amplio sube 1 y ganas 1 PV.',
    contexto: b === 'P' ? 'El «que viene la derecha» concentra el voto en el PSOE.' : 'La apelación al voto que suma concentra a la derecha en el PP.',
    efectos: [socio('rival', 1), socio('yo', -1), pv(1)],
  })),

  // —— noticias reales, también en espejo ——
  ...espejo(61, 71, { fuerza: 3, fase: 1, retirar: true, noticia: true }, (b) => ({
    nombre: b === 'P' ? 'Caso Kitchen: Interior, en el banquillo' : 'Caso Koldo: 24 años para Ábalos',
    tema: 'COR',
    texto: 'La corrupción salpica al rival: ganas 1 PV y retiras 2 de su presencia en provincias clave (máx. 1 por provincia).',
    contexto: b === 'P'
      ? 'La Audiencia Nacional juzgó en abril al exministro del Interior Jorge Fernández Díaz por el presunto espionaje a Bárcenas con fondos públicos. La sentencia está pendiente.'
      : 'En junio el Supremo condenó a José Luis Ábalos a 24 años de prisión y a su exasesor Koldo García a más de 19 por las mordidas de las mascarillas.',
    efectos: [salpicar(), pv(1), retirar(2, { maxPor: 1, filtro: { clave: true } })],
  })),

  ...espejo(62, 72, { fuerza: 3, fase: 1, noticia: true }, (b) => ({
    nombre: b === 'P' ? 'Caso Montoro' : 'La «fontanera» de Ferraz',
    tema: 'COR',
    texto: 'La corrupción salpica al rival: retiras 1 de su presencia en 3 provincias que controle. El Clima baja 1.',
    contexto: b === 'P'
      ? 'Un juez investiga al exministro de Hacienda Cristóbal Montoro por presuntamente favorecer con leyes a medida a gasistas que pagaban a su antiguo despacho.'
      : 'Los audios de Leire Díez, que se presentaba como mano derecha de Santos Cerdán, buscando información contra un mando de la UCO, están en los juzgados. Ella niega haber actuado por encargo del PSOE.',
    efectos: [salpicar(), retirar(3, { maxPor: 1, filtro: { controla: 'rival' } }), clima(-1)],
  })),

  ...espejo(63, 73, { fuerza: 2, fase: 1, noticia: true }, (b) => ({
    nombre: b === 'P' ? 'Marcha por la vivienda' : 'Tractorada en Madrid',
    tema: b === 'P' ? 'VIV' : 'ECO',
    texto: b === 'P'
      ? 'Coloca 2 presencia en Madrid, Barcelona, Valencia, Málaga, Sevilla o Baleares (en una zona). El medidor de Frente Amplio sube 1.'
      : 'Coloca 1 presencia en hasta 2 provincias de Interior. El medidor de Vox sube 1.',
    contexto: b === 'P'
      ? 'Los sindicatos de inquilinos llenan las calles: la vivienda es la primera preocupación de los españoles.'
      : 'En febrero, cientos de tractores recorrieron Madrid de Colón al Ministerio de Agricultura contra el acuerdo con Mercosur y la nueva PAC.',
    destino: { d: 'zona' },
    efectos: b === 'P'
      ? [colocar(2, { maxPor: 2, filtro: { provs: URBANAS }, reparto: true }), socio('P', 1)]
      : [colocar(2, { maxPor: 1, filtro: { zonas: ['INT'] }, reparto: true }), socio('C', 1)],
  })),

  // —— comunes a los dos mazos ——
  ...enAmbos(49, { fuerza: 2, fase: 1 }, () => ({
    nombre: 'Bulo viral',
    tema: 'COR',
    texto: 'Retira 2 presencia rival (máx. 1 por provincia). La corrupción le salpica y el Clima baja 1.',
    contexto: 'Un vídeo manipulado corre por las redes antes de ser desmentido.',
    efectos: [retirar(2, { maxPor: 1 }), salpicar(), clima(-1)],
  })),

  ...enAmbos(51, { fuerza: 3, fase: 1 }, (b) => ({
    nombre: 'Mitin multitudinario',
    tema: b === 'P' ? 'SER' : 'ECO',
    texto: 'Coloca 3 presencia en una provincia clave donde ya tengas presencia.',
    contexto: 'Una plaza de toros llena y todas las televisiones conectadas.',
    destino: { d: 'provincia', filtro: { clave: true, conPresencia: 'yo' } },
    efectos: [colocar(3, { maxPor: 3, reparto: true })],
  })),

  ...enAmbos(55, { fuerza: 1, fase: 1 }, (b) => ({
    nombre: 'Entrevista en prime time',
    tema: b === 'P' ? 'DER' : 'INM',
    texto: 'Ganas 1 PV.',
    contexto: 'Un programa de entretenimiento con millones de espectadores.',
    efectos: [pv(1)],
  })),
];

// ———————————————————————————————————————————————————— CAMPAÑA (entran en la semana 4)
const CAMPANA: Carta[] = [
  ...espejo(202, 242, { fuerza: 2, fase: 2 }, (b) => ({
    nombre: b === 'P' ? 'Militancia puerta a puerta' : 'Afiliados puerta a puerta',
    tema: b === 'P' ? 'VIV' : 'ECO',
    texto: 'Elige una zona: coloca 1 presencia en hasta 3 provincias donde ya tengas presencia.',
    contexto: b === 'P' ? 'La militancia socialista recorre los barrios casa por casa.' : 'Los afiliados populares recorren los barrios casa por casa.',
    destino: { d: 'zona' },
    efectos: [colocar(3, { maxPor: 1, filtro: { conPresencia: 'yo' }, reparto: true })],
  })),

  ...espejo(203, 243, { fuerza: 3, fase: 2, retirar: true }, (b) => ({
    nombre: b === 'P' ? 'Guerra interna en la oposición' : 'Guerra interna en el Gobierno',
    tema: b === 'P' ? 'DER' : 'ESP',
    texto: 'El rival pierde 1 acción esta semana.',
    contexto: b === 'P' ? 'Las tensiones entre el PP y Vox paralizan a la oposición.' : 'Las tensiones entre los socios paralizan al Gobierno.',
    efectos: [como('rival', [{ e: 'acciones', n: -1 }])],
  })),

  ...espejo(204, 244, { fuerza: 2, fase: 2 }, (b) => ({
    nombre: b === 'P' ? 'Campaña limpia' : 'Campaña en positivo',
    tema: b === 'P' ? 'SER' : 'ECO',
    texto: 'El Clima sube 1 y, esta semana, tus ataques en provincias clave no lo bajan.',
    contexto: b === 'P' ? 'El Progresista promete no entrar en el barro.' : 'El Conservador promete hablar solo de propuestas.',
    efectos: [clima(1), activar('campanaLimpia', 'semana')],
  })),

  ...espejo(206, 246, { fuerza: 3, fase: 2, retirar: true }, (b) => ({
    nombre: b === 'P' ? 'Manifiesto de la cultura' : 'Manifiesto empresarial',
    tema: b === 'P' ? 'DER' : 'ECO',
    texto: 'Ganas 1 PV y uno de tus temas sube 2 de calor.',
    contexto: b === 'P' ? 'Actores, músicos y escritores firman a favor del Gobierno.' : 'Empresarios y directivos firman a favor del cambio.',
    destino: { d: 'tema', propio: true },
    efectos: [pv(1), calor(2)],
  })),

  ...espejo(207, 247, { fuerza: 2, fase: 2 }, (b) => ({
    nombre: b === 'P' ? 'Denuncia por propaganda autonómica' : 'Denuncia por propaganda del Gobierno',
    tema: 'COR',
    texto: 'La corrupción salpica al rival y su calor sube 1. Ganas 1 PV.',
    contexto: b === 'P' ? 'El Gobierno denuncia el uso partidista de los medios autonómicos.' : 'La oposición denuncia el uso electoral de la publicidad institucional.',
    efectos: [salpicar(), calor(1, 'COR'), pv(1)],
  })),

  ...espejo(208, 248, { fuerza: 3, fase: 2 }, (b) => ({
    nombre: b === 'P' ? 'Guiño al centro' : 'Guiño a los moderados',
    tema: b === 'P' ? 'ECO' : 'SER',
    texto: 'Retira 2 presencia rival de una provincia clave y gana 1 PV.',
    contexto: b === 'P' ? 'El PSOE busca al votante de centro que dudó en 2023 hablando de economía.' : 'El PP busca al socialista moderado desencantado hablando de sanidad.',
    destino: { d: 'provincia', filtro: { clave: true, conPresencia: 'rival' } },
    efectos: [retirar(2, { maxPor: 2, reparto: true }), pv(1)],
  })),

  ...espejo(209, 249, { fuerza: 3, fase: 2, retirar: true }, (b) => ({
    nombre: b === 'P' ? 'Un barón rompe con Génova' : 'Un barón rompe con Ferraz',
    tema: b === 'P' ? 'DER' : 'ESP',
    texto: 'El rival pierde toda su presencia en una provincia de 6 escaños o menos, y su socio sube 1.',
    contexto: b === 'P' ? 'Un dirigente territorial popular se desmarca de la dirección nacional.' : 'Un dirigente territorial socialista se desmarca de la dirección federal.',
    destino: { d: 'provincia', filtro: { maxEscanos: 6, conPresencia: 'rival' } },
    efectos: [{ e: 'retirarTodo', enDestino: true }, socio('rival', 1)],
  })),

  ...espejo(211, 251, { fuerza: 3, fase: 2, retirar: true }, (b) => ({
    nombre: b === 'P' ? 'Las capitales progresistas' : 'Las capitales del cambio',
    tema: b === 'P' ? 'VIV' : 'ECO',
    texto: 'Ganas 1 PV por cada provincia clave que controles (máx. 3).',
    contexto: b === 'P' ? 'Las grandes ciudades donde gobierna la izquierda, en el escaparate.' : 'Las grandes ciudades donde gobierna la derecha, en el escaparate.',
    efectos: [{ e: 'pvPorClaves', max: 3 }],
  })),

  ...espejo(214, 254, { fuerza: 2, fase: 2 }, (b) => ({
    nombre: b === 'P' ? 'Ronda con los nacionalistas' : 'Ronda con los regionalistas',
    tema: b === 'P' ? 'ESP' : 'SER',
    texto: 'Una fuerza regional se acerca 2 a ti, sin coste.',
    contexto: b === 'P' ? 'Cafés discretos con ERC, Junts y el PNV pensando en el día después.' : 'Cafés discretos con CC, UPN y el PNV sobre la financiación de los servicios.',
    destino: { d: 'partido' },
    efectos: [{ e: 'afinidad', n: 2 }],
  })),

  ...espejo(217, 257, { fuerza: 2, fase: 2 }, (b) => ({
    nombre: b === 'P' ? 'La voz de los barrios' : 'La voz de los pueblos',
    tema: b === 'P' ? 'VIV' : 'ECO',
    texto: 'Elige una zona: retira 3 presencia rival de provincias que no sean clave (máx. 2 por provincia).',
    contexto: b === 'P' ? 'Las asociaciones vecinales toman la palabra.' : 'Las plataformas del mundo rural toman la palabra.',
    destino: { d: 'zona' },
    efectos: [retirar(3, { maxPor: 2, filtro: { clave: false }, reparto: true })],
  })),

  ...espejo(222, 262, { fuerza: 3, fase: 2, noticia: true }, (b) => ({
    nombre: b === 'P' ? 'La hemeroteca de la Gürtel' : 'El fiscal general, condenado',
    tema: 'COR',
    texto: 'La corrupción salpica al rival: ganas 2 PV y el Clima baja 1.',
    contexto: b === 'P' ? 'En 2018 la Audiencia Nacional condenó al PP como partícipe a título lucrativo de la trama Gürtel; la sentencia desencadenó la moción de censura.' : 'En noviembre de 2025 el Supremo condenó al fiscal general del Estado a dos años de inhabilitación por revelación de secretos; dimitió días después.',
    efectos: [salpicar(), pv(2), clima(-1)],
  })),

  ...espejo(223, 263, { fuerza: 2, fase: 2 }, (b) => ({
    nombre: b === 'P' ? 'Récord de afiliación' : 'La cesta de la compra',
    tema: b === 'P' ? 'ECO' : 'VIV',
    texto: 'Ganas 2 PV si el Clima está en 3 o más; si no, 1 PV.',
    contexto: b === 'P' ? 'La Seguridad Social encadena máximos de afiliados.' : 'Los precios de los alimentos y del alquiler siguen en la conversación.',
    efectos: [si({ c: 'climaMin', n: 3 }, [pv(2)], [pv(1)])],
  })),

  ...espejo(224, 264, { fuerza: 3, fase: 2 }, (b) => ({
    nombre: b === 'P' ? 'Reducción de jornada' : 'Avales para la primera vivienda',
    tema: b === 'P' ? 'ECO' : 'VIV',
    texto: b === 'P'
      ? 'Ganas 1 PV y colocas 1 presencia en hasta 2 provincias de Andalucía o Cataluña (en una zona).'
      : 'Ganas 1 PV y colocas 1 presencia en hasta 2 provincias de Madrid y Centro o Levante y Baleares (en una zona).',
    contexto: b === 'P' ? 'La jornada de 37,5 horas, bandera laboral del Gobierno.' : 'Los avales públicos para que los jóvenes compren su primera vivienda, promesa estrella de la oposición.',
    destino: { d: 'zona' },
    efectos: [pv(1), colocar(2, { maxPor: 1, filtro: { zonas: b === 'P' ? ['AND', 'CAT'] : ['MAD', 'LEV'] }, reparto: true })],
  })),

  ...espejo(225, 265, { fuerza: 3, fase: 2 }, (b) => ({
    nombre: b === 'P' ? 'Ministros en campaña' : 'Presidentes autonómicos en campaña',
    tema: b === 'P' ? 'SER' : 'ECO',
    texto: 'Coloca 2 presencia en cualquier provincia. El Clima baja 1.',
    contexto: b === 'P' ? 'La agenda del Consejo de Ministros se llena de actos por toda España.' : 'Los presidentes autonómicos del PP recorren España con el candidato.',
    destino: { d: 'provincia' },
    efectos: [colocar(2, { maxPor: 2, reparto: true }), clima(-1)],
  })),

  ...espejo(226, 266, { fuerza: 3, fase: 2, retirar: true }, (b) => ({
    nombre: b === 'P' ? 'El miedo a la mayoría PP-Vox' : 'El miedo a la reedición del Gobierno',
    tema: b === 'P' ? 'DER' : 'ESP',
    texto: 'Si la proyección da al rival 176 apoyos o más, ganas 2 PV y tu socio baja 1. Si no, ganas 1 PV.',
    contexto: b === 'P' ? 'La posibilidad de Vox en el Consejo de Ministros moviliza a la izquierda.' : 'La posibilidad de cuatro años más del mismo Gobierno moviliza a la derecha.',
    efectos: [si({ c: 'mayoriaRival' }, [pv(2), socio('yo', -1)], [pv(1)])],
  })),

  ...espejo(227, 267, { fuerza: 3, fase: 2 }, (b) => ({
    nombre: b === 'P' ? 'La campaña del PSC' : 'Galicia, tierra del candidato',
    tema: b === 'P' ? 'ESP' : 'SER',
    texto: b === 'P' ? 'Coloca 3 presencia en Cataluña (máx. 2 por provincia).' : 'Coloca 3 presencia en Galicia (máx. 2 por provincia).',
    contexto: b === 'P' ? 'El socialismo catalán, primera fuerza en el Parlament, defiende la financiación singular.' : 'El candidato del PP gobernó la Xunta con cuatro mayorías absolutas y presume de su sanidad rural.',
    destino: { d: 'zona' },
    efectos: [colocar(3, { maxPor: 2, filtro: b === 'P' ? { zonas: ['CAT'] } : { provs: GALICIA }, reparto: true })],
  })),

  // —— noticias reales, también en espejo ——
  ...espejo(228, 268, { fuerza: 2, fase: 2, noticia: true }, (b) => ({
    nombre: b === 'P' ? 'El novio de Ayuso' : 'Begoña Gómez, al banquillo',
    tema: 'COR',
    texto: 'La corrupción salpica al rival: ganas 1 PV y sus cartas valen 1 PC menos esta semana.',
    contexto: b === 'P'
      ? 'La pareja de la presidenta madrileña espera juicio por un presunto fraude fiscal de 350.000 euros.'
      : 'En septiembre el juez Peinado envió a juicio con jurado a la esposa del presidente por malversación y tráfico de influencias. La Fiscalía había pedido el archivo.',
    efectos: [salpicar(), pv(1), activar('menosPCRival', 'semana')],
  })),

  ...espejo(229, 269, { fuerza: 2, fase: 2, noticia: true }, (b) => ({
    nombre: b === 'P' ? 'Las fotos del yate' : 'El Delcygate',
    tema: 'COR',
    texto: 'La corrupción salpica al rival: ganas 1 PV y le retiras 2 presencia en una provincia clave que controle. El Clima baja 1.',
    contexto: b === 'P'
      ? 'Vuelven a circular las fotos de los años noventa del candidato del PP con Marcial Dorado, condenado después por narcotráfico. Él siempre ha dicho que desconocía sus actividades.'
      : 'La madrugada de enero de 2020 en que el entonces ministro Ábalos recibió en Barajas a la vicepresidenta venezolana, que tenía prohibida la entrada en la UE.',
    destino: { d: 'provincia', filtro: { clave: true, controla: 'rival' } },
    efectos: [salpicar(), pv(1), retirar(2, { maxPor: 2, reparto: true }), clima(-1)],
  })),

  ...espejo(230, 270, { fuerza: 3, fase: 2, noticia: true }, (b) => ({
    nombre: b === 'P' ? 'Regularización extraordinaria' : 'Prioridad nacional',
    tema: b === 'P' ? 'INM' : 'SER',
    texto: b === 'P'
      ? 'Ganas 2 PV y el humor de Podemos mejora 1, pero el medidor de Vox sube 1.'
      : 'Ganas 1 PV, el medidor de Vox sube 1 y colocas 1 presencia en hasta 2 provincias de Levante y Baleares o Andalucía (en una zona).',
    contexto: b === 'P'
      ? 'El real decreto de abril, pactado con Podemos, abrió la regularización de unas 500.000 personas que ya vivían en España.'
      : 'Vox exige al PP la «prioridad nacional» en el acceso a las ayudas y a los servicios como condición para sus pactos autonómicos.',
    destino: b === 'P' ? undefined : { d: 'zona' },
    efectos: b === 'P'
      ? [pv(2), podemos(0, 1), socio('C', 1)]
      : [pv(1), socio('C', 1), colocar(2, { maxPor: 1, filtro: { zonas: ['LEV', 'AND'] }, reparto: true })],
  })),

  ...espejo(231, 271, { fuerza: 2, fase: 2, noticia: true }, (b) => ({
    nombre: b === 'P' ? 'Revuelta y el dinero de la DANA' : 'La sombra de los ERE',
    tema: 'COR',
    texto: b === 'P'
      ? 'La corrupción salpica al rival: ganas 1 PV y retiras 2 presencia conservadora en Levante y Baleares (máx. 1 por provincia).'
      : 'La corrupción salpica al rival: ganas 1 PV y retiras 2 presencia progresista en Andalucía (máx. 1 por provincia).',
    contexto: b === 'P'
      ? 'Exdirigentes de Revuelta, la asociación juvenil del entorno de Vox, denunciaron ante la Fiscalía el destino de las donaciones para la DANA. Vox se desvinculó y también denunció.'
      : 'La oposición rescata los ERE, la mayor causa de corrupción de la Junta socialista, aunque el Constitucional anuló en 2024 parte de las condenas.',
    efectos: [salpicar(), pv(1), retirar(2, { maxPor: 1, filtro: { zonas: [b === 'P' ? 'LEV' : 'AND'] } })],
  })),

  // La pinza: la vía difícil para que Podemos apoye al bloque conservador, y su antídoto
  ...espejo(232, 272, { fuerza: 2, fase: 2, noticia: true }, (b) => ({
    nombre: b === 'P' ? 'El decreto, otra vez' : 'La pinza',
    tema: b === 'P' ? 'SER' : 'ECO',
    texto: b === 'P'
      ? 'La pinza de Podemos con la derecha retrocede 1 y su humor mejora 1.'
      : 'Si Podemos está en ruptura con el PSOE (humor −2 o menos), la pinza avanza 1; si no, su humor empeora 1.',
    contexto: b === 'P'
      ? 'En junio de 2024 Podemos apoyó la segunda versión del decreto del subsidio de desempleo que había tumbado en enero.'
      : 'Como la «pinza» de Anguita y Aznar contra González en los noventa. En enero de 2024 los cinco diputados de Podemos tumbaron, junto a PP, Vox y UPN, el decreto del subsidio de desempleo.',
    efectos: b === 'P' ? [podemos(0, 1, -1)] : [si({ c: 'humorPodemosMax', n: -2 }, [podemos(0, 0, 1)], [podemos(0, -1)])],
  })),

  // —— comunes a los dos mazos ——
  ...enAmbos(297, { fuerza: 2, fase: 2 }, (b) => ({
    nombre: 'Campaña en redes',
    tema: b === 'P' ? 'DER' : 'INM',
    texto: 'Elige una zona: coloca 1 presencia en hasta 2 provincias de 8 escaños o más.',
    contexto: 'Vídeos cortos para un electorado que ya no ve la tele.',
    destino: { d: 'zona' },
    efectos: [colocar(2, { maxPor: 1, filtro: { minEscanos: 8 }, reparto: true })],
  })),

  ...enAmbos(292, { fuerza: 1, fase: 2 }, (b) => ({
    nombre: 'Tertulia radiofónica',
    tema: b === 'P' ? 'SER' : 'ECO',
    texto: 'Cada bloque tira un dado: el mayor gana 1 PV.',
    contexto: 'Los portavoces se enzarzan en la radio de la mañana.',
    efectos: [{ e: 'duelo', pv: 1 }],
  })),
];

// ———————————————————————————————————————————————————— RECTA FINAL (entran en la semana 7)
const RECTA_FINAL: Carta[] = [
  ...espejo(301, 321, { fuerza: 3, fase: 3 }, (b) => ({
    nombre: b === 'P' ? 'Escándalo en una consejería' : 'Escándalo en un ministerio',
    tema: 'COR',
    texto: 'La corrupción salpica al rival: pierde toda su presencia en una provincia de 8 escaños o menos y tú colocas 2.',
    contexto: b === 'P' ? 'Un caso en un gobierno autonómico de la oposición salta a los titulares.' : 'Un caso en un departamento del Gobierno salta a los titulares.',
    destino: { d: 'provincia', filtro: { maxEscanos: 8, conPresencia: 'rival' } },
    efectos: [salpicar(), { e: 'retirarTodo', enDestino: true }, colocar(2, { maxPor: 2, reparto: true })],
  })),

  ...espejo(302, 322, { fuerza: 2, fase: 3 }, (b) => ({
    nombre: b === 'P' ? 'Giro social' : 'Giro al centro',
    tema: b === 'P' ? 'SER' : 'ECO',
    texto: 'Ganas 1 PV y colocas 1 presencia en hasta 2 feudos del rival (en una zona).',
    contexto: b === 'P' ? 'El PSOE sale a buscar votos en territorio conservador.' : 'El PP sale a buscar votos en territorio progresista.',
    destino: { d: 'zona' },
    efectos: [pv(1), colocar(2, { maxPor: 1, filtro: { feudo: 'rival' }, reparto: true })],
  })),

  ...espejo(303, 323, { fuerza: 4, fase: 3 }, (b) => ({
    nombre: b === 'P' ? 'Patinazo de la oposición en directo' : 'Patinazo del Gobierno en directo',
    tema: b === 'P' ? 'ECO' : 'SER',
    texto: 'Ganas 2 PV y el Clima baja 1.',
    contexto: b === 'P' ? 'Un error del candidato rival con las cifras de la economía, repetido en bucle todo el día.' : 'Un error de un ministro con las listas de espera, repetido en bucle todo el día.',
    efectos: [pv(2), clima(-1)],
  })),

  ...espejo(305, 325, { fuerza: 3, fase: 3, retirar: true }, (b) => ({
    nombre: b === 'P' ? 'Caravana del Gobierno' : 'Caravana del cambio',
    tema: b === 'P' ? 'VIV' : 'ECO',
    texto: 'Ganas 1 acción más esta semana.',
    contexto: 'Una semana de campaña con tres mítines diarios.',
    efectos: [{ e: 'acciones', n: 1 }],
  })),

  ...espejo(306, 326, { fuerza: 4, fase: 3, retirar: true }, (b) => ({
    nombre: b === 'P' ? 'Campaña del optimismo' : 'Campaña de la esperanza',
    tema: b === 'P' ? 'ECO' : 'SER',
    texto: 'El Clima sube 1 y ganas 2 PV.',
    contexto: b === 'P' ? 'El Gobierno apuesta por el balance económico.' : 'La oposición apuesta por un mensaje de ilusión con los servicios públicos.',
    efectos: [clima(1), pv(2)],
  })),

  ...espejo(307, 327, { fuerza: 2, fase: 3 }, (b) => ({
    nombre: b === 'P' ? 'Desembarco en un feudo azul' : 'Desembarco en un feudo rojo',
    tema: b === 'P' ? 'DER' : 'ESP',
    texto: 'Elige un feudo del rival: le retiras 2 presencia allí y ganas 1 PV.',
    contexto: 'La campaña entra en el territorio más fiel del adversario.',
    destino: { d: 'provincia', filtro: { feudo: 'rival', conPresencia: 'rival' } },
    efectos: [retirar(2, { maxPor: 2, reparto: true }), pv(1)],
  })),

  ...espejo(311, 331, { fuerza: 3, fase: 3, retirar: true }, (b) => ({
    nombre: b === 'P' ? 'Asalto a Madrid' : 'Asalto a Barcelona',
    tema: b === 'P' ? 'ECO' : 'DER',
    texto: b === 'P' ? 'Coloca 3 presencia en Madrid.' : 'Coloca 3 presencia en Barcelona.',
    contexto: b === 'P' ? 'El Gobierno se vuelca en la plaza de la oposición, el motor económico del país.' : 'La oposición se vuelca en la plaza del Gobierno, hablando de derechos y libertades.',
    efectos: [colocar(3, { filtro: { provs: [b === 'P' ? '28' : '08'] } })],
  })),

  ...espejo(313, 333, { fuerza: 3, fase: 3, retirar: true }, (b) => ({
    nombre: b === 'P' ? 'Ofensiva en el Levante' : 'Ofensiva en Cataluña',
    tema: b === 'P' ? 'VIV' : 'ESP',
    texto: b === 'P'
      ? 'Ganas 1 PV y retiras 3 presencia conservadora en Levante y Baleares (máx. 1 por provincia).'
      : 'Ganas 1 PV y retiras 3 presencia progresista en Cataluña (máx. 1 por provincia).',
    contexto: 'Una semana entera de campaña en el territorio del rival.',
    efectos: [pv(1), retirar(3, { maxPor: 1, filtro: { zonas: [b === 'P' ? 'LEV' : 'CAT'] } })],
  })),

  ...espejo(314, 334, { fuerza: 3, fase: 3, retirar: true }, (b) => ({
    nombre: b === 'P' ? 'Gran acuerdo por la vivienda' : 'Gran acuerdo por la industria',
    tema: b === 'P' ? 'VIV' : 'ECO',
    texto: 'Coloca 3 presencia en una provincia clave.',
    contexto: b === 'P' ? 'Sindicatos y constructoras firman un plan de vivienda pública.' : 'Patronal e industria firman un plan de reindustrialización.',
    destino: { d: 'provincia', filtro: { clave: true } },
    efectos: [colocar(3, { maxPor: 3, reparto: true })],
  })),

  ...espejo(316, 336, { fuerza: 3, fase: 3, retirar: true }, (b) => ({
    nombre: b === 'P' ? 'Llamamiento al voto útil' : 'Voto útil al PP',
    tema: b === 'P' ? 'DER' : 'ESP',
    texto: b === 'P' ? 'El medidor de Frente Amplio baja 2 y ganas 1 PV.' : 'El medidor de Vox baja 2 y ganas 1 PV.',
    contexto: b === 'P' ? '«Cada voto a la izquierda del PSOE en una provincia pequeña es un escaño para la derecha».' : '«Para echar al Gobierno, el voto que suma es el del PP».',
    efectos: [socio('yo', -2), pv(1)],
  })),

  ...espejo(317, 337, { fuerza: 3, fase: 3, retirar: true }, (b) => ({
    nombre: b === 'P' ? 'Remontada' : 'Remontada del cambio',
    tema: b === 'P' ? 'SER' : 'INM',
    texto: 'Si el rival te aventaja por 5 o más, ganas 3 PV; si no, 1 PV.',
    contexto: 'El relato de que las encuestas vuelven a equivocarse.',
    efectos: [si({ c: 'rivalAventaja', n: 5 }, [pv(3)], [pv(1)])],
  })),

  ...espejo(318, 338, { fuerza: 2, fase: 3 }, (b) => ({
    nombre: b === 'P' ? 'Mitin de cierre en el sur' : 'Mitin de cierre en la capital',
    tema: b === 'P' ? 'SER' : 'ECO',
    texto: b === 'P'
      ? 'Coloca 2 presencia en una provincia clave de Andalucía y gana 1 PV.'
      : 'Coloca 2 presencia en una provincia clave de Madrid y Centro y gana 1 PV.',
    contexto: b === 'P' ? 'Cierre de campaña en un feudo histórico del sur.' : 'Cierre de campaña en la capital.',
    destino: { d: 'provincia', filtro: { clave: true, zonas: [b === 'P' ? 'AND' : 'MAD'] } },
    efectos: [colocar(2, { maxPor: 2, reparto: true }), pv(1)],
  })),

  ...espejo(319, 339, { fuerza: 3, fase: 3, retirar: true }, (b) => ({
    nombre: b === 'P' ? 'Pacto de investidura' : 'Mayoría suficiente',
    tema: b === 'P' ? 'ESP' : 'SER',
    texto: 'Una fuerza regional se acerca 2 a ti.',
    contexto: b === 'P' ? 'Negociaciones discretas con los nacionalistas para el día después.' : 'Negociaciones discretas con los regionalistas sobre la financiación de los servicios.',
    destino: { d: 'partido' },
    efectos: [{ e: 'afinidad', n: 2 }],
  })),

  ...espejo(320, 340, { fuerza: 3, fase: 3, retirar: true }, (b) => ({
    nombre: b === 'P' ? 'Marea roja' : 'Ola azul',
    tema: b === 'P' ? 'VIV' : 'ECO',
    texto: 'Si vas por delante en la Ventaja, ganas 2 PV; si no, colocas 1 presencia en hasta 2 provincias clave de una zona.',
    contexto: 'Las encuestas de la última semana hablan de tendencia.',
    destino: { d: 'zona' },
    efectos: [si({ c: 'yoAventajo', n: 1 }, [pv(2)], [colocar(2, { maxPor: 1, filtro: { clave: true }, reparto: true })])],
  })),

  ...enAmbos(347, { fuerza: 2, fase: 3 }, (b) => ({
    nombre: 'Indecisos de última hora',
    tema: b === 'P' ? 'SER' : 'ECO',
    texto: 'Si vas por detrás en la Ventaja, ganas 2 PV; si no, colocas 2 presencia donde más rinda.',
    contexto: 'Uno de cada cinco votantes decide en la última semana.',
    efectos: [si({ c: 'rivalAventaja', n: 1 }, [pv(2)], [colocar(2, { maxPor: 1 })])],
  })),
];

export const CARTAS_BLOQUES: Carta[] = [...PRECAMPANA, ...CAMPANA, ...RECTA_FINAL];
