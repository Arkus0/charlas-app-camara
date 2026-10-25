// Tipos del motor de «176 · La Batalla del 29N».

import type { Bando, Negociable, PartidoId, Provincia, RegionalId, Votos, Zona, ZonaId } from '../motor/base';
export type { Bando, Negociable, PartidoId, Provincia, RegionalId, Votos, Zona, ZonaId };
export { RIVAL } from '../motor/base';

export type Uso = 'evento' | 'ops' | 'carrera';
export type Operacion = 'presencia' | 'ofensiva' | 'debate' | 'negociacion';

/** P, C, N (neutral), E (encuesta), W (comodín de Podemos), A (Agenda de Podemos, no jugable) */
export type LadoCarta = 'P' | 'C' | 'N' | 'E' | 'W' | 'A';

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
  /** solo provincias que no controla ese bando */
  noControla?: 'yo' | 'rival';
  /** solo provincias sin control de nadie */
  sinControl?: boolean;
  /** solo provincias sin presencia de nadie */
  vacia?: boolean;
  feudo?: 'yo' | 'rival';
  maxFidelidad?: number;
}

/** Efectos que siguen en vigor tras jugarse (como NATO, Containment o Quagmire en TS). */
export type TipoEfectoActivo =
  | 'masOps' // +1 PC a las operaciones del dueño
  | 'menosOpsRival' // −1 PC a las operaciones del rival (mín. 1)
  | 'bonoZona' // +1 PC si todas las operaciones del dueño van a `zona`
  | 'protegeZonas' // el rival no puede lanzar ofensivas ni debates en provincias que el dueño controle en `zonas`
  | 'bastion' // el rival no puede lanzar ofensivas ni debates en `prov`
  | 'campanaLimpia' // las ofensivas del dueño en provincias clave no bajan el Clima
  | 'fontaneria' // +1 a las ofensivas del dueño en `zona`, −1 a las del rival
  | 'sombra' // −1 a los debates locales del rival
  | 'cerrojo' // el rival no puede colocar presencia por operaciones en `zona`
  | 'manifiesto' // +2 PV al dueño cada vez que el rival juega una carta de batalla
  | 'redAlerta' // si el Clima llega a 2 en una ronda del rival, el dueño coloca 1 presencia
  | 'mediacion' // en la próxima Encuesta de zona, el rival cuenta una provincia clave menos
  | 'plazaFuerte' // `prov` cuenta como clave para el dueño mientras la controle
  | 'jovenes' // +1 PV al dueño cada vez que el rival lanza una ofensiva
  | 'tregua' // −1 a todas las ofensivas
  | 'crisis' // si el rival lanza una ofensiva, pierde la partida
  | 'atasco' // el rival queda atascado en una crisis interna
  | 'cuentaAtras'; // el dueño gana 3 PV tras la próxima ronda del rival, salvo que juegue la Junta Electoral

export interface EfectoActivo {
  tipo: TipoEfectoActivo;
  dueno: Bando;
  hasta: 'turno' | 'partida' | 'uso';
  carta: number;
  zona?: ZonaId;
  zonas?: ZonaId[];
  prov?: string;
}

export type Cond =
  | { c: 'climaMin'; n: number }
  | { c: 'climaMax'; n: number }
  | { c: 'rivalAventaja'; n: number } // la Ventaja favorece al rival por n o más
  | { c: 'yoAventajo'; n: number }
  | { c: 'turnoMax'; n: number }
  | { c: 'humorPodemosMin'; n: number }
  | { c: 'socioMin'; bloque: 'yo' | 'rival'; n: number }
  | { c: 'socioMax'; bloque: 'yo' | 'rival'; n: number }
  | { c: 'mayoriaRival' } // la proyección da al rival 176 o más con sus socios
  | { c: 'afinidadMin'; partido: RegionalId; n: number } // afinidad hacia «yo» ≥ n
  | { c: 'vetoVox'; activo: boolean }
  | { c: 'controlaMas'; provs: string[] } // «yo» controla más de esas provincias que el rival
  | { c: 'masClaves' } // «yo» controla más provincias clave que el rival
  | { c: 'menosPresencia' } // «yo» tiene menos presencia total que el rival
  | { c: 'tengoCartaRival' } // «yo» tiene en la mano una carta con evento del rival
  | { c: 'bandera'; k: string }
  | { c: 'carreraDelante' } // «yo» va por delante en la Carrera
  | { c: 'carreraDetras' }
  | { c: 'climaIgual'; n: number }
  | { c: 'humorPodemosMax'; n: number }
  | { c: 'exigenciaMas' } // «yo» lleva esta semana más PC de ofensiva que el rival
  | { c: 'exigenciaCumplida' }; // «yo» ya cubre la Exigencia de las bases

