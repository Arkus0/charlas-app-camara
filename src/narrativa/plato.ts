// El plató del fin de semana: una crónica que se va contando semana a semana con lo que ha pasado en la partida.
// No enumera cartas: busca la historia de la semana (quién sube, qué cambia en la proyección, dónde se rompe algo)
// y la conecta con las semanas anteriores. Cada análisis partidista se escribe una sola vez en función del bloque,
// así que las dos miradas son simétricas por construcción.
import { CARTAS } from '../data/cartas';
import { PLATO, type Personaje } from '../data/plato';
import { PARTIDOS } from '../data/partidos';
import { PROV } from '../data/provincias';
import { PROVINCIAS } from '../data/provincias';
import { proyectar, type Resultado } from '../engine/electoral';
import type { Bando, Estado, FotoTurno, RegionalId, Suceso, ZonaId } from '../engine/tipos';
import { RIVAL } from '../engine/tipos';

export interface Intervencion {
  quien: Personaje['id'];
  texto: string;
}

export interface Segmento {
  titulo: string;
  rotulo: string; // el rótulo de la pantalla
  intervenciones: Intervencion[];
}

// ————————————————————————————————————— vocabulario de cada bloque
const V = {
  P: {
    bloque: 'el bloque progresista', Bloque: 'El bloque progresista', lado: 'la izquierda', lider: 'Sánchez',
    papel: 'el Gobierno', Papel: 'El Gobierno', partido: 'el PSOE', socio: 'Frente Amplio', sede: 'Ferraz', pareja: 'PSOE y Frente Amplio',
    de: 'del bloque progresista', a: 'al bloque progresista',
  },
  C: {
    bloque: 'el bloque conservador', Bloque: 'El bloque conservador', lado: 'la derecha', lider: 'Feijóo',
    papel: 'la oposición', Papel: 'La oposición', partido: 'el PP', socio: 'Vox', sede: 'Génova', pareja: 'PP y Vox',
    de: 'del bloque conservador', a: 'al bloque conservador',
  },
} as const;

const ZONA_TXT: Record<ZonaId | 'CIS' | 'VAC', string> = {
  AND: 'Andalucía', CAT: 'Cataluña', MAD: 'Madrid y Centro', LEV: 'Levante y Baleares', INT: 'el Interior', NOR: 'la Cornisa Norte',
  CAN: 'Canarias, Ceuta y Melilla', CIS: 'el Barómetro del CIS', VAC: 'la España vaciada',
};

/** «de Andalucía», «del Interior», «del Barómetro del CIS». */
const deZona = (z: ZonaId | 'CIS' | 'VAC') => ('de ' + ZONA_TXT[z]).replace(/^de el /, 'del ');

const NOMBRE_HABLADO: Record<string, string> = { '38': 'Santa Cruz de Tenerife', '13': 'Ciudad Real', '07': 'Baleares', '03': 'Alicante', '12': 'Castellón', '46': 'Valencia', '01': 'Álava' };
const prov = (id: string) => NOMBRE_HABLADO[id] ?? PROV[id].corto;

