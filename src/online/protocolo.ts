// El protocolo del modo online, común al cliente y a la Edge Function. Cada jugador se identifica en su partida
// con un token secreto de asiento (sin cuentas): quien lo tiene juega ese bloque. El servidor guarda el estado
// completo y a cada jugador solo le entrega su vista.
import type { Bando } from '../motor/base';
import type { Ganador, Respuesta } from '../motor/tipos';
import type { Vista } from '../motor/vista';

/** Una suscripción de avisos push del navegador (PushSubscription.toJSON()). */
export interface SuscripcionPush {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface Credencial {
  id: string;
  token: string;
}

export type Peticion =
  | { accion: 'config' }
  | { accion: 'crear'; bando: Bando; ritmo?: 1 | 2; nombre?: string }
  | { accion: 'unirse'; codigo: string; nombre?: string }
  | ({ accion: 'ver' } & Credencial)
  | { accion: 'resumen'; partidas: Credencial[] }
  | ({ accion: 'jugar'; n: number; jugadaId: string; respuesta: Respuesta } & Credencial)
  | ({ accion: 'rendirse' } & Credencial)
  | ({ accion: 'suscribir'; suscripcion: SuscripcionPush } & Credencial);

/** Lo que recibe un jugador de su partida. */
export interface EstadoOnline {
  id: string;
  codigo: string;
  bando: Bando;
  ritmo: number;
  n: number;
  vista: Vista;
  rival: { unido: boolean; nombre: string | null };
}

/** Al crear o unirse: el asiento (con su token, que hay que guardar) y la partida. */
export interface Asiento extends EstadoOnline {
  token: string;
}

/** Una línea de «Mis partidas». */
export interface ResumenPartida {
  id: string;
  codigo: string;
  bando: Bando;
  n: number;
  semana: number;
  /** a quién le toca: a mí, al rival o a nadie (terminada) */
  turno: 'yo' | 'rival' | null;
  rival: { unido: boolean; nombre: string | null };
  ganador: Ganador | null;
  actualizada: string;
}

export type CodigoError =
  | 'peticion' // mal formada
  | 'no-encontrada'
  | 'token' // el token no es de esta partida
  | 'llena' // los dos asientos ya están ocupados
  | 'caducada' // la invitación ha caducado
  | 'turno' // no te toca
  | 'conflicto' // la partida ha cambiado desde tu última vista
  | 'invalida' // la jugada no es válida
  | 'terminada'
  | 'version' // la partida es de otra versión del motor
  | 'interno';

export interface RespuestaError {
  error: string;
  codigo: CodigoError;
}

export interface Config {
  vapidPublica: string | null;
  versionMotor: number;
}

/** Sin I, O, 0 ni 1, para que el código se dicte sin errores. */
export const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const LARGO_CODIGO = 6;
/** Días que espera una invitación a que alguien se una. */
export const DIAS_INVITACION = 7;

export const normalizarCodigo = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, '');