export type Efecto =
  | { e: 'pv'; n: number }
  | { e: 'clima'; n: number; minimo?: number }
  | { e: 'colocar'; n: number; maxPor?: number; filtro?: Filtro; unaSola?: boolean }
  | { e: 'retirar'; n: number; maxPor?: number; filtro?: Filtro; de?: 'rival' | 'ambos'; unaSola?: boolean }
  | { e: 'retirarTodo'; provs: string[] }
  | { e: 'como'; bando: Bando | 'rival'; efectos: Efecto[] }
  | { e: 'aLider'; efectos: Efecto[] } // como el bando que lidera la Ventaja (empate: a dados)
  | { e: 'aRezagado'; efectos: Efecto[] }
  | { e: 'aCadaBloque'; efectos: Efecto[] } // primero el que va por detrás, después el líder
  | { e: 'alQueMenosPresencia'; efectos: Efecto[] }
  | { e: 'alQueControlaMas'; provs: string[]; efectos: Efecto[] }
  | { e: 'alQueVaDetras'; efectos: Efecto[] }
  | { e: 'duelo'; pv: number }
  | { e: 'fugaNacionalista'; pct: number }
  | { e: 'afinidadNeutral'; partido: RegionalId }
  | { e: 'socio'; bloque: 'yo' | 'rival' | 'P' | 'C'; n: number }
  | { e: 'podemos'; fuerza?: number; humor?: number; pinza?: number }
  | { e: 'morado'; n: number; filtro?: Filtro; maxPor?: number; quien?: 'yo' | 'rival' } // marcadores de Podemos (+/−)
  | { e: 'afinidad'; partido: RegionalId; n: number }
  | { e: 'afinidadElegir'; n: number; veces: number; sinVetados?: boolean }
  | { e: 'carrera'; n: number; sinPvPrimera?: boolean }
  | { e: 'carreraSiDetras'; n: number }
  | { e: 'exigencia'; n: number }
  | { e: 'ops'; pc: number; tipo: 'presencia' | 'ofensiva' | 'debate' | 'cualquiera'; filtro?: Filtro; ignorarAdy?: boolean; ignorarClima?: boolean }
  | { e: 'swing'; filtro: Filtro; pp: number }
  | { e: 'regional'; partido: RegionalId; pct: number }
  | { e: 'si'; cond: Cond; entonces: Efecto[]; sino?: Efecto[] }
  | { e: 'elegir'; quien?: 'yo' | 'rival'; opciones: { texto: string; efectos: Efecto[] }[] }
  | { e: 'dado'; tabla: { hasta: number; efectos: Efecto[] }[] }
  | { e: 'puntuar'; zona?: ZonaId; ignorarVeda?: boolean }
  | { e: 'espanaVaciada' }
  | { e: 'descarteAzar' }
  | { e: 'verMano' }
  | { e: 'robar'; n: number }
  | { e: 'texto'; s: string }
  | { e: 'pvPorRegionales'; minAfinRival: number; max: number }
  | { e: 'cis' }
  // —— mecánicas de Twilight Struggle ——
  | { e: 'activar'; tipo: TipoEfectoActivo; hasta: EfectoActivo['hasta']; zona?: ZonaId; zonas?: ZonaId[]; prov?: string; elegirProv?: Filtro; elegirZona?: boolean }
  | { e: 'cancelarEfecto'; tipo: TipoEfectoActivo; de: 'yo' | 'rival' }
  | { e: 'bandera'; k: string }
  | { e: 'batalla'; filtro?: Filtro } // guerra: dado − vecinas del rival; con 4+, la provincia es tuya y +2 PV
  | { e: 'tomar'; filtro?: Filtro } // retira la presencia rival y coloca la necesaria para controlar
  | { e: 'igualar'; provs: string[] }
  | { e: 'mover'; n: number; maxPor: number }
  | { e: 'comision' } // el rival descarta al azar; si es tu evento, se activa
  | { e: 'bloqueo'; prov: string; minOps: number }
  | { e: 'pvMenosClima'; base: number } // ganas base − Clima PV
  | { e: 'pactoNoAgresion' } // ganas Clima − 2 PV y el Clima sube 2
  | { e: 'fijarClima' }
  | { e: 'olimpiadas' }
  | { e: 'cumbre' }
  | { e: 'recuperar'; jugar: boolean }
  | { e: 'intercambio' }
  | { e: 'fichaje' }
  | { e: 'topo' }
  | { e: 'redibujar' }
  | { e: 'juntaElectoral' }
  | { e: 'votoUtilAMi' }
  | { e: 'pvPorControl'; provs: string[]; max?: number }
  | { e: 'pvSiMasClaves'; n: number }
  | { e: 'retirarTodoN'; n: number; filtro?: Filtro }
  | { e: 'escandalo'; filtro?: Filtro; poner: number }
  | { e: 'duplicar'; filtro?: Filtro; n: number }
  | { e: 'rondaExtra' }
  | { e: 'granCoalicion' }
  | { e: 'crisisInstitucional' }
  | { e: 'castigoCapitales' }
  | { e: 'controlar'; prov: string } // coloca la presencia necesaria para controlar la provincia
  | { e: 'moradoAuto'; n: number; de: 'lider' | 'rezagado' | 'ambos'; zona?: ZonaId }; // Podemos planta marcadores en la provincia más grande que controle un bloque

