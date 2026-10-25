// La semana de campaña: inicio, noticia, Agenda de Podemos, hitos, turnos alternos, cierre y noche electoral.
import { CARTAS } from '../data/mazos';
import { PROVINCIAS, ZONAS } from '../data/provincias';
import { RIVAL, type Bando } from './base';
import { proyectar } from './electoral';
import { dominante, duenoTema, enAgenda, estaEnAgenda, NOMBRE_TEMA, temaPropio, TEMAS } from './agenda';
import { tiene } from './maquinaria';
import { anadirFase, robar } from './baraja';
import {
  calentar, cambiarClima, cambiarPodemos, cambiarSocio, citar, fotoSemana, log, N, pv, suceso, terminar,
} from './cambios';
import { opcionesAccion, resolverAccion } from './acciones';
import { tareaEfectos } from './efectos';
import { decidir, encolar, type Paso, type Tarea } from './nucleo';
import { aleatorio } from './rng';
import { accionesSemana, FECHAS, HITOS, lider, puntuarCIS, puntuarZona, tamanoMano } from './reglas';
import type { Estado, Respuesta, Tema } from './tipos';

const d6 = (e: Estado) => 1 + Math.floor(aleatorio(e) * 6);

/** PV de la Agenda al cerrar la semana: el tema dominante y el segundo en agenda. */
export const PV_DOMINANTE = 2;
export const PV_SEGUNDO = 1;

/** PV máximos de cada debate televisado. */
export const TOPE_DEBATE = { cara: 3, cuatro: 2 } as const;

/** Bonificación de un tema en los debates: propio y en agenda +1; además dominante, +1 más. */
export function bonoTemaDebate(e: Estado, b: Bando, t: Tema): number {
  if (!temaPropio(e, t, b)) return 0;
  return (estaEnAgenda(e, t) ? 1 : 0) + (dominante(e) === t ? 1 : 0);
}

