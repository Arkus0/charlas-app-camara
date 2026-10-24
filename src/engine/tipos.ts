// Tipos del motor de «176 · La Batalla del 29N».

export type Bando = 'P' | 'C'; // Progresista | Conservador
export const RIVAL: Record<Bando, Bando> = { P: 'C', C: 'P' };

export type ZonaId = 'AND' | 'CAT' | 'MAD' | 'LEV' | 'INT' | 'NOR' | 'CAN';

export type PartidoId =
  | 'PP' | 'VOX' | 'PSOE' | 'SUMAR' | 'PODEMOS'
  | 'ERC' | 'JUNTS' | 'BILDU' | 'PNV' | 'BNG' | 'CC' | 'UPN' | 'COMPROMIS' | 'ADELANTE' | 'NC'
  | 'SALF' | 'SORIA' | 'UPL' | 'TE' | 'OTROS' | 'BLANCO';

/** Fuerzas con las que se puede negociar (los «países neutrales»). */
export type RegionalId = 'ERC' | 'JUNTS' | 'BILDU' | 'PNV' | 'BNG' | 'CC' | 'UPN' | 'COMPROMIS' | 'ADELANTE' | 'NC';

export type Votos = Partial<Record<PartidoId, number>>;

export interface Provincia {
  id: string;
  nombre: string;
  corto: string;
  zona: ZonaId;
  escanos: number;
  fidelidad: number; // estabilidad (1-4)
  clave: boolean; // battleground
  feudo: Bando | null;
  vecinos: string[];
  x: number;
  y: number;
  base: Votos; // votos de partida (media de encuestas, oct-2026)
}

export interface Zona {
  id: ZonaId;
  nombre: string;
  /** PV por presencia / dominio / control */
  pv: [number, number, number];
  color: string;
}

export type Uso = 'evento' | 'ops' | 'carrera';
export type Operacion = 'presencia' | 'ofensiva' | 'debate' | 'negociacion';

export type LadoCarta = 'P' | 'C' | 'N' | 'E'; // E = encuesta

export interface Filtro {
  zonas?: ZonaId[];
  excluirZonas?: ZonaId[];
  provs?: string[];
  clave?: boolean;
  maxEscanos?: number;
  minEscanos?: number;
  /** solo provincias donde ese bando tiene presencia */
  conPresencia?: 'yo' | 'rival';
  /** solo provincias que controla ese bando */
  controla?: 'yo' | 'rival';
  feudo?: 'yo' | 'rival';
}

export type Cond =
  | { c: 'climaMin'; n: number }
  | { c: 'climaMax'; n: number }
  | { c: 'rivalAventaja'; n: number } // la Ventaja favorece al rival por n o más
  | { c: 'yoAventajo'; n: number }
  | { c: 'turnoMax'; n: number }
  | { c: 'listasAbiertas' }
  | { c: 'socioMin'; bloque: 'yo' | 'rival'; n: number }
  | { c: 'socioMax'; bloque: 'yo' | 'rival'; n: number }
  | { c: 'mayoriaRival' } // la proyección da al rival 176 o más con sus socios
  | { c: 'afinidadMin'; partido: RegionalId; n: number } // afinidad hacia «yo» ≥ n
  | { c: 'vetoVox'; activo: boolean }
  | { c: 'soyGobierno' }
  | { c: 'controlaMas'; provs: string[] } // «yo» controla más de esas provincias que el rival
  | { c: 'menosPresencia' }; // «yo» tiene menos presencia total que el rival

export type Efecto =
  | { e: 'pv'; n: number }
  | { e: 'clima'; n: number }
  | { e: 'colocar'; n: number; maxPor?: number; filtro?: Filtro; unaSola?: boolean }
  | { e: 'retirar'; n: number; maxPor?: number; filtro?: Filtro; de?: 'rival' | 'ambos'; unaSola?: boolean }
  | { e: 'retirarTodo'; provs: string[] }
  | { e: 'como'; bando: Bando; efectos: Efecto[] }
  | { e: 'alQueMenosPresencia'; efectos: Efecto[] }
  | { e: 'alQueControlaMas'; provs: string[]; efectos: Efecto[] }
  | { e: 'alQueVaDetras'; efectos: Efecto[] }
  | { e: 'duelo'; pv: number }
  | { e: 'fugaNacionalista'; pct: number }
  | { e: 'afinidadNeutral'; partido: RegionalId }
  | { e: 'socio'; bloque: 'yo' | 'rival' | 'P' | 'C'; n: number }
  | { e: 'unidad'; n: number }
  | { e: 'afinidad'; partido: RegionalId; n: number }
  | { e: 'afinidadElegir'; n: number; veces: number; partidos?: RegionalId[] }
  | { e: 'carrera'; n: number }
  | { e: 'exigencia'; n: number }
  | { e: 'ops'; pc: number; tipo: 'presencia' | 'ofensiva' | 'cualquiera'; filtro?: Filtro; ignorarAdy?: boolean }
  | { e: 'swing'; filtro: Filtro; pp: number }
  | { e: 'regional'; partido: RegionalId; pct: number }
  | { e: 'si'; cond: Cond; entonces: Efecto[]; sino?: Efecto[] }
  | { e: 'elegir'; quien?: 'yo' | 'rival'; opciones: { texto: string; efectos: Efecto[] }[] }
  | { e: 'dado'; tabla: { hasta: number; efectos: Efecto[] }[] }
  | { e: 'puntuar'; zona?: ZonaId; ignorarVeda?: boolean }
  | { e: 'descarteAzar' }
  | { e: 'verMano' }
  | { e: 'robar'; n: number }
  | { e: 'texto'; s: string }
  | { e: 'pvPorRegionales'; minAfinRival: number; max: number }
  | { e: 'cis' };

