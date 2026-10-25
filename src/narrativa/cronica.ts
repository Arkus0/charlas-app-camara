// El plató del fin de semana, en corto para el móvil: tres intervenciones que cuentan la historia de la semana
// (quién sube, qué tema ha mandado, qué encuesta se ha publicado y qué hace Podemos). Las dos miradas se escriben
// con la misma plantilla para cada bloque, así que son simétricas por construcción.
import { CARTAS } from '../data/mazos';
import { PLATO, type Personaje } from '../data/plato';
import { ZONAS } from '../data/provincias';
import { PROV } from '../data/provincias';
import { NOMBRE_TEMA } from '../motor/agenda';
import { citar } from '../motor/cambios';
import { RIVAL, type Bando } from '../motor/base';
import { votoPodemos } from '../motor/electoral';
import type { Cronica, FotoSemana, Suceso, Tema } from '../motor/tipos';

export interface Intervencion {
  quien: Personaje['id'];
  texto: string;
}

export interface Segmento {
  titulo: string;
  rotulo: string;
  intervenciones: Intervencion[];
}

const V = {
  P: { bloque: 'el bloque progresista', al: 'al bloque progresista', Bloque: 'El bloque progresista', lider: 'Sánchez', papel: 'el Gobierno', sede: 'Ferraz', pareja: 'PSOE y Frente Amplio' },
  C: { bloque: 'el bloque conservador', al: 'al bloque conservador', Bloque: 'El bloque conservador', lider: 'Feijóo', papel: 'la oposición', sede: 'Génova', pareja: 'PP y Vox' },
} as const;

/** El tema en mitad de una frase («se habló de la vivienda»). */
const TEMA_EN_FRASE: Record<Tema, string> = {
  VIV: 'la vivienda', SER: 'los servicios públicos', DER: 'derechos e igualdad', ECO: 'la economía',
  INM: 'inmigración y seguridad', ESP: 'la unidad de España', COR: 'la corrupción',
};