export const pasosSemana: Record<string, Paso<Estado, Respuesta>> = {
  inicioSemana(e) {
    e.semana++;
    e.enJuego = null;
    log(e, `Semana ${e.semana} (${FECHAS[e.semana]}): ${HITOS[e.semana]}`, 'fase');
    suceso(e, { s: 'semana' });
    if (e.semana > 1) cambiarClima(e, 1);
    e.negociado = { P: [], C: [] };
    e.maquinariaUsada = { P: false, C: false };
    if (e.semana === 4) anadirFase(e, 2);
    if (e.semana === 7) anadirFase(e, 3);
    for (const b of ['P', 'C'] as Bando[]) {
      e.acciones[b] = accionesSemana(e.semana) + (tiene(e, b, 'calle', 3) ? 1 : 0);
      while (e.manos[b].length < tamanoMano(e, b) && robar(e, b));
    }
    // empieza quien lidera la Ventaja: así el que va detrás cierra la semana antes de la encuesta
    const primero = lider(e);
    const tareas: Tarea[] = [{ t: 'noticia' }, { t: 'agendaPodemos' }];
    if (e.semana === 6) tareas.push({ t: 'accion', b: primero, gratis: 'pegada' }, { t: 'accion', b: RIVAL[primero], gratis: 'pegada' });
    if (e.semana === 7) tareas.push({ t: 'debate', debate: 'cara', fase: 0, eleccion: {} });
    if (e.semana === 8) tareas.push({ t: 'debate', debate: 'cuatro', fase: 0, eleccion: {} });
    tareas.push({ t: 'turnos', orden: [primero, RIVAL[primero]], i: 0 }, { t: 'finSemana' });
    encolar(e, ...tareas);
    return true;
  },

  noticia(e) {
    const id = e.mazos.actualidad.pop();
    if (id === undefined) return true;
    const c = CARTAS[id];
    e.noticia = id;
    e.retiradas.push(id);
    log(e, `Noticia de la semana: ${citar(c.nombre)}`, 'fase');
    suceso(e, { s: 'noticia', carta: id });
    calentar(e, c.tema, 2);
    if (c.efectos.length) encolar(e, tareaEfectos(c.efectos, { yo: lider(e), carta: id }));
    return true;
  },

  agendaPodemos(e) {
    const id = e.mazos.podemos.pop();
    if (id === undefined) return true;
    const c = CARTAS[id];
    const l = lider(e);
    e.agendaPodemos = id;
    e.retiradas.push(id);
    log(e, `Agenda de Podemos: ${citar(c.nombre)} (lo sufre quien va primero: el ${N(l)})`, 'fase');
    suceso(e, { s: 'agendaPodemos', carta: id, lider: l });
    calentar(e, c.tema, 1);
    if (c.efectos.length) encolar(e, tareaEfectos(c.efectos, { yo: l, carta: id }));
    return true;
  },

  turnos(e, t) {
    const quedan = (b: Bando) => e.acciones[b] > 0;
    if (!quedan('P') && !quedan('C')) return true;
    let b: Bando = t.orden[t.i % 2];
    if (!quedan(b)) b = RIVAL[b];
    t.i++;
    const n = Math.max(1, Math.min(e.ritmo, e.acciones[b]));
    encolar(e, ...Array.from({ length: n }, () => ({ t: 'accion', b })));
    return false;
  },

  accion(e, t, r) {
    const b: Bando = t.b;
    if (!r) {
      if (!t.gratis && e.acciones[b] <= 0) return true;
      e.enJuego = b;
      const quedan = t.gratis ? 1 : e.acciones[b];
      const texto = t.gratis === 'pegada' ? 'Pegada de carteles: 2 PC gratis para implantarte' : `Tu jugada (te quedan ${quedan} esta semana)`;
      return decidir(e, { tipo: 'accion', bando: b, texto, opciones: opcionesAccion(e, b, t.gratis), quedan });
    }
    if (r.tipo !== 'accion') throw new Error('Se esperaba una acción');
    resolverAccion(e, b, r, !!t.gratis);
    return true;
  },

  debate(e, t, r) {
    const nombre = t.debate === 'cara' ? 'Cara a cara' : 'Debate a cuatro';
    if (t.fase === 0) {
      t.fase = 1;
      e.enJuego = null;
      log(e, t.debate === 'cara' ? 'Lunes 16 de noviembre: cara a cara entre Sánchez y Feijóo' : 'Jueves 26 de noviembre: debate a cuatro', 'fase');
      if (t.debate === 'cuatro') {
        // los socios ganan foco y Podemos, que se queda fuera, lo hace estallar en redes
        cambiarSocio(e, 'P', 1);
        cambiarSocio(e, 'C', 1);
        cambiarPodemos(e, 1, 0);
      }
    }
    if (r) {
      if (r.tipo !== 'debate') throw new Error('Se esperaba la elección del debate');
      t.eleccion[t.turno] = { carta: r.carta, tema: r.tema };
    }
    for (const b of ['P', 'C'] as Bando[]) {
      if (t.eleccion[b]) continue;
      t.turno = b;
      return decidir(e, {
        tipo: 'debate', bando: b, debate: t.debate,
        texto: `${nombre}: elige en secreto una carta (cuenta su fuerza) y el tema que vas a llevar al debate`,
        cartas: [...e.manos[b]],
      });
    }
    const total: Record<Bando, number> = { P: 0, C: 0 };
    for (const b of ['P', 'C'] as Bando[]) {
      const { carta, tema } = t.eleccion[b] as { carta: number | null; tema: Tema };
      const dado = d6(e);
      total[b] = dado + (carta !== null ? CARTAS[carta].fuerza : 0) + bonoTemaDebate(e, b, tema) + (tiene(e, b, 'medios', 3) ? 2 : 0);
      if (carta !== null) {
        const i = e.manos[b].indexOf(carta);
        if (i >= 0) e.manos[b].splice(i, 1);
        e.descartes[b].push(carta);
      }
      log(e, `${N(b)}: ${carta !== null ? citar(CARTAS[carta].nombre) : 'sin carta'}, habla de ${NOMBRE_TEMA[tema]} · dado ${dado} → ${total[b]}`, 'dado', b);
    }
    const dif = Math.abs(total.P - total.C);
    const ganador: Bando | null = dif === 0 ? null : total.P > total.C ? 'P' : 'C';
    const ep = t.eleccion.P as { carta: number | null; tema: Tema };
    const ec = t.eleccion.C as { carta: number | null; tema: Tema };
    suceso(e, { s: 'debateTV', debate: t.debate, P: { ...ep, total: total.P }, C: { ...ec, total: total.C }, ganador, dif });
    if (!ganador) {
      log(e, `${nombre}: empate técnico`, 'fase');
      return true;
    }
    log(e, `${nombre}: gana el ${N(ganador)}`, 'fase', ganador);
    pv(e, ganador, Math.min(dif, TOPE_DEBATE[t.debate as 'cara' | 'cuatro']));
    calentar(e, (t.eleccion[ganador] as { tema: Tema }).tema, 2);
    return true;
  },

  finSemana(e) {
    e.enJuego = null;
    // la encuesta de la semana
    const z = e.calendario[e.semana];
    if (z) {
      const p = puntuarZona(e, z);
      log(e, `Encuesta: ${ZONAS[z].nombre} · ${p.neto === 0 ? 'empate' : `+${Math.abs(p.neto)} ${N(p.neto > 0 ? 'C' : 'P')}`}`, 'encuesta');
      suceso(e, { s: 'encuesta', zona: z, neto: p.neto, nivel: p.nivel });
      if (p.neto) pv(e, 'C', p.neto);
    }
    if (e.semana === 4 && !e.ganador) {
      const neto = puntuarCIS(e);
      log(e, `Barómetro del CIS: ${neto === 0 ? 'empate' : `+${Math.abs(neto)} ${N(neto > 0 ? 'C' : 'P')}`}`, 'encuesta');
      suceso(e, { s: 'encuesta', zona: 'CIS', neto });
      if (neto) pv(e, 'C', neto);
    }
    if (e.ganador) return true;
    // la Agenda: el tema dominante da 2 PV a su dueño y el segundo en agenda, 1
    const [d, segundo] = enAgenda(e);
    if (d) {
      const dueno = duenoTema(e, d);
      suceso(e, { s: 'dominante', tema: d, dueno });
      log(e, `Tema de la semana: ${NOMBRE_TEMA[d]}${dueno ? ` (favorece al ${N(dueno)})` : ''}`, 'agenda', dueno);
      if (dueno) pv(e, dueno, PV_DOMINANTE + (tiene(e, dueno, 'medios', 2) ? 1 : 0));
      if (d === 'COR') cambiarClima(e, -1);
      if (e.ganador) return true;
    }
    if (segundo) {
      const dueno = duenoTema(e, segundo);
      if (dueno) {
        log(e, `También en agenda: ${NOMBRE_TEMA[segundo]} (favorece al ${N(dueno)})`, 'agenda', dueno);
        pv(e, dueno, PV_SEGUNDO);
        if (e.ganador) return true;
      }
    }
    // cierre de listas: Podemos va en solitario y decide su estrategia
    if (e.semana === 3) {
      const dado = d6(e);
      log(e, `Lunes 26 de octubre, cierre de listas: Podemos va en solitario (dado ${dado})`, 'fase');
      suceso(e, { s: 'listas', dado });
      if (dado <= 2) cambiarPodemos(e, 1, -1);
      else if (dado >= 5) cambiarPodemos(e, 0, 1);
    }
    // la pinza se enfría si Podemos ya no está en guerra con el PSOE
    if (e.podemos.pinza > 0 && e.podemos.humor > -2) cambiarPodemos(e, 0, 0, -1);
    e.efectos = e.efectos.filter((x) => x.hasta !== 'semana');
    for (const t of TEMAS) e.agenda.calor[t] = Math.floor(e.agenda.calor[t] / 2);
    fotoSemana(e);
    encolar(e, e.semana >= 8 ? { t: 'noche' } : { t: 'inicioSemana' });
    return true;
  },

  noche(e) {
    log(e, 'Domingo 29 de noviembre: noche electoral', 'fase');
    const r = proyectar(PROVINCIAS, e);
    terminar(e, r.ganador, r.motivo);
    return true;
  },
};
