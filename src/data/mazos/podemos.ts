// La Agenda de Podemos, el comodín: cada semana destapa una carta que calienta su tema y la sufre
// quien lidera la Ventaja («tú» en los textos). Casi siempre le perjudica.
import type { Carta } from '../../motor/tipos';
import { clima, como, dado, elegir, morada, podemos, pv, retirar, si, socio } from './ayudas';

export const CARTAS_PODEMOS: Carta[] = [
  morada(501, 'DER', {
    nombre: 'Podemos señala al favorito',
    texto: 'Podemos dispara contra quien va primero: el líder de la Ventaja pierde 1 PV.',
    contexto: '«Las encuestas dan por hecho un Gobierno; nosotros no».',
    efectos: [pv(-1)],
  }),
  morada(502, 'VIV', {
    nombre: 'Acampada morada en Sol',
    texto: 'Podemos acampa en la Puerta del Sol: marcador morado en Madrid, cada bloque pierde 1 presencia allí y el Clima baja 1 (nunca por debajo de 2).',
    contexto: 'Las tiendas de campaña vuelven al kilómetro cero.',
    efectos: [{ e: 'morado', n: 1, prov: '28' }, retirar(1, { de: 'ambos', filtro: { provs: ['28'] } }), clima(-1, 2)],
  }),
  morada(503, 'SER', {
    nombre: 'Votación trampa en el Congreso',
    texto: 'Una votación incómoda para el PSOE. El Progresista elige: apoyarla (humor de Podemos +1 y el Conservador gana 1 PV) o tumbarla (humor −1 y Podemos gana 1 de fuerza).',
    contexto: 'Una proposición de ley pensada para retratar al Gobierno.',
    efectos: [como('P', [elegir([
      ['Apoyarla: humor de Podemos +1 y el Conservador gana 1 PV', [podemos(0, 1), pv(-1)]],
      ['Tumbarla: humor −1 y Podemos gana 1 de fuerza', [podemos(1, -1)]],
    ])])],
  }),
  morada(504, 'SER', {
    nombre: 'Gira morada por Andalucía',
    texto: 'Podemos planta un marcador morado en la provincia andaluza más grande que controle cada bloque.',
    contexto: 'Una semana de actos de Podemos de Huelva a Almería.',
    efectos: [{ e: 'morado', n: 1, de: 'ambos', zona: 'AND' }],
  }),
  morada(505, 'VIV', {
    nombre: 'Oferta envenenada a Sánchez',
    texto: 'Apoyo a cambio de un programa de máximos. El Progresista elige: aceptar (humor de Podemos +2 y el Conservador gana 2 PV) o rechazar (humor −1 y Podemos gana 1 de fuerza).',
    contexto: '«Si quiere nuestros votos, que firme».',
    efectos: [como('P', [elegir([
      ['Aceptar: humor de Podemos +2 y el Conservador gana 2 PV', [podemos(0, 2), pv(-2)]],
      ['Rechazar: humor −1 y Podemos gana 1 de fuerza', [podemos(1, -1)]],
    ])])],
  }),
  morada(506, 'DER', {
    nombre: 'Podemos carga contra el PP y Vox',
    texto: 'Podemos centra sus ataques en la derecha: el Conservador pierde 1 PV y Vox crece con la polarización (+1).',
    contexto: 'Un mitin morado dedicado entero a la oposición.',
    efectos: [como('C', [pv(-1)]), socio('C', 1)],
  }),
  morada(507, 'COR', {
    nombre: 'Podemos pide la cabeza de un ministro',
    texto: 'Podemos exige una dimisión en el Gobierno: el Progresista pierde 1 PV y el humor de Podemos empeora 1.',
    contexto: '«O dimite o no hay nada que hablar».',
    efectos: [como('P', [pv(-1)]), podemos(0, -1)],
  }),
  morada(508, 'VIV', {
    nombre: 'Podemos denuncia a la banca',
    texto: 'Una campaña contra los beneficios bancarios que salpica a todos: cada bloque pierde 1 presencia en las 2 provincias más grandes donde la tenga.',
    contexto: 'Los beneficios récord de la banca, en el centro del mitin morado.',
    efectos: [retirar(2, { maxPor: 1, de: 'ambos', filtro: { minEscanos: 10 } })],
  }),
  morada(509, 'DER', {
    nombre: 'Encuesta propia de Podemos',
    texto: 'Dado: con 1-2 Podemos pierde 1 de fuerza; con 3-4, nada; con 5-6 gana 1 de fuerza y su humor empeora 1.',
    contexto: 'Un sondeo encargado por Podemos que nadie se cree… o sí.',
    efectos: [dado([[2, [podemos(-1, 0)]], [4, []], [6, [podemos(1, -1)]]])],
  }),
  morada(510, 'DER', {
    nombre: 'Podemos tiende puentes con ERC y EH Bildu',
    texto: 'ERC y EH Bildu crecen un 5% a costa de los grandes bloques.',
    contexto: 'Una foto conjunta de las izquierdas soberanistas y Podemos.',
    efectos: [{ e: 'regional', partido: 'ERC', pct: 0.05 }, { e: 'regional', partido: 'BILDU', pct: 0.05 }],
  }),
  morada(511, 'SER', {
    nombre: 'Podemos no apoyará a nadie gratis',
    texto: 'Su humor se acerca 1 a «exigente» (abstención) y Podemos gana 1 de fuerza.',
    contexto: '«Primero el programa, después los nombres».',
    efectos: [si({ c: 'humorPodemosMin', n: 1 }, [podemos(0, -1)], [si({ c: 'humorPodemosMax', n: -1 }, [podemos(0, 1)])]), podemos(1, 0)],
  }),
  morada(512, 'SER', {
    nombre: 'Podemos exige una vicepresidencia',
    texto: 'El Progresista elige: aceptar (humor de Podemos +1 y el Conservador gana 1 PV) o rechazar (humor −1).',
    contexto: '«Queremos estar en el Consejo de Ministros».',
    efectos: [como('P', [elegir([
      ['Aceptar: humor de Podemos +1 y el Conservador gana 1 PV', [podemos(0, 1), pv(-1)]],
      ['Rechazar: el humor de Podemos empeora 1', [podemos(0, -1)]],
    ])])],
  }),
  morada(513, 'ESP', {
    nombre: 'Podemos rompe una negociación',
    texto: 'El PNV y Junts se alejan 1 de quien tuvieran más cerca.',
    contexto: 'Una filtración de Podemos dinamita una mesa discreta.',
    efectos: [{ e: 'afinidadNeutral', partido: 'PNV' }, { e: 'afinidadNeutral', partido: 'JUNTS' }],
  }),
  morada(514, 'DER', {
    nombre: 'Vídeo viral morado',
    texto: 'Un vídeo de Podemos arrasa: Podemos gana 1 de fuerza y quien va por detrás en la Ventaja gana 1 PV.',
    contexto: 'Millones de reproducciones en una noche.',
    efectos: [podemos(1, 0), { e: 'aRezagado', efectos: [pv(1)] }],
  }),
  morada(515, 'ESP', {
    nombre: 'Podemos hace campaña con ERC',
    texto: 'ERC crece un 5% y Podemos planta un marcador morado en la provincia catalana más grande que controle cada bloque.',
    contexto: 'En Cataluña, Podemos concurre junto a ERC.',
    efectos: [{ e: 'regional', partido: 'ERC', pct: 0.05 }, { e: 'morado', n: 1, de: 'ambos', zona: 'CAT' }],
  }),
  morada(516, 'SER', {
    nombre: 'Podemos baja el tono',
    texto: 'El Clima sube 1 y el humor de Podemos mejora 1.',
    contexto: 'Una semana sin choques con el PSOE.',
    efectos: [clima(1), podemos(0, 1)],
  }),
  morada(517, 'VIV', {
    nombre: 'Podemos irrumpe en la agenda',
    texto: 'Quien va por detrás en la Ventaja retira 2 presencia de su rival en provincias clave (máx. 1 por provincia).',
    contexto: 'Una propuesta morada que obliga a todos a posicionarse.',
    efectos: [{ e: 'aRezagado', efectos: [retirar(2, { maxPor: 1, filtro: { clave: true } })] }],
  }),
  morada(518, 'DER', {
    nombre: 'Marcha morada',
    texto: 'Marcador morado en la provincia más grande que controle quien lidera la Ventaja, y el Clima baja 1 (nunca por debajo de 2).',
    contexto: 'Una marcha que acaba frente a la sede del favorito.',
    efectos: [{ e: 'morado', n: 1, de: 'lider' }, clima(-1, 2)],
  }),
  morada(519, 'SER', {
    nombre: 'Podemos tumba un decreto con la derecha',
    texto: 'Sus votos, junto a los de PP y Vox, tumban una ley del Gobierno: el Progresista pierde 1 PV y, con Podemos en ruptura (humor −2 o menos), la pinza avanza 1.',
    contexto: 'No sería la primera vez: en enero de 2024 sus cinco diputados tumbaron así el decreto del subsidio.',
    efectos: [como('P', [pv(-1)]), si({ c: 'humorPodemosMax', n: -2 }, [podemos(0, 0, 1)])],
  }),
  morada(520, 'DER', {
    nombre: 'Podemos, ni con Vox ni con el PP',
    texto: 'Podemos recuerda que nunca gobernará con la derecha: el Conservador pierde 1 PV y la pinza retrocede 1.',
    contexto: '«Una cosa es votar contra un decreto y otra muy distinta abrirle la puerta a Vox».',
    efectos: [como('C', [pv(-1)]), podemos(0, 0, -1)],
  }),
  // —— los antiguos comodines morados, ahora también en la Agenda ——
  morada(401, 'VIV', {
    nombre: 'Podemos rompe la baraja',
    texto: 'Podemos endurece sus condiciones: gana 1 de fuerza, su humor empeora 1 y planta un marcador morado en la provincia más grande del líder.',
    contexto: 'Ni con el PSOE ni contra él: con sus propias condiciones.',
    efectos: [podemos(1, -1), { e: 'morado', n: 1, de: 'lider' }],
  }),
  morada(402, 'VIV', {
    nombre: 'Movilización en la calle',
    texto: 'Podemos llena las calles: gana 1 de fuerza y cada bloque pierde 1 presencia en Madrid y en Barcelona.',
    contexto: 'Una manifestación que nadie controla.',
    efectos: [podemos(1, 0), retirar(2, { maxPor: 1, de: 'ambos', filtro: { provs: ['28', '08'] } })],
  }),
  morada(403, 'VIV', {
    nombre: 'Ultimátum al PSOE',
    texto: 'Podemos exige compromisos por escrito. El Progresista elige: ceder (el Conservador gana 2 PV) o plantarse (el humor de Podemos empeora 2).',
    contexto: '«Sin vivienda pública no hay investidura».',
    efectos: [como('P', [elegir([
      ['Ceder a Podemos: el Conservador gana 2 PV', [pv(-2)]],
      ['Plantarse: el humor de Podemos empeora 2', [podemos(0, -2)]],
    ])])],
  }),
  morada(404, 'DER', {
    nombre: 'Podemos señala a la derecha',
    texto: 'Podemos centra su campaña contra el PP y Vox. El Conservador elige: responder (Vox sube 2 con la polarización) o ignorarlo (el Progresista gana 2 PV).',
    contexto: '«El peligro es un Gobierno del PP con Vox».',
    efectos: [como('C', [elegir([
      ['Responder: el medidor de Vox sube 2', [socio('C', 2)]],
      ['Ignorarlo: el Progresista gana 2 PV', [pv(-2)]],
    ])])],
  }),
  morada(405, 'DER', {
    nombre: 'Vetos cruzados',
    texto: 'Podemos y Frente Amplio se enzarzan: Frente Amplio baja 1 y Podemos gana 1 de fuerza. El ruido en la izquierda da alas a Vox (+1).',
    contexto: 'La izquierda del PSOE, otra vez dividida.',
    efectos: [socio('P', -1), podemos(1, 0), socio('C', 1)],
  }),
  morada(406, 'SER', {
    nombre: 'Podemos tiende la mano',
    texto: 'El humor de Podemos mejora 2, pero pierde 1 de fuerza: parte de su electorado vuelve al PSOE.',
    contexto: 'Podemos pactó con el PSOE la regularización extraordinaria: «lo primero es que no gobiernen PP y Vox».',
    efectos: [podemos(-1, 2)],
  }),
  morada(407, 'COR', {
    nombre: 'Canal Red, a pleno rendimiento',
    texto: 'Podemos dispara contra todos: el Clima baja 1 (nunca por debajo de 2) y cada bloque retira 2 presencia rival (máx. 1 por provincia).',
    contexto: 'La televisión impulsada por Pablo Iglesias dispara contra «el bipartidismo», contra el PSOE y contra la derecha.',
    efectos: [clima(-1, 2), { e: 'aCadaBloque', efectos: [retirar(2, { maxPor: 1 })] }],
  }),
  morada(408, 'VIV', {
    nombre: 'Asambleas moradas',
    texto: 'Podemos gana 1 de fuerza y planta un marcador morado en la provincia más grande que controle cada bloque.',
    contexto: 'Círculos y asambleas vuelven a llenar los locales de barrio.',
    efectos: [podemos(1, 0), { e: 'morado', n: 1, de: 'ambos' }],
  }),
  morada(409, 'SER', {
    nombre: 'La llave morada',
    texto: 'Dado: con 1-2 Podemos no apoyará a Sánchez sin acuerdo (humor −2); con 3-4, nada; con 5-6 pacta in extremis (humor +2).',
    contexto: 'Sus escaños pueden decidir la investidura.',
    efectos: [dado([[2, [podemos(0, -2)]], [4, []], [6, [podemos(0, 2)]]])],
  }),
  morada(410, 'DER', {
    nombre: 'Remontada morada',
    texto: 'Podemos gana 2 de fuerza y la polarización también da alas a Vox (+1).',
    contexto: 'Los mítines morados se llenan en la recta final.',
    efectos: [podemos(2, 0), socio('C', 1)],
  }),
];