const FECHAS: Record<number, string> = {
  1: 'del 6 al 11 de octubre', 2: 'del 12 al 18 de octubre', 3: 'del 19 al 25 de octubre', 4: 'del 26 de octubre al 1 de noviembre',
  5: 'del 2 al 8 de noviembre', 6: 'del 9 al 15 de noviembre', 7: 'del 16 al 22 de noviembre', 8: 'del 23 al 28 de noviembre',
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const deBloque = (v: number): Bando | null => (v > 0 ? 'C' : v < 0 ? 'P' : null);
const puntos = (n: number) => `${n} ${n === 1 ? 'punto' : 'puntos'}`;

function votoPodemosTxt(f: FotoSemana): string {
  const pod = { humor: f.podemos.humor, pinza: f.podemos.pinza, socioC: f.socio.C };
  const c = votoPodemos('C', pod);
  if (c === 'si') return 'votaría sí a Feijóo';
  if (c === 'abst') return 'se abstendría para dejar gobernar a Feijóo';
  const p = votoPodemos('P', pod);
  return p === 'si' ? 'votaría sí a Sánchez' : p === 'abst' ? 'se abstendría con Sánchez' : 'votaría no a Sánchez';
}

/** La crónica de la semana s (1-7) a partir de la historia y los sucesos públicos. */
export function cronicaSemana(c: Cronica, s: number): Segmento | null {
  const foto = c.historia.find((h) => h.semana === s);
  const prev = [...c.historia].reverse().find((h) => h.semana < s) ?? null;
  if (!foto) return null;
  const sucesos = c.sucesos.filter((x) => x.semana === s);
  const elige = <T,>(clave: string, xs: T[]): T => xs[hash(`${s}|${clave}|${foto.ventaja}|${foto.bloque.P}`) % xs.length];
  const dv = foto.ventaja - (prev?.ventaja ?? 0);
  const gana = deBloque(dv);
  const proy = foto.ganadorProyectado;
  const proyAntes = prev?.ganadorProyectado ?? null;
  const encuesta = sucesos.find((x): x is Extract<Suceso, { s: 'encuesta' }> => x.s === 'encuesta' && x.zona !== 'CIS');
  const dominante = sucesos.find((x): x is Extract<Suceso, { s: 'dominante' }> => x.s === 'dominante');
  const noticia = sucesos.find((x): x is Extract<Suceso, { s: 'noticia' }> => x.s === 'noticia');
  const debate = sucesos.find((x): x is Extract<Suceso, { s: 'debateTV' }> => x.s === 'debateTV');
  const vuelcos = sucesos.filter((x): x is Extract<Suceso, { s: 'control' }> => x.s === 'control' && !!x.despues && x.antes !== x.despues);

  // —— titular ——
  let titulo: string;
  if (proy && proy !== proyAntes) titulo = elige('t1', [`Vuelco en la proyección: hoy gobernaría ${V[proy].lider}`, `${V[proy].lider} se pone por delante en el Congreso`]);
  else if (debate?.ganador) titulo = `${V[debate.ganador].lider} gana el ${debate.debate === 'cara' ? 'cara a cara' : 'debate a cuatro'}`;
  else if (dominante?.dueno) titulo = elige('t2', [`${NOMBRE_TEMA[dominante.tema]}: el tema que marcó la semana`, `La semana se habló de ${TEMA_EN_FRASE[dominante.tema]}, y eso favorece ${V[dominante.dueno].al}`]);
  else if (gana && Math.abs(dv) >= 3) titulo = `${V[gana].Bloque} gana ${puntos(Math.abs(dv))} en una semana`;
  else titulo = elige('t3', ['Semana de trincheras: nadie rompe el empate', 'La campaña se juega provincia a provincia']);

  const rotulo = `Semana ${s} · ${FECHAS[s]}`;
  const intervenciones: Intervencion[] = [];

  // —— presentador ——
  const apertura = noticia ? `La semana arrancó con ${citar(CARTAS[noticia.carta].nombre)}. ` : '';
  intervenciones.push({
    quien: 'pres',
    texto: apertura + (gana
      ? `${V[gana].Bloque} cierra la semana arriba: la Ventaja se mueve ${puntos(Math.abs(dv))} a su favor.`
      : 'La Ventaja apenas se mueve: los dos bloques se neutralizan.'),
  });

  // —— demóscopa ——
  let demo = `Si se votara hoy: ${V.P.pareja} ${foto.bloque.P} escaños, ${V.C.pareja} ${foto.bloque.C}.`;
  demo += ` En la investidura, ${foto.apoyos.P} síes posibles para Sánchez y ${foto.apoyos.C} para Feijóo.`;
  if (encuesta) {
    const z = ZONAS[encuesta.zona as keyof typeof ZONAS].nombre;
    const g = deBloque(encuesta.neto);
    demo += g ? ` La encuesta de ${z} da ${puntos(Math.abs(encuesta.neto))} a ${V[g].bloque}.` : ` La encuesta de ${z} sale igualada.`;
  }
  if (vuelcos.length) demo += ` Cambian de manos: ${vuelcos.slice(0, 3).map((x) => PROV[x.prov].corto).join(', ')}.`;
  intervenciones.push({ quien: 'demo', texto: demo });

  // —— columnista del bloque que gana la semana (o el politólogo) ——
  if (dominante) {
    const t = dominante.tema as Tema;
    const dueno = dominante.dueno;
    if (dueno) {
      const col: Personaje['id'] = dueno === 'C' ? 'cons' : 'prog';
      intervenciones.push({
        quien: col,
        texto: elige('col', [
          `Cuando se habla de ${TEMA_EN_FRASE[t]}, gana ${V[dueno].bloque}. ${V[RIVAL[dueno]].sede} lo sabe y aun así le ha dado aire.`,
          `${V[dueno].papel === 'el Gobierno' ? 'El Gobierno' : 'La oposición'} ha marcado la agenda: ${TEMA_EN_FRASE[t]} en todos los platós, y eso son votos.`,
        ]),
      });
    } else {
      intervenciones.push({ quien: 'poli', texto: `La semana la ha dominado la corrupción, y con ella el Clima se resiente: ahora mismo hay más ruido que propuestas.` });
    }
  } else {
    intervenciones.push({ quien: 'poli', texto: `Ninguna conversación se ha impuesto. La campaña se decide en la presencia sobre el terreno, provincia a provincia.` });
  }

  // —— Podemos, si cambia algo ——
  const pod = foto.podemos;
  const podAntes = prev?.podemos;
  if (podAntes && (pod.humor !== podAntes.humor || pod.pinza !== podAntes.pinza)) {
    intervenciones.push({ quien: 'poli', texto: `Ojo a Podemos: hoy ${votoPodemosTxt(foto)}${pod.pinza > 0 ? ` y la pinza con la derecha está en ${pod.pinza} de 3` : ''}.` });
  }
  return { titulo, rotulo, intervenciones };
}

/** El especial de la noche electoral. */
export function especialFinal(c: Cronica, ganador: { bando: Bando | null; motivo: string }): Segmento {
  const foto = c.historia[c.historia.length - 1];
  const g = ganador.bando;
  const anticipado = /Vuelco|Ruptura/.test(ganador.motivo);
  const intervenciones: Intervencion[] = [
    {
      quien: 'pres',
      texto: anticipado
        ? `La campaña se ha roto antes de llegar a las urnas. ${ganador.motivo}.`
        : g ? `Son las once de la noche y ya hay un ganador: ${V[g].lider}. ${ganador.motivo}.` : `Noche sin ganador. ${ganador.motivo}.`,
    },
  ];
  if (foto) {
    intervenciones.push({ quien: 'demo', texto: `${V.P.pareja} suman ${foto.bloque.P} escaños; ${V.C.pareja}, ${foto.bloque.C}. Podemos ${votoPodemosTxt(foto)}.` });
  }
  if (g) {
    intervenciones.push({ quien: g === 'C' ? 'cons' : 'prog', texto: `${V[g].sede} ha sabido leer la campaña: ocho semanas de presencia, agenda y paciencia.` });
    intervenciones.push({ quien: g === 'C' ? 'prog' : 'cons', texto: `${V[RIVAL[g]].sede} tendrá que explicar por qué dejó que la conversación fuera la del rival.` });
  }
  return {
    titulo: g ? `${V[g].lider} gana ${anticipado ? 'la campaña' : 'el 29N'}` : 'Bloqueo el 29N',
    rotulo: anticipado ? `${PLATO.programa} · edición especial` : `${PLATO.especial} · 29 de noviembre`,
    intervenciones,
  };
}
