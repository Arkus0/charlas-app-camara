// Modelo electoral: de la situación de campaña a votos, escaños (D'Hondt) e investidura.
import type { Bando, Estado, PartidoId, Provincia, RegionalId, Votos } from './tipos';

export const UMBRAL = 0.03; // art. 163 LOREG: 3% de los votos válidos de la circunscripción

/** Reparto D'Hondt con umbral. Los empates se resuelven a favor de la candidatura con más votos. */
export function dhondt(escanos: number, votos: Votos, umbral = UMBRAL): Votos {
  const validos = Object.values(votos).reduce((a, b) => a + (b ?? 0), 0);
  const elegibles = (Object.keys(votos) as PartidoId[]).filter(
    (k) => k !== 'BLANCO' && k !== 'OTROS' && (votos[k] ?? 0) > 0 && (votos[k] ?? 0) >= umbral * validos,
  );
  const res: Votos = {};
  for (const k of elegibles) res[k] = 0;
  for (let i = 0; i < escanos; i++) {
    let mejor: PartidoId | null = null;
    let mq = -1;
    for (const k of elegibles) {
      const q = (votos[k] as number) / ((res[k] as number) + 1);
      if (q > mq || (q === mq && mejor && (votos[k] as number) > (votos[mejor] as number))) {
        mq = q;
        mejor = k;
      }
    }
    if (!mejor) break;
    res[mejor] = (res[mejor] as number) + 1;
  }
  return res;
}

export const BLOQUE_C: PartidoId[] = ['PP', 'VOX'];
export const BLOQUE_P: PartidoId[] = ['PSOE', 'SUMAR', 'PODEMOS'];

/** pp de voto por punto de presencia neta: más alto en circunscripciones pequeñas */
export function ppPorPresencia(escanos: number): number {
  return Math.max(0.6, Math.min(2.4, 2.4 / Math.sqrt(escanos / 4)));
}
export const PP_POR_PV = 0.4;
export const PASO_SOCIO = 0.03; // cuota del bloque por paso del medidor de socios
export const MOVILIZACION_SOCIO = 0.004; // votos válidos que añade/quita cada paso del medidor
export const SINERGIA_LISTA = 1.03;

export type EntradaModelo = Pick<
  Estado,
  'presencia' | 'presencia0' | 'control0' | 'ventaja' | 'socio' | 'listaConjunta' | 'unidad' | 'modsProv' | 'modsPartido'
> & { sesgo?: number };

export function controlDe(p: Provincia, pres: { P: number; C: number }): -1 | 0 | 1 {
  if (pres.C - pres.P >= p.fidelidad) return 1;
  if (pres.P - pres.C >= p.fidelidad) return -1;
  return 0;
}

/** Desplazamiento en pp hacia el Conservador por la campaña en esa provincia. */
export function efectoCampana(p: Provincia, e: EntradaModelo): number {
  const pr = e.presencia[p.id];
  const p0 = e.presencia0[p.id];
  const neto = pr.C - pr.P - (p0.C - p0.P);
  const ctrl = controlDe(p, pr) - e.control0[p.id];
  const k = ppPorPresencia(p.escanos);
  const ef = k * neto + 1.25 * k * ctrl;
  return Math.max(-12, Math.min(12, ef));
}

export function votosProvincia(p: Provincia, e: EntradaModelo, extraPP = 0): Votos {
  const b = p.base;
  const v: Votos = { ...b };
  const validos = Object.values(b).reduce((a, x) => a + (x ?? 0), 0);
  const g = (k: PartidoId) => v[k] ?? 0;

  // 1. fuerzas regionales afectadas por eventos: el trasvase sale (o va) a los dos bloques
  for (const [k, m] of Object.entries(e.modsPartido) as [RegionalId, number][]) {
    if (!m || !g(k)) continue;
    const delta = g(k) * m;
    const bloques = g('PP') + g('VOX') + g('PSOE') + g('SUMAR') + g('PODEMOS');
    if (bloques <= 0) continue;
    for (const q of [...BLOQUE_C, ...BLOQUE_P]) v[q] = Math.max(0, g(q) - (delta * g(q)) / bloques);
    v[k] = g(k) + delta;
  }

  // 2. bloques y reparto interno
  let R = g('PP') + g('VOX');
  let L = g('PSOE') + g('SUMAR') + g('PODEMOS');
  const cuotaVox = R > 0 ? g('VOX') / R : 0;
  const cuotaIzq = L > 0 ? (g('SUMAR') + g('PODEMOS')) / L : 0;
  const ratioSumar = g('SUMAR') + g('PODEMOS') > 0 ? g('SUMAR') / (g('SUMAR') + g('PODEMOS')) : 1;
  const sv = Math.max(0.02, Math.min(0.9, cuotaVox + PASO_SOCIO * e.socio.C));
  const si = Math.max(0.02, Math.min(0.9, cuotaIzq + PASO_SOCIO * e.socio.P));
  R = Math.max(0, R + validos * MOVILIZACION_SOCIO * e.socio.C);
  L = Math.max(0, L + validos * MOVILIZACION_SOCIO * e.socio.P);

  // 3. trasvase entre bloques: campaña provincial + ventaja nacional + eventos
  const pp = efectoCampana(p, e) + PP_POR_PV * e.ventaja + (e.modsProv[p.id] ?? 0) + (e.sesgo ?? 0) + extraPP;
  let t = (validos * pp) / 100;
  if (t > 0) t = Math.min(t, 0.85 * L);
  else t = Math.max(t, -0.85 * R);
  R += t;
  L -= t;

  v.PP = R * (1 - sv);
  v.VOX = R * sv;
  v.PSOE = L * (1 - si);
  const socios = L * si;
  const conjunta = e.listaConjunta === true || (e.listaConjunta === null && e.unidad >= 3);
  if (conjunta) {
    v.SUMAR = socios * SINERGIA_LISTA;
    v.PODEMOS = 0;
  } else {
    v.SUMAR = socios * ratioSumar;
    v.PODEMOS = socios * (1 - ratioSumar);
  }
  return v;
}

