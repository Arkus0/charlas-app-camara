// Cambios del estado que dejan rastro en la crónica: PV, Clima, presencia, calor, socios, Podemos y afinidades.
import { CORTO_BANDO, PARTIDOS } from '../data/partidos';
import { PROV, PROVINCIAS } from '../data/provincias';
import { RIVAL, type Bando, type RegionalId } from './base';
import { controlDe, proyectar } from './electoral';
import { CALOR_MAX, dominante } from './agenda';
import { controlador, TOPE_VENTAJA } from './reglas';
import type { DatoSuceso, EntradaLog, Estado, Rama, Tema } from './tipos';

export const N = (b: Bando) => CORTO_BANDO[b];

export const NOMBRES_CLIMA: Record<number, string> = { 5: 'Sereno', 4: 'Tenso', 3: 'Bronco', 2: 'Guerra sucia', 1: 'Ruptura' };

export const HUMOR_PODEMOS: Record<number, string> = {
  [-3]: 'en guerra con el PSOE', [-2]: 'ruptura', [-1]: 'enfadado', 0: 'exigente', 1: 'dispuesto', 2: 'socio', 3: 'socio firme',
};

export function log(e: Estado, texto: string, tipo?: EntradaLog['tipo'], bando: Bando | null = null) {
  if (e.silencio) return;
  e.cronica.log.push({ seq: ++e.cronica.seq, semana: e.semana, bando, texto, tipo });
}

export function suceso(e: Estado, s: DatoSuceso) {
  if (e.silencio) return;
  e.cronica.sucesos.push({ ...s, seq: ++e.cronica.seq, semana: e.semana });
}

export function fmtVentaja(v: number): string {
  return v === 0 ? '0' : v > 0 ? `+${v} Conservador` : `+${-v} Progresista`;
}

export function terminar(e: Estado, b: Bando | null, motivo: string) {
  if (e.ganador) return;
  e.ganador = { bando: b, motivo };
  e.fase = 'fin';
  e.pendiente = null;
  e.pila = [];
  log(e, b ? `¡Gana el ${b === 'P' ? 'Bloque Progresista' : 'Bloque Conservador'}! ${motivo}` : `Empate. ${motivo}`, 'fase', b);
  suceso(e, { s: 'fin', ganador: b, motivo });
}

/** b gana n PV (n negativo: los pierde). Con la Ventaja en el tope, la partida termina. */
export function pv(e: Estado, b: Bando, n: number) {
  if (!n || e.ganador) return;
  const g = n > 0 ? b : RIVAL[b];
  e.ventaja = Math.max(-TOPE_VENTAJA, Math.min(TOPE_VENTAJA, e.ventaja + (b === 'C' ? n : -n)));
  log(e, `${N(g)} gana ${Math.abs(n)} PV (Ventaja ${fmtVentaja(e.ventaja)})`, 'pv', g);
  suceso(e, { s: 'pv', bando: g, n: Math.abs(n) });
  if (Math.abs(e.ventaja) >= TOPE_VENTAJA) terminar(e, e.ventaja > 0 ? 'C' : 'P', `Vuelco: la Ventaja demoscópica llega a ${TOPE_VENTAJA}`);
}

/** Cambia el Clima. Si llega a 1 durante la acción de un bloque, ese bloque pierde; sin culpable no baja de 2. */
export function cambiarClima(e: Estado, n: number, minimo = 1) {
  if (!n || e.ganador) return;
  const antes = e.clima;
  const tope = e.enJuego ? minimo : Math.max(minimo, 2);
  e.clima = Math.max(tope, Math.min(5, e.clima + n));
  if (e.clima === antes) return;
  log(e, `Clima de campaña: ${antes} → ${e.clima} (${NOMBRES_CLIMA[e.clima]})`, 'clima');
  suceso(e, { s: 'clima', antes, despues: e.clima, culpable: e.enJuego });
  if (e.clima <= 1) {
    const culpable = e.enJuego ?? 'P';
    terminar(e, RIVAL[culpable], `Ruptura: el ${N(culpable)} lleva la campaña a la guerra sucia y los votantes lo castigan`);
  }
}

/** Suma (o resta) presencia de b en una provincia y anota el cambio de control. */
export function cambiarPresencia(e: Estado, id: string, b: Bando, n: number) {
  if (!n) return;
  const antes = controlador(e, id);
  const pr = e.presencia[id];
  const nuevo = Math.max(0, pr[b] + n);
  const real = nuevo - pr[b];
  if (!real) return;
  pr[b] = nuevo;
  suceso(e, { s: 'presencia', bando: b, prov: id, n: real });
  const despues = controlador(e, id);
  if (antes !== despues) {
    suceso(e, { s: 'control', prov: id, antes, despues });
    log(e, despues ? `${PROV[id].nombre} pasa a control ${despues === 'P' ? 'progresista' : 'conservador'}` : `${PROV[id].nombre} queda sin control`, undefined, despues);
  }
}