const HUMOR: Record<number, string> = { [-3]: 'en guerra abierta con el PSOE', [-2]: 'en ruptura con el PSOE', [-1]: 'enfadado', 0: 'en modo exigente', 1: 'dispuesto a negociar', 2: 'en modo socio', 3: 'como socio firme' };
const votoPodemosTxt = (h: number) => (h >= 1 ? 'votaría sí a Sánchez' : h === 0 ? 'se abstendría con Sánchez' : 'votaría no a Sánchez');
const FECHAS_HABLADAS: Record<number, string> = {
  1: 'del 6 al 11 de octubre', 2: 'del 12 al 18 de octubre', 3: 'del 19 al 25 de octubre', 4: 'del 26 de octubre al 1 de noviembre',
  5: 'del 2 al 8 de noviembre', 6: 'del 9 al 15 de noviembre', 7: 'del 16 al 22 de noviembre', 8: 'del 23 al 28 de noviembre',
};
const puntos = (n: number) => `${n} ${Math.abs(n) === 1 ? 'punto' : 'puntos'}`;
const NUM = ['cero', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho'];
const semanas = (n: number) => (n === 1 ? 'una semana' : `${NUM[n] ?? n} semanas`);

// ————————————————————————————————————— azar determinista para variar los textos
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function selector(e: Estado, t: number) {
  const sal = e.historia.length ? `${e.historia[0].escanos.PP}-${e.historia[0].escanos.PSOE}-${e.historia[0].ventaja}` : '0';
  return <T,>(clave: string, xs: T[]): T => xs[hash(`${sal}|${t}|${clave}`) % xs.length];
}

const favor = (v: number, b: Bando) => (b === 'C' ? v : -v);

// ————————————————————————————————————— análisis de una semana
interface Analisis {
  t: number;
  foto: FotoTurno;
  prev: FotoTurno | null;
  dv: number; // a favor del Conservador
  gana: Bando | null; // quién gana la semana en Ventaja
  lider: Bando | null;
  liderAntes: Bando | null;
  proy: Bando | null;
  proyAntes: Bando | null;
  sucesos: Suceso[];
  flips: { id: string; antes: Bando | null; despues: Bando | null; morado: boolean }[];
  ofensivas: Record<Bando, { n: number; ok: number }>;
  batallas: Extract<Suceso, { s: 'batalla' }>[];
  encuestas: Extract<Suceso, { s: 'encuesta' }>[];
  debate: Extract<Suceso, { s: 'debateTV' }> | null;
  carrera: Extract<Suceso, { s: 'carrera' }>[];
  exigencia: Extract<Suceso, { s: 'exigencia' }>[];
  culpaClima: Record<Bando, number>;
  climaMin: number;
  agenda: number | null;
  portadas: Partial<Record<Bando, number>>;
  anulada: Bando | null;
  efectos: Extract<Suceso, { s: 'efecto' }>[];
  atascos: Extract<Suceso, { s: 'atasco' }>[];
  negocia: Extract<Suceso, { s: 'negocia' }>[];
  listas: number | null;
  racha: { bando: Bando | null; n: number };
  deltaEsc: Record<string, number>;
}

function bloqueDe(v: number): Bando | null {
  return v > 0 ? 'C' : v < 0 ? 'P' : null;
}

function analizar(e: Estado, t: number): Analisis | null {
  const i = e.historia.findIndex((h) => h.turno === t);
  if (i < 0) return null;
  const foto = e.historia[i];
  const prev = i > 0 ? e.historia[i - 1] : null;
  const s = foto.sucesos;
  const dv = foto.ventaja - (prev?.ventaja ?? 0);
  const flips: Analisis['flips'] = [];
  if (prev) {
    for (const p of PROVINCIAS) {
      const a = prev.controles[p.id] ?? null;
      const d = foto.controles[p.id] ?? null;
      if (a !== d) flips.push({ id: p.id, antes: a, despues: d, morado: (foto.morado?.[p.id] ?? 0) > (prev.morado?.[p.id] ?? 0) });
    }
    flips.sort((x, y) => PROV[y.id].escanos - PROV[x.id].escanos);
  }
  const ofensivas = { P: { n: 0, ok: 0 }, C: { n: 0, ok: 0 } };
  const culpaClima = { P: 0, C: 0 };
  let climaMin = prev?.clima ?? 5;
  const portadas: Partial<Record<Bando, number>> = {};
  let anulada: Bando | null = null;
  let agenda: number | null = null;
  let listas: number | null = null;
  for (const x of s) {
    if (x.s === 'ofensiva') { ofensivas[x.bando].n++; if (x.exito) ofensivas[x.bando].ok++; }
    if (x.s === 'clima') { climaMin = Math.min(climaMin, x.despues); if (x.despues < x.antes && x.culpable) culpaClima[x.culpable] += x.antes - x.despues; }
    if (x.s === 'portada') { portadas[x.bando] = x.carta; if (x.anulada) anulada = x.bando; }
    if (x.s === 'agenda') agenda = x.carta;
    if (x.s === 'listas') listas = x.dado;
  }
  // racha: semanas seguidas ganando Ventaja el mismo bloque
  let racha = { bando: bloqueDe(dv), n: 0 };
  if (racha.bando) {
    for (let k = i; k >= 1; k--) {
      const d = e.historia[k].ventaja - e.historia[k - 1].ventaja;
      if (bloqueDe(d) === racha.bando) racha.n++;
      else break;
    }
  }
  const deltaEsc: Record<string, number> = {};
  for (const k of ['PP', 'PSOE', 'VOX', 'SUMAR', 'PODEMOS'] as const) deltaEsc[k] = Math.round((foto.escanos[k] ?? 0) - (prev?.escanos[k] ?? foto.escanos[k] ?? 0));
  return {
    t, foto, prev, dv, gana: bloqueDe(dv), lider: bloqueDe(foto.ventaja), liderAntes: prev ? bloqueDe(prev.ventaja) : null,
    proy: foto.ganadorProyectado, proyAntes: prev?.ganadorProyectado ?? null, sucesos: s, flips, ofensivas,
    batallas: s.filter((x): x is Extract<Suceso, { s: 'batalla' }> => x.s === 'batalla'),
    encuestas: s.filter((x): x is Extract<Suceso, { s: 'encuesta' }> => x.s === 'encuesta'),
    debate: (s.find((x) => x.s === 'debateTV') as Analisis['debate']) ?? null,
    carrera: s.filter((x): x is Extract<Suceso, { s: 'carrera' }> => x.s === 'carrera'),
    exigencia: s.filter((x): x is Extract<Suceso, { s: 'exigencia' }> => x.s === 'exigencia'),
    culpaClima, climaMin, agenda, portadas, anulada,
    efectos: s.filter((x): x is Extract<Suceso, { s: 'efecto' }> => x.s === 'efecto'),
    atascos: s.filter((x): x is Extract<Suceso, { s: 'atasco' }> => x.s === 'atasco'),
    negocia: s.filter((x): x is Extract<Suceso, { s: 'negocia' }> => x.s === 'negocia'),
    listas, racha, deltaEsc,
  };
}

// ————————————————————————————————————— piezas comunes
function escanosTxt(f: FotoTurno): string {
  const r = (k: string) => Math.round(f.escanos[k as keyof typeof f.escanos] ?? 0);
  return `PP ${r('PP')}, PSOE ${r('PSOE')}, Vox ${r('VOX')}, Frente Amplio ${r('SUMAR')} y Podemos ${r('PODEMOS')}`;
}

function proyeccionTxt(f: FotoTurno, el: ReturnType<typeof selector>): string {
  const g = f.ganadorProyectado;
  if (!g) {
    return el('proy0', [
      'Hoy nadie reuniría los apoyos para una investidura: bloqueo y repetición electoral.',
      'Con este Congreso no habría investidura posible. Bloqueo.',
      'Ni uno ni otro: el Congreso que sale hoy no inviste a nadie.',
    ]);
  }
  const ap = f.apoyos[g];
  return el('proy' + g, [
    `Con estos números, hoy ${V[g].lider} saldría investido con ${ap} síes.`,
    `La aritmética de hoy da la investidura a ${V[g].lider}: ${ap} apoyos.`,
    `Si se votara hoy, ${V[g].lider} sería presidente con ${ap} votos a favor${ap >= 176 ? ', mayoría absoluta' : ', en segunda votación'}.`,
  ]);
}

/** El mayor movimiento de escaños de la semana, contado como noticia. */
function movimientoEscanos(a: Analisis): string | null {
  const nombres: Record<string, string> = { PP: 'el PP', PSOE: 'el PSOE', VOX: 'Vox', SUMAR: 'Frente Amplio', PODEMOS: 'Podemos' };
  const k = Object.keys(a.deltaEsc).sort((x, y) => Math.abs(a.deltaEsc[y]) - Math.abs(a.deltaEsc[x]))[0];
  const d = a.deltaEsc[k];
  if (!a.prev || Math.abs(d) < 2) return null;
  return d > 0 ? `${cap(nombres[k])} es quien más crece: gana ${d} escaños en siete días.` : `${cap(nombres[k])} es quien más cae: pierde ${-d} escaños en siete días.`;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function ventajaTxt(v: number): string {
  const b = bloqueDe(v);
  if (!b) return 'La Ventaja demoscópica está en empate técnico.';
  return `La Ventaja demoscópica está en ${puntos(Math.abs(v))} a favor ${V[b].de}.`;
}

/** La provincia que más ruido ha hecho esta semana. */
function flipPrincipal(a: Analisis): Analisis['flips'][number] | null {
  return a.flips.find((f) => PROV[f.id].clave) ?? a.flips[0] ?? null;
}

function flipTxt(f: Analisis['flips'][number], el: ReturnType<typeof selector>): string {
  const n = prov(f.id);
  const esc = PROV[f.id].escanos;
  if (f.despues && f.antes) {
    return el('flipAB' + f.id, [
      `${n} cambia de manos: era ${f.antes === 'P' ? 'progresista' : 'conservadora'} y ahora la controla ${V[f.despues].bloque}. Son ${esc} escaños.`,
      `El vuelco de la semana está en ${n}: pasa ${V[f.antes].de} ${V[f.despues].a}, ${esc} escaños en juego.`,
    ]);
  }
  if (f.despues) {
    return el('flip0B' + f.id, [
      `${V[f.despues].Bloque} se hace con ${n}, que estaba en el aire: ${esc} escaños.`,
      `${n}, que nadie controlaba, cae del lado ${f.despues === 'P' ? 'progresista' : 'conservador'}. ${esc} escaños.`,
    ]);
  }
  if (f.morado) {
    return el('flipM' + f.id, [
      `Podemos ha desembarcado en ${n} y ${V[f.antes!].bloque} ya no la controla: un territorio que se daba por seguro vuelve a estar en el aire.`,
      `La irrupción de Podemos en ${n} deja ${V[f.antes!].a} sin el control de una plaza de ${esc} escaños.`,
    ]);
  }
  return el('flipA0' + f.id, [
    `${V[f.antes!].Bloque} pierde el control de ${n}: ${esc} escaños que vuelven a estar en disputa.`,
    `${n} se le escapa ${V[f.antes!].a}. No la ha ganado nadie todavía, pero ya no es suya.`,
  ]);
}

// ————————————————————————————————————— apertura y titular
function apertura(a: Analisis, el: ReturnType<typeof selector>): string {
  const p = PLATO.personajes;
  const base = `Buenas noches, esto es ${PLATO.programa}.`;
  switch (a.t) {
    case 1: return el('ap1', [
      `${base} Primera semana desde que el BOE publicó la convocatoria: arranca la carrera hacia el 29 de noviembre y estos son sus primeros movimientos.`,
      `${base} Ocho semanas por delante hasta el 29N. Hoy hacemos la primera foto de una precampaña que acaba de empezar.`,
    ]);
    case 3: return el('ap3', [
      `${base} Semana del cierre de listas: a partir de ahora, ya no hay marcha atrás en las candidaturas.`,
      `${base} Se cierran las listas y con ellas las estrategias. Veamos cómo llega cada uno.`,
    ]);
    case 4: return el('ap4', [
      `${base} Entramos en la campaña de verdad: los temas que hasta ahora eran ruido de fondo pasan al primer plano.`,
      `${base} Cuarta semana. Se acabó el calentamiento: ahora entran en juego los grandes temas.`,
    ]);
    case 6: return el('ap6', [
      `${base} Ha sonado la pegada de carteles: campaña oficial, quince días y ni uno más.`,
      `${base} Desde el viernes ya es campaña oficial. Las caras están en las farolas y los números, en esta mesa.`,
    ]);
    case 7: return el('ap7', [
      `${base} La semana del cara a cara. Lo que se juega en un plató de televisión puede valer más que un mes de mítines.`,
      `${base} Semana de cara a cara y de recta final. Vamos con ${p.demo.nombre}, que trae los números.`,
    ]);
    case 8: return el('ap8', [
      `${base} Última semana. Debate a cuatro, veda demoscópica y jornada de reflexión: esto se decide ya.`,
      `${base} Se acabó la campaña. Mañana es día de reflexión y el domingo, urnas. Hacemos el último repaso.`,
    ]);
    default: return el('apx', [
      `${base} Semana ${a.t} de campaña, ${FECHAS_HABLADAS[a.t]}. Vamos con lo que ha pasado.`,
      `${base} Repasamos la semana ${FECHAS_HABLADAS[a.t]}, que ha dado para mucho.`,
      `${base} Quedan ${semanas(8 - a.t + 1)} para el 29N. Esto es lo que ha cambiado.`,
    ]);
  }
}

function titular(a: Analisis, el: ReturnType<typeof selector>): { rotulo: string; texto: string } {
  // 1. Cambia quién sería investido
  if (a.prev && a.proy !== a.proyAntes) {
    if (a.proy) {
      return {
        rotulo: `${V[a.proy].lider.toUpperCase()}, A LAS PUERTAS DE LA INVESTIDURA`,
        texto: el('tit-proy', [
          `La noticia de la semana es que la proyección cambia de dueño: hoy los números dan la investidura a ${V[a.proy].lider}${a.proyAntes ? `, cuando hace siete días se la daban a ${V[a.proyAntes].lider}` : ', cuando hace siete días no la tenía nadie'}.`,
          `Giro en el Congreso que dibujan las encuestas: ${V[a.proy].lider} ${a.proyAntes ? 'le arrebata' : 'consigue'} la mayoría para la investidura${a.proyAntes ? ` a ${V[a.proyAntes].lider}` : ''}.`,
        ]),
      };
    }
    return {
      rotulo: 'BLOQUEO EN EL HORIZONTE',
      texto: el('tit-bloq', [
        `${V[a.proyAntes!].lider} pierde esta semana la mayoría que le daban las encuestas. Hoy no habría investidura para nadie.`,
        `Se evapora la mayoría de ${V[a.proyAntes!].lider}: el Congreso de hoy está bloqueado.`,
      ]),
    };
  }
  // 2. Debate televisado
  if (a.debate) {
    const g = a.debate.ganador;
    const tipo = a.debate.tipo === 'cara' ? 'el cara a cara' : 'el debate a cuatro';
    if (!g) return { rotulo: `TABLAS EN ${tipo.toUpperCase()}`, texto: el('tit-deb0', [`${cap(tipo)} acaba en tablas: ninguno de los dos consigue el golpe que buscaba.`, `Nadie gana ${tipo}. Mucho ruido y ningún vencedor claro.`]) };
    return {
      rotulo: `${V[g].lider.toUpperCase()} SE IMPONE EN ${tipo.toUpperCase()}`,
      texto: el('tit-deb', [
        `${V[g].lider} gana ${tipo}${a.debate.dif >= 4 ? ' con claridad' : ' por la mínima'}, y eso se nota en la Ventaja.`,
        `${cap(tipo)} tiene ganador: ${V[g].lider}${a.debate.dif >= 4 ? ', y por bastante' : ', aunque por poco'}.`,
      ]),
    };
  }
  // 3. Cambio de líder en la Ventaja
  if (a.prev && a.lider && a.liderAntes && a.lider !== a.liderAntes) {
    return {
      rotulo: `${V[a.lider].Bloque.toUpperCase()} TOMA LA DELANTERA`,
      texto: el('tit-lid', [
        `Adelantamiento: ${V[a.lider].bloque} pasa a liderar la Ventaja demoscópica por primera vez en ${a.t > 2 ? 'varias semanas' : 'la campaña'}.`,
        `Cambio en cabeza: ${V[a.lider].bloque} supera ${V[RIVAL[a.lider]].a} en la Ventaja.`,
      ]),
    };
  }
  // 4. Semana grande en Ventaja
  if (a.gana && Math.abs(a.dv) >= 4) {
    return {
      rotulo: `SEMANA DE ${V[a.gana].lider.toUpperCase()}: ${Math.abs(a.dv)} PUNTOS`,
      texto: el('tit-dv', [
        `Semana redonda para ${V[a.gana].bloque}: ${puntos(Math.abs(a.dv))} de Ventaja en siete días.`,
        `${V[a.gana].Bloque} se lleva la semana de calle: ${puntos(Math.abs(a.dv))}.`,
        `Golpe en la Ventaja: ${V[a.gana].bloque} suma ${puntos(Math.abs(a.dv))} y ${V[RIVAL[a.gana]].bloque} no encuentra respuesta.`,
      ]),
    };
  }
  // 5. Guerra sucia
  if (a.foto.clima <= 2) {
    return {
      rotulo: 'LA CAMPAÑA, AL BORDE DE LA RUPTURA',
      texto: el('tit-cli', [
        'El clima de campaña está en guerra sucia. Un paso más y el votante castigará a quien lo dé.',
        'Hemos llegado a la guerra sucia. Los dos lo saben: el primero que tense un poco más lo pagará en las urnas.',
      ]),
    };
  }
  // 6. Podemos se mueve
  if (a.prev && votoPodemosTxt(a.prev.podemos.humor) !== votoPodemosTxt(a.foto.podemos.humor)) {
    return {
      rotulo: 'PODEMOS CAMBIA SU VOTO',
      texto: el('tit-pod', [
        `Podemos cambia de posición: hoy ${votoPodemosTxt(a.foto.podemos.humor)}, y eso mueve toda la aritmética de la investidura.`,
        `El comodín se ha movido. Podemos ${votoPodemosTxt(a.foto.podemos.humor)} y los dos bloques recalculan.`,
      ]),
    };
  }
  // 7. Un vuelco provincial
  const f = flipPrincipal(a);
  if (f && PROV[f.id].escanos >= 7) return { rotulo: `${prov(f.id).toUpperCase()} CAMBIA DE MANOS`, texto: flipTxt(f, el) };
  // 8. Encuesta
  const enc = [...a.encuestas].filter((x) => !x.veda).sort((x, y) => Math.abs(y.neto) - Math.abs(x.neto))[0];
  if (enc && Math.abs(enc.neto) >= 3) {
    const g: Bando = enc.neto > 0 ? 'C' : 'P';
    return {
      rotulo: `${ZONA_TXT[enc.zona].toUpperCase()} SE TIÑE DE ${g === 'P' ? 'ROJO' : 'AZUL'}`,
      texto: el('tit-enc', [
        `La encuesta ${deZona(enc.zona)} ha sido una buena noticia para ${V[g].bloque}: ${puntos(Math.abs(enc.neto))} de golpe.`,
        `${cap(ZONA_TXT[enc.zona])} habla y lo hace a favor ${V[g].de}.`,
      ]),
    };
  }
  // 9. Semana tranquila
  return {
    rotulo: a.gana ? `${V[a.gana].Bloque.toUpperCase()} ARAÑA ${Math.abs(a.dv)}` : 'SEMANA DE TRINCHERAS',
    texto: el('tit-calma', [
      'Semana de trincheras: mucho movimiento sobre el terreno y pocas variaciones de fondo.',
      'Ha sido una semana de desgaste más que de golpes. Pero el desgaste también cuenta.',
      'No ha habido un gran titular, y a veces eso es en sí mismo la noticia.',
    ]),
  };
}

// ————————————————————————————————————— los números
function demoscopa(a: Analisis, el: ReturnType<typeof selector>): string {
  const partes: string[] = [];
  partes.push(el('demo-intro', ['Vamos a los números.', 'Así queda el Congreso esta semana.', 'Proyección de esta semana:']) + ` ${escanosTxt(a.foto)}.`);
  partes.push(`${V.C.pareja} suman ${a.foto.bloque.C}; ${V.P.pareja}, ${a.foto.bloque.P}.`);
  const mov = movimientoEscanos(a);
  if (mov) partes.push(mov);
  partes.push(proyeccionTxt(a.foto, el));
  if (a.prev && Math.abs(a.dv) >= 1) partes.push(`${ventajaTxt(a.foto.ventaja)} Se ha movido ${puntos(Math.abs(a.dv))} esta semana, hacia ${a.dv > 0 ? 'la derecha' : 'la izquierda'}.`);
  else partes.push(ventajaTxt(a.foto.ventaja));
  // umbral de 176
  for (const b of ['P', 'C'] as Bando[]) {
    const ap = a.foto.apoyos[b];
    const ant = a.prev?.apoyos[b] ?? ap;
    if (ap >= 176 && ant < 176) partes.push(`Ojo: ${V[b].lider} cruza la línea de los 176 apoyos.`);
    if (ap < 176 && ant >= 176) partes.push(`${V[b].lider} cae por debajo de los 176 apoyos que tenía.`);
    if (ap >= 170 && ap < 176 && a.t >= 5) partes.push(el('cerca' + b, [`A ${V[b].lider} le faltan ${176 - ap} apoyos para la mayoría absoluta.`, `${V[b].lider} se queda a ${176 - ap} de los 176.`]));
  }
  const enc = a.encuestas.filter((x) => x.veda);
  if (enc.length) partes.push('Y recuerden que esta semana hay veda: hay encuestas que no podemos publicar.');
  return partes.join(' ');
}

// ————————————————————————————————————— las dos miradas (simétricas)
/** Razones concretas de la semana a favor de b, ordenadas por peso. */
function motivosAFavor(a: Analisis, b: Bando, el: ReturnType<typeof selector>): string[] {
  const rv = RIVAL[b];
  const m: string[] = [];
  const ganadas = a.flips.filter((f) => f.despues === b);
  const perdidasRival = a.flips.filter((f) => f.antes === rv && f.despues !== b);
  const importa = ganadas.slice(0, 2).some((f) => PROV[f.id].clave);
  if (ganadas.length) m.push(el('mg' + b, [
    `Ha ganado terreno${importa ? ' donde importa' : ''}: ${ganadas.slice(0, 2).map((f) => prov(f.id)).join(' y ')}.`,
    `${ganadas.length > 1 ? 'Se ha quedado con' : 'Se ha hecho con'} ${ganadas.slice(0, 2).map((f) => prov(f.id)).join(' y ')}, y eso son escaños.`,
  ]));
  else if (perdidasRival.length) m.push(`Ha conseguido que ${V[rv].bloque} deje de controlar ${prov(perdidasRival[0].id)}.`);
  const encuestas = a.encuestas.filter((x) => !x.veda && favor(x.neto, b) >= 2);
  if (encuestas.length) m.push(encuestas[0].zona === 'CIS' ? 'El Barómetro del CIS le ha dado aire.' : `La encuesta ${deZona(encuestas[0].zona)} le ha dado aire.`);
  if (a.debate?.ganador === b) m.push(`${V[b].lider} ha estado mejor en el debate, y eso lo ha visto todo el mundo.`);
  const castigo = a.exigencia.find((x) => x.bando === rv);
  if (castigo) m.push(el('exr' + b, [
    `${V[rv].Bloque} se ha quedado corto de intensidad y sus propias bases se lo han hecho pagar.`,
    `${V[rv].Papel} no ha salido a pelear esta semana, y en campaña eso se paga.`,
  ]));
  const batallasOk = a.batallas.filter((x) => x.bando === b && x.exito);
  if (batallasOk.length) m.push(`Ha ganado el pulso de ${prov(batallasOk[0].prov)}, que no era fácil.`);
  const carrera = a.carrera.filter((x) => x.bando === b);
  if (carrera.length) m.push(el('car' + b, [`Tiene programa: avanza en la batalla de las propuestas.`, `En propuestas, va por delante de lo que se esperaba.`]));
  if (a.atascos.some((x) => x.bando === rv && !x.sale)) m.push(`${V[rv].Bloque} sigue enredado en su guerra interna.`);
  if (a.anulada === rv) m.push(`Le ha robado el titular del lunes ${V[rv].a} con un fichaje inesperado.`);
  return m;
}

function motivosEnContra(a: Analisis, b: Bando, el: ReturnType<typeof selector>): string[] {
  const rv = RIVAL[b];
  const m: string[] = [];
  const perdidas = a.flips.filter((f) => f.antes === b);
  if (perdidas.length) m.push(`Perder ${prov(perdidas[0].id)} duele.`);
  if (a.exigencia.some((x) => x.bando === b)) m.push(el('exb' + b, [`Ha faltado intensidad: las bases han pedido más.`, `Se ha visto poca campaña en la calle y eso tiene un coste.`]));
  if (a.culpaClima[b] >= 2) m.push(`Ha tensado demasiado la campaña, y eso puede volverse en su contra.`);
  if (a.debate?.ganador === rv) m.push(`El debate no ha salido como se esperaba.`);
  if (a.atascos.some((x) => x.bando === b && !x.sale)) m.push(`La guerra interna le está costando cada semana.`);
  return m;
}

function comentarista(a: Analisis, b: Bando, el: ReturnType<typeof selector>): string {
  const rv = RIVAL[b];
  const yo = V[b];
  const partes: string[] = [];
  const favorSemana = favor(a.dv, b);
  if (favorSemana > 0) {
    partes.push(el('c+' + b, [
      `Buena semana para ${yo.bloque}, sin matices.`,
      `${cap(yo.sede)} puede estar contento esta noche.`,
      `Lo que hemos visto esta semana es ${yo.a} haciendo las cosas bien.`,
    ]));
    const r = motivosAFavor(a, b, el);
    if (r.length) partes.push(r[0]);
    if (a.racha.bando === b && a.racha.n >= 2) partes.push(el('racha' + b, [
      `Y van ${semanas(a.racha.n)} seguidas sumando: eso ya no es un accidente, es una tendencia.`,
      `${cap(semanas(a.racha.n))} seguidas al alza. A eso se le llama inercia.`,
    ]));
    else if (r[1]) partes.push(r[1]);
  } else if (favorSemana < 0) {
    partes.push(el('c-' + b, [
      `No voy a negarlo: no ha sido la semana ${yo.de}.`,
      `En ${yo.sede} tienen trabajo esta noche.`,
      `Semana para olvidar en ${yo.sede}, aunque no todo es negativo.`,
    ]));
    const malo = motivosEnContra(a, b, el);
    if (malo.length) partes.push(malo[0]);
    // buscarle el lado bueno
    const bueno = motivosAFavor(a, b, el);
    if (bueno.length) partes.push(`Pero cuidado: ${bueno[0].charAt(0).toLowerCase() + bueno[0].slice(1)}`);
    else if (a.foto.ganadorProyectado === b) partes.push(`Y aun así, si se votara hoy, el presidente sería ${yo.lider}. Eso es lo que cuenta.`);
    else if (favor(a.foto.ventaja, b) > 0) partes.push(`Sigue por delante en la Ventaja. Un mal día lo tiene cualquiera.`);
    else partes.push(el('anim' + b, [`Quedan ${semanas(8 - a.t)} y las campañas dan muchas vueltas.`, `Las encuestas ya se equivocaron en 2023. Yo no daría nada por cerrado.`]));
  } else {
    partes.push(el('c0' + b, [
      `Semana de empate. Para ${yo.bloque} no es mala noticia si sabe aprovechar lo que viene.`,
      `Ni frío ni calor ${yo.de.replace('del', 'en el')}. Ha aguantado, que no es poco.`,
    ]));
    const r = motivosAFavor(a, b, el);
    if (r.length) partes.push(r[0]);
  }
  // la pulla al socio del rival o una mirada a la remontada
  if (a.prev) {
    const socRival = a.foto.socio[rv] - a.prev.socio[rv];
    if (socRival > 0) partes.push(el('soc' + b, [`Y fíjense en ${V[rv].socio}: cuanto más crece, más se fragmenta el voto de ${V[rv].lado}.`, `El crecimiento de ${V[rv].socio} es un problema para ${V[rv].partido}, no una ayuda.`]));
    const minFavor = Math.min(...[a.prev, a.foto].map((f) => favor(f.ventaja, b)));
    if (minFavor <= -5 && favor(a.foto.ventaja, b) >= 0) partes.push(`Hace nada iba cinco puntos por detrás. Que nadie lo olvide.`);
  }
  return partes.join(' ');
}

// ————————————————————————————————————— el análisis estructural
function politologo(e: Estado, a: Analisis, el: ReturnType<typeof selector>): string {
  const partes: string[] = [];
  const pod = a.foto.podemos;
  const podAntes = a.prev?.podemos ?? pod;
  // Podemos, el comodín: siempre que se mueva
  if (a.agenda !== null) {
    const c = CARTAS[a.agenda];
    const ag = a.sucesos.find((x) => x.s === 'agenda') as Extract<Suceso, { s: 'agenda' }>;
    const contexto = c.contexto.replace(/[«»]/g, '"');
    partes.push(el('ag', [
      `Lo de Podemos merece capítulo aparte. El titular de la semana es suyo, «${c.nombre}»: ${contexto.charAt(0).toLowerCase() + contexto.slice(1)}`,
      `Podemos, otra vez, ha decidido de qué se hablaba: «${c.nombre}». ${contexto}`,
      `El comodín ha vuelto a mover el tablero con «${c.nombre}». ${contexto}`,
    ]));
    const blanco = ag ? blancoAgenda(a.agenda, ag.lider) : null;
    if (blanco === 'ambos') partes.push(el('agb', ['Y aquí no se salva nadie: lo pagan los dos bloques.', 'Podemos ha repartido para los dos lados.']));
    else if (blanco && ag && blanco === ag.lider && esContraLider(a.agenda)) partes.push(el('agl', [
      `Y fíjense a quién apunta: ${V[ag.lider].a}, que iba primero. Podemos siempre dispara al favorito.`,
      `El que lo sufre es ${V[ag.lider].bloque}: ir por delante te convierte en el blanco de Podemos.`,
    ]));
    else if (blanco) partes.push(el('agx' + blanco, [`Esta vez el golpe es para ${V[blanco].partido}.`, `Quien lo paga es ${V[blanco].bloque}.`]));
  }
  if (pod.humor !== podAntes.humor) {
    partes.push(`Podemos estaba ${HUMOR[podAntes.humor]} y ahora está ${HUMOR[pod.humor]}: hoy ${votoPodemosTxt(pod.humor)}.`);
  } else if (pod.fuerza !== podAntes.fuerza) {
    partes.push(pod.fuerza > podAntes.fuerza
      ? el('podf+', ['Y crece: cada punto que gana Podemos sale sobre todo del PSOE, así que su subida es una mala noticia para el Gobierno aunque luego le necesite.', 'Podemos sube, y eso es un arma de doble filo para el PSOE: le quita votos pero le puede dar la investidura.'])
      : el('podf-', ['Podemos baja: parte de su electorado vuelve al PSOE, que gana escaños pero pierde un socio con peso.', 'Podemos pierde fuelle y el PSOE recupera voto. Otra cosa es que luego le salgan las cuentas.']));
  } else if (a.agenda === null) {
    partes.push(`Podemos sigue ${HUMOR[pod.humor]}: ${votoPodemosTxt(pod.humor)}. Y nunca votará a Feijóo.`);
  }
  const morados = a.flips.filter((f) => f.morado);
  if (morados.length) partes.push(`Su desembarco en ${prov(morados[0].id)} ha descolocado ${V[morados[0].antes ?? 'P'].a}.`);
  // Las fuerzas regionales
  if (a.negocia.length) {
    const k = a.negocia[a.negocia.length - 1];
    partes.push(k.partido === 'PODEMOS'
      ? `El PSOE ha pasado la semana cortejando a Podemos.`
      : `Mucha llamada discreta con ${PARTIDOS[k.partido].siglas}: ${V[k.bando].bloque} sabe que la investidura se juega también fuera de su bloque.`);
  } else if (a.prev) {
    const cambios = (Object.keys(a.foto.afinidad) as RegionalId[]).filter((k) => a.foto.afinidad[k] !== a.prev!.afinidad[k]);
    if (cambios.length) {
      const k = cambios[0];
      const nuevo = a.foto.afinidad[k];
      const hacia: Bando = nuevo < a.prev.afinidad[k] ? 'P' : 'C';
      const lejos = RIVAL[hacia];
      const mov = nuevo === 0 ? `${PARTIDOS[k].siglas} se queda equidistante entre los dos bloques`
        : favor(nuevo, hacia) > 0 ? `${PARTIDOS[k].siglas} se acerca ${V[hacia].a}`
          : `${PARTIDOS[k].siglas} se distancia un poco ${V[lejos].de}`;
      partes.push(`${mov}. Son pocos escaños, pero en una investidura ajustada valen oro.`);
    }
  }
  // El veto de Vox
  if (a.prev && (a.prev.socio.C >= 0) !== (a.foto.socio.C >= 0)) {
    partes.push(a.foto.socio.C >= 0
      ? 'Y un detalle clave: con Vox tan fuerte, PNV, Junts y Coalición Canaria no podrían apoyar a Feijóo.'
      : 'Y un detalle clave: con Vox a la baja, el PP vuelve a poder hablar con PNV, Junts o Coalición Canaria.');
  }
  // El Clima
  if (a.foto.clima <= 2) {
    const culpa = a.culpaClima.P > a.culpaClima.C ? 'P' : a.culpaClima.C > a.culpaClima.P ? 'C' : null;
    partes.push(culpa ? `El que más ha tensado esta semana es ${V[culpa].bloque}. Con el clima en guerra sucia, el próximo error puede ser definitivo.` : 'Con el clima en guerra sucia, el primero que cruce la línea lo pagará caro.');
  } else if (a.prev && a.foto.clima > a.prev.clima + 1) {
    partes.push('Se agradece que baje la tensión: el votante castiga la crispación.');
  }
  // Efectos que marcan la semana
  const ef = a.efectos.find((x) => ['bastion', 'protegeZonas', 'atasco', 'crisis', 'manifiesto'].includes(x.tipo));
  if (ef) {
    const txt: Record<string, string> = {
      bastion: `${V[ef.bando].Bloque} ha blindado una de sus plazas fuertes: ahí ya no hay quien entre.`,
      protegeZonas: `${V[ef.bando].Bloque} ha cerrado filas en sus territorios; el rival tendrá que buscar votos en otra parte.`,
      atasco: `${V[RIVAL[ef.bando]].Bloque} se ha metido en una guerra interna, y de esas no se sale en un día.`,
      crisis: 'La crisis institucional lo condiciona todo: quien ataque ahora, pierde.',
      manifiesto: `El manifiesto ${ef.bando === 'P' ? 'de la cultura' : 'empresarial'} va a pesar en la recta final: cada choque frontal le dará argumentos.`,
    };
    partes.push(txt[ef.tipo]);
  }
  if (a.listas !== null) {
    partes.push(a.listas <= 2 ? 'Y el cierre de listas deja a Podemos más beligerante que nunca: va a por todas, contra el PSOE y contra la derecha.'
      : a.listas >= 5 ? 'Y en el cierre de listas Podemos ha guiñado al PSOE: «estaremos para frenar a la derecha».'
        : 'Podemos cierra listas sin sorpresas: mantiene su estrategia.');
  }
  void e;
  return partes.slice(0, 4).join(' ');
}

/** A quién perjudica una carta de la Agenda de Podemos, mirando sus efectos. */
function blancoAgenda(id: number, lider: Bando): Bando | 'ambos' | null {
  const efs = CARTAS[id].efectos;
  if (efs.some((x) => x.e === 'castigoCapitales' || (x.e === 'moradoAuto' && x.de === 'ambos') || (x.e === 'retirar' && x.de === 'ambos'))) return 'ambos';
  const como = efs.find((x) => x.e === 'como') as Extract<(typeof efs)[number], { e: 'como' }> | undefined;
  if (como && (como.bando === 'P' || como.bando === 'C')) return como.bando;
  if (esContraLider(id)) return lider;
  return null;
}

function esContraLider(id: number): boolean {
  return CARTAS[id].efectos.some((x) => (x.e === 'pv' && x.n < 0) || (x.e === 'moradoAuto' && x.de === 'lider') || x.e === 'aRezagado');
}

// ————————————————————————————————————— cierre
function cierre(a: Analisis, el: ReturnType<typeof selector>): string {
  const sig: Record<number, string> = {
    1: 'La semana que viene, más precampaña.',
    2: 'La semana que viene se cierran las listas, y Podemos tendrá que decidir con quién se pelea.',
    3: 'La semana que viene entra la campaña de verdad.',
    4: 'Nos quedan cuatro semanas.',
    5: 'La semana que viene, pegada de carteles: arranca la campaña oficial.',
    6: 'El lunes, cara a cara. Ahí puede cambiar todo.',
    7: 'Última semana: debate a cuatro y veda demoscópica. Nos vemos el domingo en el especial de la noche electoral.',
    8: 'El domingo, las urnas. Les esperamos en nuestro especial de la noche electoral.',
  };
  const remate = a.racha.n >= 3 && a.racha.bando
    ? `${cap(semanas(a.racha.n))} seguidas sumando ${V[a.racha.bando].bloque}. Veremos si alguien la frena.`
    : el('rem', ['Esto no ha terminado.', 'Seguiremos contándolo.', 'Gracias por acompañarnos.', 'Nada está decidido todavía.']);
  return `${sig[a.t] ?? ''} ${remate} Buenas noches.`.trim();
}

/** La conexión con el plató al final de la semana t. */
export function cronicaSemana(e: Estado, t: number): Segmento | null {
  const a = analizar(e, t);
  if (!a) return null;
  const el = selector(e, t);
  const tit = titular(a, el);
  const orden: Bando[] = t % 2 === 0 ? ['C', 'P'] : ['P', 'C']; // las dos miradas se alternan el turno de palabra
  const voz = (b: Bando): Personaje['id'] => (b === 'C' ? 'cons' : 'prog');
  const p = PLATO.personajes;
  const intervenciones: Intervencion[] = [
    { quien: 'pres', texto: apertura(a, el) },
    { quien: 'pres', texto: tit.texto + ' ' + el('pasa', [`${p.demo.nombre}, ¿qué dicen los números?`, `${p.demo.nombre}, cuéntanos.`, `Empezamos contigo, ${p.demo.nombre}.`]) },
    { quien: 'demo', texto: demoscopa(a, el) },
    { quien: voz(orden[0]), texto: comentarista(a, orden[0], el) },
    { quien: voz(orden[1]), texto: comentarista(a, orden[1], el) },
    { quien: 'poli', texto: politologo(e, a, el) },
    { quien: 'pres', texto: cierre(a, el) },
  ];
  return { titulo: `${PLATO.programa} · Semana ${t}`, rotulo: tit.rotulo, intervenciones: intervenciones.filter((x) => x.texto) };
}

// ————————————————————————————————————— el especial de la noche electoral
function puntoDeGiro(e: Estado, g: Bando): { t: number; n: number } | null {
  let mejor: { t: number; n: number } | null = null;
  for (let i = 1; i < e.historia.length; i++) {
    const n = favor(e.historia[i].ventaja - e.historia[i - 1].ventaja, g);
    if (n > 0 && (!mejor || n > mejor.n)) mejor = { t: e.historia[i].turno, n };
  }
  return mejor;
}

function peorMomento(e: Estado, b: Bando): { t: number; v: number } | null {
  let peor: { t: number; v: number } | null = null;
  for (const h of e.historia) {
    const v = favor(h.ventaja, b);
    if (!peor || v < peor.v) peor = { t: h.turno, v };
  }
  return peor;
}

function cambiosDeLider(e: Estado): number {
  let n = 0;
  let ant: Bando | null = null;
  for (const h of e.historia) {
    const l = bloqueDe(h.ventaja);
    if (l && ant && l !== ant) n++;
    if (l) ant = l;
  }
  return n;
}

function papelDePodemos(r: Resultado, humor: number): string {
  const pod = Math.round(r.escanos.PODEMOS ?? 0);
  const invP = r.investiduras.find((i) => i.candidato === 'P');
  if (!pod) return 'Podemos se queda fuera del Congreso. El comodín que tanto ha movido la campaña no tendrá voz en la investidura.';
  if (r.ganador === 'P' && invP?.exito && humor >= 1 && (invP.si - pod < 176 && invP.si - pod <= invP.no + pod)) {
    return `Y Podemos tiene la llave: sus ${pod} escaños son los que hacen presidente a Sánchez. Va a cobrárselo, no les quepa duda.`;
  }
  if (r.ganador !== 'P' && invP && !invP.exito && humor <= 0) {
    return `Podemos, con ${pod} escaños, ${humor === 0 ? 'se abstiene' : 'vota no'} y Sánchez no llega. El comodín ha decidido la noche, aunque no de la forma que esperaba el PSOE.`;
  }
  return `Podemos saca ${pod} escaños. Ha sido el gran agitador de la campaña${humor >= 1 ? ' y acaba dispuesto a apoyar a Sánchez' : humor === 0 ? ' y acaba en la abstención' : ' y acaba enfrentado al PSOE'}.`;
}

export function especialFinal(e: Estado): Segmento {
  const el = selector(e, 99);
  const r = proyectar(PROVINCIAS, e);
  const g = e.ganador?.bando ?? r.ganador;
  const motivo = e.ganador?.motivo ?? r.motivo;
  const p = PLATO.personajes;
  const inicio = e.historia[0];
  const voz = (b: Bando): Personaje['id'] => (b === 'C' ? 'cons' : 'prog');
  const intervenciones: Intervencion[] = [];
  const temprano = e.turno < 8 || /Ruptura|Vuelco|Asalto|Crisis/.test(motivo);

  intervenciones.push({ quien: 'pres', texto: temprano
    ? `Buenas noches. Interrumpimos la programación con un ${PLATO.especial.toLowerCase()} anticipado: la campaña ha saltado por los aires en la semana ${e.turno}.`
    : el('esp-ap', [
      `Buenas noches. Son las diez y se cierran los colegios. Bienvenidos al ${PLATO.especial.toLowerCase()} de ${PLATO.programa}.`,
      `Buenas noches desde ${PLATO.programa}. Ocho semanas después, por fin hablan las urnas.`,
    ]) });

  // el titular
  let rotulo = '';
  let tit = '';
  if (!g) {
    rotulo = 'EMPATE';
    tit = 'La noche acaba sin un ganador claro.';
  } else if (/Ruptura/.test(motivo)) {
    rotulo = `${V[RIVAL[g]].Bloque.toUpperCase()} CRUZA LA LÍNEA`;
    tit = `${V[RIVAL[g]].Bloque} llevó la campaña a la ruptura y los votantes se lo han hecho pagar. Gana ${V[g].bloque}.`;
  } else if (/Vuelco/.test(motivo)) {
    rotulo = `VUELCO: ${V[g].lider.toUpperCase()} ARRASA`;
    tit = `La Ventaja de ${V[g].bloque} ha llegado a veinte puntos. A partir de ahí, ya no hay partido.`;
  } else if (/Asalto/.test(motivo)) {
    rotulo = `${V[g].lider.toUpperCase()} CONQUISTA MADRID Y CATALUÑA`;
    tit = `${V[g].Bloque} controla a la vez Madrid y Centro y Cataluña: el feudo propio y el ajeno. Eso es ganar unas elecciones.`;
  } else if (/Crisis/.test(motivo)) {
    rotulo = 'LA CRISIS INSTITUCIONAL DECIDE';
    tit = `En plena crisis institucional, ${V[RIVAL[g]].bloque} lanzó una ofensiva y lo ha pagado. Gana ${V[g].bloque}.`;
  } else if (/Bloqueo/.test(motivo)) {
    rotulo = 'BLOQUEO: REPETICIÓN ELECTORAL';
    tit = `Nadie consigue la investidura. Habrá repetición electoral, y ${V[g].bloque} llega a ella con ventaja: ${motivo.includes('funciones') ? 'el Gobierno sigue en funciones' : 'es quien lidera las encuestas'}.`;
  } else {
    rotulo = `${V[g].lider.toUpperCase()}, PRESIDENTE`;
    const inv = r.investiduras.find((i) => i.candidato === g);
    tit = el('esp-tit', [
      `${V[g].lider} será presidente del Gobierno${inv ? ` con ${inv.si} votos a favor${inv.votacion === 1 ? ', mayoría absoluta en primera votación' : ', en segunda votación'}` : ''}.`,
      `Tenemos presidente: ${V[g].lider}${inv ? `, con ${inv.si} síes` : ''}.`,
    ]);
  }
  intervenciones.push({ quien: 'pres', texto: `${tit} ${p.demo.nombre}, los datos.` });

  // los números
  const partes: string[] = [`Resultado: ${escanosTxt({ ...inicio, escanos: r.escanos } as FotoTurno)}.`];
  partes.push(`${V.C.pareja} suman ${r.bloque.C}; ${V.P.pareja}, ${r.bloque.P}.`);
  if (inicio) {
    const dPP = Math.round((r.escanos.PP ?? 0) - (inicio.escanos.PP ?? 0));
    const dPS = Math.round((r.escanos.PSOE ?? 0) - (inicio.escanos.PSOE ?? 0));
    partes.push(`Respecto a lo que apuntaban las encuestas al empezar la campaña, el PP ${dPP >= 0 ? 'gana' : 'pierde'} ${Math.abs(dPP)} escaños y el PSOE ${dPS >= 0 ? 'gana' : 'pierde'} ${Math.abs(dPS)}.`);
  }
  const cl = cambiosDeLider(e);
  partes.push(cl === 0 ? 'Y un dato: el mismo bloque ha liderado la Ventaja de principio a fin.' : cl === 1 ? 'Ha habido un adelantamiento en toda la campaña, solo uno.' : `La Ventaja ha cambiado de manos ${cl} veces. Campaña de infarto.`);
  intervenciones.push({ quien: 'demo', texto: partes.join(' ') });

  // las dos miradas: primero quien gana
  if (g) {
    const giro = puntoDeGiro(e, g);
    const peor = peorMomento(e, g);
    const ganadorTxt: string[] = [/Bloqueo/.test(motivo)
      ? el('esp-gb' + g, [`En ${V[g].sede} hay motivos para sonreír, aunque con prudencia: habrá que volver a votar.`, `${V[g].Bloque} llega mejor colocado a la repetición. No es una victoria completa, pero es una ventaja.`])
      : el('esp-g' + g, [`Noche grande para ${V[g].bloque}.`, `Hoy en ${V[g].sede} se celebra, y con motivo.`, `${V[g].Bloque} ha hecho la campaña que tenía que hacer.`])];
    const final = favor(e.ventaja, g);
    if (giro && giro.t > 0) ganadorTxt.push(`Para mí, la clave fue la semana ${giro.t}: ahí sumó ${puntos(giro.n)} y cambió el paso de la campaña.`);
    if (peor && peor.v <= -4 && peor.t < e.turno && final >= peor.v + 4) ganadorTxt.push(`Y no olvidemos que en la semana ${peor.t} iba ${puntos(-peor.v)} por detrás. Remontada de manual.`);
    else if (final < 0) ganadorTxt.push('Ha ido por detrás en las encuestas, pero los escaños están donde tienen que estar: en las provincias que deciden.');
    intervenciones.push({ quien: voz(g), texto: ganadorTxt.join(' ') });
    const rv = RIVAL[g];
    const giroR = puntoDeGiro(e, g);
    const perdedorTxt: string[] = [el('esp-p' + rv, [`Hay que reconocerlo: no ha sido la noche ${V[rv].de}.`, `En ${V[rv].sede} toca hacer autocrítica.`, `Es una derrota para ${V[rv].bloque}, sin paliativos.`])];
    const mejorR = peorMomento(e, g); // el peor momento del ganador es el mejor del rival
    if (favor(e.ventaja, rv) > 0) perdedorTxt.push('Ha ganado la campaña en las encuestas, pero no en el reparto de escaños. Esa es la lección.');
    else if (mejorR && mejorR.v < 0 && mejorR.t < e.turno) perdedorTxt.push(`Llegó a ir ${puntos(-mejorR.v)} por delante en la semana ${mejorR.t}. Se le escapó.`);
    else if (giroR) perdedorTxt.push(`La semana ${giroR.t} fue la que lo cambió todo, y no supo reaccionar.`);
    if (/Bloqueo/.test(motivo)) perdedorTxt.push('Aunque con un bloqueo, la segunda vuelta está por jugar.');
    intervenciones.push({ quien: voz(rv), texto: perdedorTxt.join(' ') });
  }

  // el análisis
  const ana: string[] = [papelDePodemos(r, e.podemos.humor)];
  if (r.vetoVox) ana.push('El peso de Vox ha cerrado al PP la puerta del PNV, Junts y Coalición Canaria.');
  const regionales = (Object.keys(e.afinidad) as RegionalId[]).filter((k) => (r.escanos[k] ?? 0) >= 3);
  if (regionales.length) {
    const k = regionales.sort((x, y) => (r.escanos[y] ?? 0) - (r.escanos[x] ?? 0))[0];
    const a = e.afinidad[k];
    ana.push(`${PARTIDOS[k].siglas}, con ${Math.round(r.escanos[k] ?? 0)} escaños, ${a <= -2 ? 'se queda con el bloque progresista' : a >= 2 ? 'se inclina hacia el bloque conservador' : 'ha jugado a no comprometerse hasta el final'}.`);
  }
  const semanasGuerra = e.historia.filter((h) => h.turno > 0 && h.clima <= 2).length;
  if (semanasGuerra >= 2) ana.push(`Y una reflexión: ${semanas(semanasGuerra)} de campaña en guerra sucia. No es buena noticia para nadie.`);
  intervenciones.push({ quien: 'poli', texto: ana.join(' ') });

  intervenciones.push({ quien: 'pres', texto: el('esp-fin', [
    `Esto ha sido ${PLATO.programa}. Gracias por acompañarnos estas ocho semanas. Buenas noches.`,
    `Se cierra la campaña y se abre otra historia. Gracias por estar con nosotros. Buenas noches.`,
  ]) });

  return { titulo: `${PLATO.especial} · ${PLATO.programa}`, rotulo, intervenciones };
}