export interface Investidura {
  candidato: Bando;
  si: number;
  no: number;
  abst: number;
  exito: boolean;
  votacion: 1 | 2 | 0;
}

export interface Resultado {
  escanos: Votos; // nacional
  porProvincia: Record<string, Votos>;
  votos: Votos; // nacional
  bloque: { P: number; C: number };
  apoyos: { P: number; C: number }; // síes potenciales con afinidades
  investiduras: Investidura[];
  ganador: Bando | null;
  motivo: string;
  vetoVox: boolean;
}

export const REGIONALES: RegionalId[] = ['ERC', 'JUNTS', 'BILDU', 'PNV', 'BNG', 'CC', 'UPN', 'COMPROMIS', 'ADELANTE', 'NC'];
export const VETADOS_POR_VOX: RegionalId[] = ['PNV', 'JUNTS', 'CC'];

export function vetoVoxActivo(e: Pick<Estado, 'socio'>): boolean {
  return e.socio.C >= 0;
}

/** Voto de un partido en la investidura del candidato de `cand`. */
export function votoInvestidura(
  partido: PartidoId,
  cand: Bando,
  afinidad: Record<RegionalId, number>,
  veto: boolean,
): 'si' | 'no' | 'abst' {
  if (partido === 'PP' || partido === 'VOX') return cand === 'C' ? 'si' : 'no';
  if (partido === 'PSOE' || partido === 'SUMAR' || partido === 'PODEMOS') return cand === 'P' ? 'si' : 'no';
  if (partido === 'SALF') return cand === 'C' ? 'abst' : 'no';
  const a = (afinidad as Record<string, number>)[partido];
  if (a === undefined) return 'abst'; // Soria ¡Ya!, UPL, Teruel Existe…
  if (cand === 'C') {
    if (a >= 2) return veto && VETADOS_POR_VOX.includes(partido as RegionalId) ? 'abst' : 'si';
    if (a === 1) return 'abst';
    return 'no';
  }
  if (a <= -2) return 'si';
  if (a === -1) return 'abst';
  return 'no';
}

export function investir(escanos: Votos, cand: Bando, afinidad: Record<RegionalId, number>, veto: boolean): Investidura {
  let si = 0, no = 0, abst = 0;
  for (const [k, n] of Object.entries(escanos) as [PartidoId, number][]) {
    if (!n) continue;
    const v = votoInvestidura(k, cand, afinidad, veto);
    if (v === 'si') si += n;
    else if (v === 'no') no += n;
    else abst += n;
  }
  const exito = si >= 176 || si > no;
  return { candidato: cand, si, no, abst, exito, votacion: si >= 176 ? 1 : si > no ? 2 : 0 };
}

export function proyectar(
  provincias: Provincia[],
  e: EntradaModelo & Pick<Estado, 'afinidad'>,
  extraPP = 0,
): Resultado {
  const escanos: Votos = {};
  const votos: Votos = {};
  const porProvincia: Record<string, Votos> = {};
  for (const p of provincias) {
    const v = votosProvincia(p, e, extraPP);
    const r = dhondt(p.escanos, v);
    porProvincia[p.id] = r;
    for (const [k, n] of Object.entries(r) as [PartidoId, number][]) escanos[k] = (escanos[k] ?? 0) + n;
    for (const [k, n] of Object.entries(v) as [PartidoId, number][]) votos[k] = (votos[k] ?? 0) + n;
  }
  const bloque = {
    C: BLOQUE_C.reduce((a, k) => a + (escanos[k] ?? 0), 0),
    P: BLOQUE_P.reduce((a, k) => a + (escanos[k] ?? 0), 0),
  };
  const veto = vetoVoxActivo(e);
  const invC = investir(escanos, 'C', e.afinidad, veto);
  const invP = investir(escanos, 'P', e.afinidad, veto);
  const apoyos = { C: invC.si, P: invP.si };
  // el Rey propone primero al candidato del bloque con más escaños
  const orden: Bando[] = bloque.C >= bloque.P ? ['C', 'P'] : ['P', 'C'];
  const investiduras: Investidura[] = [];
  let ganador: Bando | null = null;
  let motivo = '';
  for (const b of orden) {
    const inv = b === 'C' ? invC : invP;
    investiduras.push(inv);
    if (inv.exito) {
      ganador = b;
      motivo = inv.votacion === 1 ? 'Investidura en primera votación (mayoría absoluta)' : 'Investidura en segunda votación (más síes que noes)';
      break;
    }
  }
  if (!ganador) {
    ganador = e.ventaja > 0 ? 'C' : 'P';
    motivo = e.ventaja === 0
      ? 'Bloqueo: nadie logra la investidura y el Gobierno sigue en funciones hasta la repetición electoral'
      : 'Bloqueo: repetición electoral. La gana quien lidera la Ventaja demoscópica';
  }
  return { escanos, porProvincia, votos, bloque, apoyos, investiduras, ganador, motivo, vetoVox: veto };
}