export interface Carta {
  id: number;
  nombre: string;
  ops: number;
  lado: LadoCarta;
  mazo: 0 | 1 | 2 | 3 | 4; // 0 = El Voto Útil, 4 = Agenda de Podemos
  retirar: boolean;
  texto: string; // texto del evento para el jugador
  contexto: string; // ambientación
  efectos: Efecto[];
  zona?: ZonaId; // para encuestas de zona
  /** el evento no se puede jugar si… */
  requisito?: Cond;
  /** carta de «batalla» (guerra): la castigan los manifiestos */
  batalla?: boolean;
  /** Tránsfuga: como Portada, anula la Portada del rival */
  transfuga?: boolean;
  /** descripción de la ilustración (se usa para el prompt de imagen) */
  escena: string;
  /** carta pareja del otro bloque (misma potencia) */
  pareja?: number;
  /** basada en una noticia real: el plató la comenta cuando se juega */
  noticia?: boolean;
}

export type Escenario = 'abierto' | 'realista';

export type Fase = 'preparacion' | 'portada' | 'acciones' | 'finTurno' | 'fin';

export type PropositoCarta =
  | 'portada' | 'accion' | 'debate' | 'descarte' // descarte: Maquinaria territorial / cambiar cartas
  | 'atasco' | 'junta' | 'recuperar' | 'topo' | 'bloqueo' | 'entregar' | 'jugar';

export type Decision =
  | { tipo: 'provincia'; bando: Bando; texto: string; opciones: string[]; opcional: boolean; restantes: number }
  | { tipo: 'carta'; bando: Bando; texto: string; proposito: PropositoCarta; opciones: number[]; usos: Record<number, Uso[]>; opcional: boolean }
  | { tipo: 'operacion'; bando: Bando; texto: string; carta: number; pc: number; opciones: Operacion[] }
  | { tipo: 'opcion'; bando: Bando; texto: string; opciones: string[] }
  | { tipo: 'partido'; bando: Bando; texto: string; opciones: Negociable[]; opcional: boolean };

export type Respuesta =
  | { tipo: 'provincia'; id: string | null }
  | { tipo: 'carta'; carta: number | null; uso?: Uso }
  | { tipo: 'operacion'; op: Operacion }
  | { tipo: 'opcion'; i: number }
  | { tipo: 'partido'; id: Negociable | null };

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

