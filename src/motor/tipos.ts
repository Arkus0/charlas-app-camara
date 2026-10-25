// Tipos del juego de «176 · La Batalla del 29N» (versión para móvil).
import type { Bando, Negociable, RegionalId, ZonaId } from './base';
import type { Tarea } from './nucleo';

export type { Bando, Negociable, RegionalId, ZonaId };

// —— la Agenda: siete temas con calor de 0 a 5 ——
export type Tema = 'VIV' | 'SER' | 'DER' | 'ECO' | 'INM' | 'ESP' | 'COR';

// —— la Maquinaria de campaña ——
export type Rama = 'calle' | 'medios' | 'datos';

/** Cómo se juega una carta: su evento, sus PC en una operación o descartada para la Maquinaria. */
export type Modo = 'evento' | 'implantar' | 'atacar' | 'negociar' | 'agenda' | 'maquinaria';

export type MazoId = 'P' | 'C' | 'actualidad' | 'podemos';

export interface Filtro {
  zonas?: ZonaId[];
  provs?: string[];
  clave?: boolean;
  maxEscanos?: number;
  minEscanos?: number;
  maxFidelidad?: number;
  /** solo provincias donde ese bando tiene presencia */
  conPresencia?: 'yo' | 'rival';
  /** solo provincias que controla ese bando */
  controla?: 'yo' | 'rival';
  /** solo provincias que no controla ese bando */
  noControla?: 'yo' | 'rival';
  sinControl?: boolean;
  vacia?: boolean;
  feudo?: 'yo' | 'rival';
}

/** Lo que el evento pide elegir al jugarlo: una zona, una provincia, una fuerza regional o un tema. */
export type Destino =
  | { d: 'zona'; filtro?: Filtro }
  | { d: 'provincia'; filtro?: Filtro }
  | { d: 'partido'; partidos?: RegionalId[] }
  | { d: 'tema'; propio?: boolean };

/** Efectos que siguen en vigor tras jugarse. */
export type TipoEfectoActivo =
  | 'masPC' // +1 PC a las cartas del dueño
  | 'menosPCRival' // −1 PC a las cartas del rival (mín. 1)
  | 'bonoZona' // +1 PC a las operaciones del dueño en `zona`
  | 'bastion' // el rival no puede atacar `prov`
  | 'campanaLimpia'; // los ataques del dueño en provincias clave no bajan el Clima

export interface EfectoActivo {
  tipo: TipoEfectoActivo;
  dueno: Bando;
  hasta: 'semana' | 'partida';
  carta: number;
  zona?: ZonaId;
  prov?: string;
}

export type Cond =
  | { c: 'climaMin'; n: number }
  | { c: 'climaMax'; n: number }
  | { c: 'rivalAventaja'; n: number } // la Ventaja favorece al rival por n o más
  | { c: 'yoAventajo'; n: number }
  | { c: 'humorPodemosMin'; n: number }
  | { c: 'humorPodemosMax'; n: number }
  | { c: 'mayoriaRival' } // la proyección da al rival 176 apoyos o más
  | { c: 'masClaves' } // «yo» controla más provincias clave que el rival
  | { c: 'menosPresencia' }
  | { c: 'temaEnAgenda'; tema: Tema }
  | { c: 'temaPropioDominante' };

