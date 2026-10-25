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
export const BLOQUE_P: PartidoId[] = ['PSOE', 'SUMAR'];

/** pp de voto por punto de presencia neta: más alto en circunscripciones pequeñas */
export function ppPorPresencia(escanos: number): number {
  return Math.max(0.6, Math.min(2.4, 2.4 / Math.sqrt(escanos / 4)));
}
export const PP_POR_PV = 0.4;
export const PASO_SOCIO = 0.03; // cuota del bloque por paso del medidor de socios
export const MOVILIZACION_SOCIO = 0.004; // votos válidos que añade/quita cada paso del medidor
export const PASO_PODEMOS = 0.25; // cada paso de fuerza multiplica su voto de partida por ±25%
export const PODEMOS_DESDE_IZQUIERDA = 0.8; // lo que gana Podemos sale en un 80% del bloque progresista y en un 20% del conservador

export const PODEMOS_POR_MARCADOR = 0.3; // cada marcador morado sube un 30% el voto de Podemos en la provincia

export type EntradaModelo = Pick<
  Estado,
  'presencia' | 'presencia0' | 'control0' | 'ventaja' | 'socio' | 'podemos' | 'modsProv' | 'modsPartido'
> & { sesgo?: number; morado?: Record<string, number> };

/** Control de una provincia. Los marcadores morados de Podemos suben su Fidelidad efectiva. */
export function controlDe(p: Provincia, pres: { P: number; C: number }, morado = 0): -1 | 0 | 1 {
  const f = p.fidelidad + morado;
  if (pres.C - pres.P >= f) return 1;
  if (pres.P - pres.C >= f) return -1;
  return 0;
}

/** Desplazamiento en pp hacia el Conservador por la campaña en esa provincia. */
export function efectoCampana(p: Provincia, e: EntradaModelo): number {
  const pr = e.presencia[p.id];
  const p0 = e.presencia0[p.id];
  const neto = pr.C - pr.P - (p0.C - p0.P);
  const ctrl = controlDe(p, pr, e.morado?.[p.id] ?? 0) - e.control0[p.id];
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
    const grandes: PartidoId[] = [...BLOQUE_C, ...BLOQUE_P, 'PODEMOS'];
    const bloques = grandes.reduce((a, q) => a + g(q), 0);
    if (bloques <= 0) continue;
    for (const q of grandes) v[q] = Math.max(0, g(q) - (delta * g(q)) / bloques);
    v[k] = g(k) + delta;
  }

  // 2. Podemos, el comodín: su fuerza le quita (o le devuelve) voto sobre todo a la izquierda
  const podemosBase = g('PODEMOS');
  const marcadores = e.morado?.[p.id] ?? 0;
  if (podemosBase > 0 && (e.podemos.fuerza || marcadores)) {
    const nuevo = podemosBase * Math.max(0, 1 + PASO_PODEMOS * e.podemos.fuerza + PODEMOS_POR_MARCADOR * marcadores);
    const delta = nuevo - podemosBase;
    const quitar = (bloque: PartidoId[], cantidad: number) => {
      const total = bloque.reduce((a, q) => a + g(q), 0);
      if (total <= 0) return;
      for (const q of bloque) v[q] = Math.max(0, g(q) - (cantidad * g(q)) / total);
    };
    quitar(BLOQUE_P, delta * PODEMOS_DESDE_IZQUIERDA);
    quitar(BLOQUE_C, delta * (1 - PODEMOS_DESDE_IZQUIERDA));
    v.PODEMOS = nuevo;
  }

  // 3. bloques y reparto interno
  let R = g('PP') + g('VOX');
  let L = g('PSOE') + g('SUMAR');
  const cuotaVox = R > 0 ? g('VOX') / R : 0;
  const cuotaIzq = L > 0 ? g('SUMAR') / L : 0;
  const sv = Math.max(0.02, Math.min(0.9, cuotaVox + PASO_SOCIO * e.socio.C));
  const si = Math.max(0.02, Math.min(0.9, cuotaIzq + PASO_SOCIO * e.socio.P));
  R = Math.max(0, R + validos * MOVILIZACION_SOCIO * e.socio.C);
  L = Math.max(0, L + validos * MOVILIZACION_SOCIO * e.socio.P);

  // 4. trasvase entre bloques: campaña provincial + ventaja nacional + eventos
  const pp = efectoCampana(p, e) + PP_POR_PV * e.ventaja + (e.modsProv[p.id] ?? 0) + (e.sesgo ?? 0) + extraPP;
  let t = (validos * pp) / 100;
  if (t > 0) t = Math.min(t, 0.85 * L);
  else t = Math.max(t, -0.85 * R);
  R += t;
  L -= t;

  v.PP = R * (1 - sv);
  v.VOX = R * sv;
  v.PSOE = L * (1 - si);
  v.SUMAR = L * si;
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

/** Lo que decide el voto de Podemos: su humor con el PSOE, la pinza (0-3) y el peso de Vox. */
export interface PosturaPodemos {
  humor: number;
  pinza: number;
  socioC: number;
}

/** Umbrales de la pinza: con 2 Podemos se abstiene con Feijóo; con 3, humor −3 y Vox muy débil, le vota sí. */
export const PINZA_ABSTENCION = 2;
export const PINZA_APOYO = 3;
export const VOX_MAXIMO_APOYO = -2;

/** Voto de Podemos. A Sánchez, según su humor: sí (≥1), abstención (0) o no (≤−1).
 *  A Feijóo, no, salvo la pinza: abstención con pinza 2 y humor ≤−2; sí con pinza 3, humor −3 y Vox en −2 o menos. */
export function votoPodemos(cand: Bando, pod: Partial<PosturaPodemos> = {}): 'si' | 'no' | 'abst' {
  const humor = pod.humor ?? 0;
  const pinza = pod.pinza ?? 0;
  if (cand === 'P') return humor >= 1 ? 'si' : humor === 0 ? 'abst' : 'no';
  if (pinza >= PINZA_APOYO && humor <= -3 && (pod.socioC ?? 0) <= VOX_MAXIMO_APOYO) return 'si';
  if (pinza >= PINZA_ABSTENCION && humor <= -2) return 'abst';
  return 'no';
}

export function posturaPodemos(e: Pick<Estado, 'podemos' | 'socio'>): PosturaPodemos {
  return { humor: e.podemos.humor, pinza: e.podemos.pinza ?? 0, socioC: e.socio.C };
}

/** Voto de un partido en la investidura del candidato de `cand`. */
export function votoInvestidura(
  partido: PartidoId,
  cand: Bando,
  afinidad: Record<RegionalId, number>,
  veto: boolean,
  pod: Partial<PosturaPodemos> = {},
): 'si' | 'no' | 'abst' {
  if (partido === 'PP' || partido === 'VOX') return cand === 'C' ? 'si' : 'no';
  if (partido === 'PSOE' || partido === 'SUMAR') return cand === 'P' ? 'si' : 'no';
  if (partido === 'PODEMOS') return votoPodemos(cand, pod);
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

export function investir(escanos: Votos, cand: Bando, afinidad: Record<RegionalId, number>, veto: boolean, pod: Partial<PosturaPodemos> = {}): Investidura {
  let si = 0, no = 0, abst = 0;
  for (const [k, n] of Object.entries(escanos) as [PartidoId, number][]) {
    if (!n) continue;
    const v = votoInvestidura(k, cand, afinidad, veto, pod);
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
  const pod = posturaPodemos(e);
  const invC = investir(escanos, 'C', e.afinidad, veto, pod);
  const invP = investir(escanos, 'P', e.afinidad, veto, pod);
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