export interface Carta {
  id: number;
  nombre: string;
  ops: number;
  lado: LadoCarta;
  mazo: 0 | 1 | 2 | 3; // 0 = El Voto Útil
  retirar: boolean;
  texto: string; // texto del evento para el jugador
  contexto: string; // ambientación
  efectos: Efecto[];
  zona?: ZonaId; // para encuestas de zona
  /** no se puede jugar como evento si… (p. ej. ya resuelto) */
  requisito?: Cond;
}

export type Escenario = 'abierto' | 'realista';

export type Fase = 'preparacion' | 'portada' | 'acciones' | 'finTurno' | 'fin';

export type Decision =
  | { tipo: 'provincia'; bando: Bando; texto: string; opciones: string[]; opcional: boolean; restantes: number }
  | { tipo: 'carta'; bando: Bando; texto: string; proposito: 'portada' | 'accion' | 'debate' | 'descarte'; opciones: number[]; usos: Record<number, Uso[]>; opcional: boolean }
  | { tipo: 'operacion'; bando: Bando; texto: string; carta: number; pc: number; opciones: Operacion[] }
  | { tipo: 'opcion'; bando: Bando; texto: string; opciones: string[] }
  | { tipo: 'partido'; bando: Bando; texto: string; opciones: RegionalId[]; opcional: boolean };

export type Respuesta =
  | { tipo: 'provincia'; id: string | null }
  | { tipo: 'carta'; carta: number | null; uso?: Uso }
  | { tipo: 'operacion'; op: Operacion }
  | { tipo: 'opcion'; i: number }
  | { tipo: 'partido'; id: RegionalId | null };

export interface EntradaLog {
  turno: number;
  ronda: number;
  bando: Bando | null;
  texto: string;
  tipo?: 'evento' | 'dado' | 'pv' | 'clima' | 'fase' | 'aviso' | 'puntuacion';
}

export interface Ganador {
  bando: Bando | null;
  motivo: string;
}

export type Tarea = { t: string; [k: string]: any };

export interface Estado {
  version: 1;
  rng: number;
  turno: number;
  ronda: number;
  fase: Fase;
  enJuego: Bando | null; // bando en fase (phasing)
  presencia: Record<string, { P: number; C: number }>;
  presencia0: Record<string, { P: number; C: number }>;
  control0: Record<string, -1 | 0 | 1>;
  ventaja: number; // + favorece al Conservador
  escenario: Escenario;
  sesgo: number; // pp de partida hacia el Conservador (negativo: hacia el Progresista) según el escenario
  clima: number;
  exigencia: { P: number; C: number };
  carrera: { P: number; C: number };
  carreraTurno: { P: number; C: number };
  socio: { P: number; C: number }; // peso de los socios (Sumar/Podemos | Vox) respecto a la base
  unidad: number;
  listaConjunta: boolean | null;
  afinidad: Record<RegionalId, number>; // − hacia P, + hacia C
  negociado: RegionalId[]; // partidos negociados este turno
  modsProv: Record<string, number>; // pp a favor del Conservador por eventos
  modsPartido: Partial<Record<RegionalId, number>>;
  mazo: number[];
  descarte: number[];
  retiradas: number[];
  manos: { P: number[]; C: number[] };
  votoUtil: { duenio: Bando; disponible: boolean };
  portada: { P: number | null; C: number | null };
  rondasHechas: { P: number; C: number };
  pila: Tarea[];
  pendiente: Decision | null;
  log: EntradaLog[];
  silencio?: boolean;
  ganador: Ganador | null;
  manoVista: { P: boolean; C: boolean };
  debate: { P: number | null; C: number | null };
  ultimaJugada: { bando: Bando; carta: number; uso: string } | null;
}