export type Efecto =
  | { e: 'pv'; n: number }
  | { e: 'clima'; n: number; minimo?: number }
  /** coloca presencia; con `reparto`, el jugador la reparte en el destino (zona o provincia) */
  | { e: 'colocar'; n: number; maxPor?: number; filtro?: Filtro; reparto?: boolean }
  /** retira presencia del rival (o de los dos bloques con `de: 'ambos'`) */
  | { e: 'retirar'; n: number; maxPor?: number; filtro?: Filtro; de?: 'rival' | 'ambos'; reparto?: boolean }
  | { e: 'retirarTodo'; provs?: string[]; enDestino?: boolean; de?: 'rival' | 'ambos' }
  | { e: 'controlar'; prov?: string } // sin prov: la provincia de destino
  | { e: 'tomar' } // en la provincia de destino: retira toda la presencia rival y coloca la necesaria para controlarla
  | { e: 'igualar' } // en la provincia de destino: iguala la presencia rival
  | { e: 'como'; bando: Bando | 'rival'; efectos: Efecto[] }
  | { e: 'aLider'; efectos: Efecto[] } // como quien lidera la Ventaja (empate: el Progresista)
  | { e: 'aRezagado'; efectos: Efecto[] }
  | { e: 'aCadaBloque'; efectos: Efecto[] } // primero el que va por detrás
  | { e: 'alQueControlaMas'; provs: string[]; efectos: Efecto[] }
  | { e: 'socio'; bloque: 'yo' | 'rival' | Bando; n: number }
  | { e: 'podemos'; fuerza?: number; humor?: number; pinza?: number }
  | { e: 'morado'; n: number; prov?: string; de?: 'lider' | 'ambos'; zona?: ZonaId }
  | { e: 'afinidad'; partido?: RegionalId; n: number } // sin partido: el de destino; n pasos hacia «yo»
  | { e: 'afinidadNeutral'; partido: RegionalId }
  | { e: 'regional'; partido?: RegionalId; pct: number } // sin partido: el de destino
  | { e: 'calor'; tema?: Tema; n: number } // sin tema: el de destino
  | { e: 'salpicar'; quien: 'yo' | 'rival' } // la Corrupción apunta a ese bloque
  | { e: 'robar'; n: number }
  | { e: 'descarteAzar' } // el rival descarta una carta al azar
  | { e: 'activar'; tipo: TipoEfectoActivo; hasta: 'semana' | 'partida'; zona?: ZonaId; prov?: string; enDestino?: boolean }
  | { e: 'acciones'; n: number } // acciones extra esta semana
  | { e: 'pvPorClaves'; max: number }
  | { e: 'si'; cond: Cond; entonces: Efecto[]; sino?: Efecto[] }
  | { e: 'elegir'; quien?: 'yo' | 'rival'; opciones: { texto: string; efectos: Efecto[] }[] }
  | { e: 'dado'; tabla: { hasta: number; efectos: Efecto[] }[] }
  | { e: 'duelo'; pv: number }; // cada bloque tira un dado; el mayor gana pv

export interface Carta {
  id: number;
  nombre: string;
  /** fuerza 1-4: los PC si se juega como campaña (0 en las noticias y la Agenda de Podemos) */
  fuerza: number;
  tema: Tema;
  mazo: MazoId;
  /** 1 precampaña (semanas 1-3), 2 campaña (4-6), 3 recta final (7-8) */
  fase: 1 | 2 | 3;
  texto: string;
  contexto: string;
  escena: string;
  efectos: Efecto[];
  destino?: Destino;
  requisito?: Cond;
  /** se retira del juego tras jugar su evento */
  retirar?: boolean;
  /** carta pareja del otro bloque (misma fuerza y fase, tema espejo) */
  pareja?: number;
  /** basada en una noticia real */
  noticia?: boolean;
  /** id de la ilustración si es distinto del de la carta (copias de una carta común) */
  arte?: number;
}

// —— decisiones y respuestas ——
export type IdCarta = number | 'basica' | 'pegada';

export interface OpcionAccion {
  carta: IdCarta;
  /** PC si se juega como campaña (con la Agenda y los efectos en vigor) */
  pc: number;
  /** destinos posibles de cada modo: zonas, provincias, partidos, temas o ramas ('-' = sin destino) */
  modos: Partial<Record<Modo, string[]>>;
}

export type Decision =
  | { tipo: 'accion'; bando: Bando; texto: string; opciones: OpcionAccion[]; quedan: number }
  | { tipo: 'opcion'; bando: Bando; texto: string; opciones: string[]; carta?: number }
  | { tipo: 'debate'; bando: Bando; texto: string; cartas: number[]; debate: 'cara' | 'cuatro' };

export type Respuesta =
  | { tipo: 'accion'; carta: IdCarta; modo: Modo; destino?: string; sentido?: 'sube' | 'baja'; reparto?: Record<string, number> }
  | { tipo: 'opcion'; i: number }
  | { tipo: 'debate'; carta: number | null; tema: Tema };

// —— crónica: lo que pasa, en datos (para animar, para el plató y para la IA) ——
export interface EntradaLog {
  seq: number;
  semana: number;
  bando: Bando | null;
  texto: string;
  tipo?: 'jugada' | 'dado' | 'pv' | 'clima' | 'fase' | 'aviso' | 'encuesta' | 'agenda';
}