/** Lo que pasa en la semana, en datos, para que el plató cuente la historia. */
export type Suceso =
  | { s: 'carta'; bando: Bando; carta: number; uso: string }
  | { s: 'portada'; bando: Bando; carta: number; anulada?: boolean }
  | { s: 'pv'; bando: Bando; n: number }
  | { s: 'clima'; antes: number; despues: number; culpable: Bando | null }
  | { s: 'encuesta'; zona: ZonaId | 'CIS' | 'VAC'; neto: number; veda?: boolean; nivel?: { P: number; C: number } }
  | { s: 'ofensiva'; bando: Bando; prov: string; exito: boolean }
  | { s: 'batalla'; bando: Bando; prov: string; exito: boolean }
  | { s: 'debateTV'; tipo: 'cara' | 'cuatro'; ganador: Bando | null; dif: number }
  | { s: 'carrera'; bando: Bando; casilla: number }
  | { s: 'exigencia'; bando: Bando; falta: number }
  | { s: 'podemos'; fuerza: number; humor: number; pinza?: number }
  | { s: 'agenda'; carta: number; lider: Bando }
  | { s: 'negocia'; bando: Bando; partido: Negociable }
  | { s: 'socio'; bando: Bando; n: number }
  | { s: 'listas'; dado: number }
  | { s: 'efecto'; bando: Bando; tipo: TipoEfectoActivo; carta: number }
  | { s: 'atasco'; bando: Bando; sale: boolean }
  | { s: 'control'; prov: string; antes: Bando | null; despues: Bando | null };

export interface FotoTurno {
  turno: number;
  ventaja: number;
  clima: number;
  escanos: Votos;
  bloque: { P: number; C: number };
  apoyos: { P: number; C: number };
  ganadorProyectado: Bando | null;
  controles: Record<string, Bando | null>;
  morado: Record<string, number>;
  podemos: { fuerza: number; humor: number; pinza: number };
  socio: { P: number; C: number };
  carrera: { P: number; C: number };
  afinidad: Record<RegionalId, number>;
  sucesos: Suceso[];
}

export type Tarea = { t: string; [k: string]: any };

export interface Estado {
  version: 3;
  rng: number;
  turno: number;
  ronda: number;
  fase: Fase;
  enJuego: Bando | null; // bando en fase (phasing)
  presencia: Record<string, { P: number; C: number }>;
  presencia0: Record<string, { P: number; C: number }>;
  control0: Record<string, -1 | 0 | 1>;
  /** marcadores de Podemos: suben la Fidelidad efectiva y su voto en la provincia */
  morado: Record<string, number>;
  ventaja: number; // + favorece al Conservador
  escenario: Escenario;
  sesgo: number; // pp de partida hacia el Conservador (negativo: hacia el Progresista) según el escenario
  clima: number;
  exigencia: { P: number; C: number };
  carrera: { P: number; C: number };
  carreraTurno: { P: number; C: number };
  socio: { P: number; C: number }; // peso de los socios (Frente Amplio | Vox) respecto a la base
  /** Podemos, el comodín: fuerza (−3…+3, su voto respecto a las encuestas) y humor
   *  (−3…+3: 1 o más, sí a Sánchez; 0, abstención; −1 o menos, no) y pinza (0…3): la vía difícil para
   *  que apoye al bloque conservador (abstención con pinza 2 y humor ≤−2; sí con pinza 3, humor −3 y Vox ≤−2). */
  podemos: { fuerza: number; humor: number; pinza: number };
  afinidad: Record<RegionalId, number>; // − hacia P, + hacia C
  negociado: Negociable[]; // fuerzas negociadas este turno
  modsProv: Record<string, number>; // pp a favor del Conservador por eventos
  modsPartido: Partial<Record<RegionalId, number>>;
  efectos: EfectoActivo[];
  banderas: string[];
  rondaExtra: { P: number; C: number };
  mazo: number[];
  descarte: number[];
  retiradas: number[];
  manos: { P: number[]; C: number[] };
  agenda: number[]; // mazo de la Agenda de Podemos
  agendaActual: number | null;
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
  diario: Suceso[];
  historia: FotoTurno[];
}