export function calentar(e: Estado, t: Tema, n: number) {
  if (!n) return;
  const antes = e.agenda.calor[t];
  const despues = Math.max(0, Math.min(CALOR_MAX, antes + n));
  if (n > 0) e.agenda.reciente[t] = ++e.agenda.contador;
  if (despues === antes) return;
  e.agenda.calor[t] = despues;
  suceso(e, { s: 'calor', tema: t, antes, despues });
}

export function salpicar(e: Estado, b: Bando) {
  e.agenda.corrupcion = b;
  log(e, `La corrupción salpica al ${N(b)}`, 'agenda', b);
}

export function cambiarSocio(e: Estado, b: Bando, n: number) {
  const antes = e.socio[b];
  e.socio[b] = Math.max(-3, Math.min(3, e.socio[b] + n));
  if (e.socio[b] === antes) return;
  log(e, `Medidor de ${b === 'C' ? 'Vox' : 'Frente Amplio'}: ${antes} → ${e.socio[b]}`, undefined, b);
  suceso(e, { s: 'socio', bando: b, n: e.socio[b] - antes });
}

export function cambiarPodemos(e: Estado, fuerza = 0, humor = 0, pinza = 0) {
  const a = { ...e.podemos };
  e.podemos.fuerza = Math.max(-3, Math.min(3, e.podemos.fuerza + fuerza));
  e.podemos.humor = Math.max(-3, Math.min(3, e.podemos.humor + humor));
  // la pinza solo puede avanzar con Podemos en ruptura con el PSOE
  if (pinza > 0 && e.podemos.humor > -2) pinza = 0;
  e.podemos.pinza = Math.max(0, Math.min(3, e.podemos.pinza + pinza));
  const p = e.podemos;
  if (p.fuerza === a.fuerza && p.humor === a.humor && p.pinza === a.pinza) return;
  const partes: string[] = [];
  if (p.fuerza !== a.fuerza) partes.push(`fuerza ${a.fuerza} → ${p.fuerza}`);
  if (p.humor !== a.humor) partes.push(`humor ${HUMOR_PODEMOS[p.humor]}`);
  if (p.pinza !== a.pinza) partes.push(`pinza ${a.pinza} → ${p.pinza}`);
  log(e, `Podemos: ${partes.join(', ')}`);
  suceso(e, { s: 'podemos', ...p });
}

/** Mueve la afinidad de una fuerza regional n pasos hacia b. */
export function moverAfinidad(e: Estado, partido: RegionalId, b: Bando, n: number) {
  const antes = e.afinidad[partido];
  e.afinidad[partido] = Math.max(-3, Math.min(3, antes + (b === 'C' ? n : -n)));
  if (e.afinidad[partido] === antes) return;
  log(e, `${PARTIDOS[partido].siglas} se acerca al ${N(b)} (afinidad ${antes} → ${e.afinidad[partido]})`, undefined, b);
  suceso(e, { s: 'afinidad', partido, antes, despues: e.afinidad[partido] });
}

export function subirMaquinaria(e: Estado, b: Bando, r: Rama) {
  e.maquinaria[b][r]++;
  suceso(e, { s: 'maquinaria', bando: b, rama: r, nivel: e.maquinaria[b][r] });
}

/** La foto de la semana para el plató y las gráficas. */
export function fotoSemana(e: Estado) {
  if (e.silencio) return;
  const r = proyectar(PROVINCIAS, e);
  const controles: Record<string, Bando | null> = {};
  for (const p of PROVINCIAS) {
    const c = controlDe(p, e.presencia[p.id], e.morado[p.id] ?? 0);
    controles[p.id] = c === 1 ? 'C' : c === -1 ? 'P' : null;
  }
  e.cronica.historia.push({
    semana: e.semana,
    ventaja: e.ventaja,
    clima: e.clima,
    escanos: { ...r.escanos },
    bloque: r.bloque,
    apoyos: r.apoyos,
    ganadorProyectado: r.ganador,
    controles,
    morado: { ...e.morado },
    podemos: { ...e.podemos },
    socio: { ...e.socio },
    afinidad: { ...e.afinidad },
    calor: { ...e.agenda.calor },
    dominante: dominante(e),
    maquinaria: { P: { ...e.maquinaria.P }, C: { ...e.maquinaria.C } },
  });
}