export type DatoSuceso =
  | { s: 'semana' }
  | { s: 'jugada'; bando: Bando; carta: IdCarta; modo: Modo; destino?: string; pc: number }
  | { s: 'presencia'; bando: Bando; prov: string; n: number }
  | { s: 'control'; prov: string; antes: Bando | null; despues: Bando | null }
  | { s: 'pv'; bando: Bando; n: number }
  | { s: 'clima'; antes: number; despues: number; culpable: Bando | null }
  | { s: 'ataque'; bando: Bando; prov: string; dado: number; resultado: number; quitado: number; ganado: number }
  | { s: 'calor'; tema: Tema; antes: number; despues: number }
  | { s: 'dominante'; tema: Tema; dueno: Bando | null }
  | { s: 'encuesta'; zona: ZonaId | 'CIS'; neto: number; nivel?: { P: number; C: number } }
  | { s: 'noticia'; carta: number }
  | { s: 'agendaPodemos'; carta: number; lider: Bando }
  | { s: 'maquinaria'; bando: Bando; rama: Rama; nivel: number }
  | { s: 'negocia'; bando: Bando; partido: Negociable; pasos: number }
  | { s: 'socio'; bando: Bando; n: number }
  | { s: 'podemos'; fuerza: number; humor: number; pinza: number }
  | { s: 'afinidad'; partido: RegionalId; antes: number; despues: number }
  | { s: 'debateTV'; debate: 'cara' | 'cuatro'; P: { carta: number | null; tema: Tema; total: number }; C: { carta: number | null; tema: Tema; total: number }; ganador: Bando | null; dif: number }
  | { s: 'listas'; dado: number }
  | { s: 'dado'; bando: Bando | null; valor: number }
  | { s: 'fin'; ganador: Bando | null; motivo: string };

export type Suceso = DatoSuceso & { seq: number; semana: number };

export interface FotoSemana {
  semana: number;
  ventaja: number;
  clima: number;
  escanos: Partial<Record<string, number>>;
  bloque: { P: number; C: number };
  apoyos: { P: number; C: number };
  ganadorProyectado: Bando | null;
  controles: Record<string, Bando | null>;
  morado: Record<string, number>;
  podemos: { fuerza: number; humor: number; pinza: number };
  socio: { P: number; C: number };
  afinidad: Record<RegionalId, number>;
  calor: Record<Tema, number>;
  dominante: Tema | null;
  maquinaria: Record<Bando, Record<Rama, number>>;
}

export interface Ganador {
  bando: Bando | null;
  motivo: string;
}

export interface Cronica {
  seq: number;
  log: EntradaLog[];
  sucesos: Suceso[];
  historia: FotoSemana[];
}

export interface Estado {
  version: 5;
  /** número de respuestas aplicadas (para sincronizar el modo online) */
  n: number;
  rng: number;
  semana: number;
  fase: 'juego' | 'fin';
  /** bloque que está jugando su acción (el culpable si el Clima se rompe) */
  enJuego: Bando | null;
  /** acciones seguidas por turno: 1 contra la IA, 1 o 2 online */
  ritmo: number;

  // —— el modelo electoral (público) ——
  presencia: Record<string, { P: number; C: number }>;
  presencia0: Record<string, { P: number; C: number }>;
  control0: Record<string, -1 | 0 | 1>;
  /** marcadores de Podemos: suben la Fidelidad efectiva y su voto en la provincia */
  morado: Record<string, number>;
  ventaja: number; // + favorece al Conservador
  sesgo: number;
  clima: number;
  socio: { P: number; C: number };
  podemos: { fuerza: number; humor: number; pinza: number };
  afinidad: Record<RegionalId, number>; // − hacia P, + hacia C
  modsProv: Record<string, number>;
  modsPartido: Partial<Record<RegionalId, number>>;

  // —— campaña ——
  agenda: { calor: Record<Tema, number>; reciente: Record<Tema, number>; contador: number; corrupcion: Bando | null };
  maquinaria: Record<Bando, Record<Rama, number>>;
  maquinariaUsada: Record<Bando, boolean>;
  /** quién completó primero cada rama */
  completadas: Partial<Record<Rama, Bando>>;
  /** zona que se encuesta al cerrar cada semana (1-7) */
  calendario: Record<number, ZonaId | null>;
  acciones: Record<Bando, number>;
  negociado: Record<Bando, Negociable[]>;
  efectos: EfectoActivo[];

  // —— cartas (ocultas salvo la mano propia) ——
  mazos: Record<MazoId, number[]>;
  descartes: Record<Bando, number[]>;
  retiradas: number[];
  manos: Record<Bando, number[]>;
  noticia: number | null;
  agendaPodemos: number | null;

  pila: Tarea[];
  pendiente: Decision | null;
  ganador: Ganador | null;
  cronica: Cronica;
  /** sin crónica (simulaciones de la IA) */
  silencio?: boolean;
}
