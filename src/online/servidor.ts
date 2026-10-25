// La lógica del servidor del modo online, como función pura sobre un almacén: la Edge Function de Supabase le da
// la base de datos y las pruebas, uno en memoria. No hace avisos ni difusiones: los devuelve para que los haga
// quien la llama, después de guardar.
import { RIVAL, type Bando } from '../motor/base';
import { terminar } from '../motor/cambios';
import { crearPartida, responder, VERSION_MOTOR } from '../motor/motor';
import type { Estado, Ganador, Respuesta } from '../motor/tipos';
import { vistaDe } from '../motor/vista';
import {
  ALFABETO_CODIGO, DIAS_INVITACION, LARGO_CODIGO, normalizarCodigo,
  type Asiento, type CodigoError, type Config, type Credencial, type EstadoOnline, type Peticion, type ResumenPartida, type SuscripcionPush,
} from './protocolo';

/** Una partida tal como se guarda. */
export interface Fila {
  id: string;
  codigo: string;
  version_motor: number;
  ritmo: number;
  n: number;
  turno_de: Bando | null;
  ganador: Ganador | null;
  estado: Estado;
  /** huella SHA-256 del token de cada asiento (null: libre) */
  token_p: string | null;
  token_c: string | null;
  nombre_p: string | null;
  nombre_c: string | null;
  creada: string;
  actualizada: string;
}

export interface CambioPartida {
  id: string;
  /** la n que se leyó: si ya no es la de la base de datos, hay conflicto */
  nAnterior: number;
  estado: Estado;
  turno_de: Bando | null;
  ganador: Ganador | null;
  jugada: { jugadaId: string; bando: Bando; respuesta: unknown };
}

export interface Almacen {
  porId(id: string): Promise<Fila | null>;
  porCodigo(codigo: string): Promise<Fila | null>;
  /** 'repetido' si el código ya existe */
  insertar(f: Omit<Fila, 'creada' | 'actualizada'>): Promise<'ok' | 'repetido'>;
  /** Ocupa el asiento solo si sigue libre. */
  ocuparAsiento(id: string, bando: Bando, huella: string, nombre: string | null): Promise<boolean>;
  /** Guarda el nuevo estado y la jugada en una sola transacción, solo si n no ha cambiado. */
  aplicar(c: CambioPartida): Promise<'ok' | 'conflicto' | 'repetida'>;
  jugadaAplicada(jugadaId: string): Promise<{ partida: string } | null>;
  guardarSuscripcion(id: string, bando: Bando, s: SuscripcionPush): Promise<void>;
}

export interface Entorno {
  ahora: () => Date;
  /** bytes aleatorios criptográficos */
  azar: (n: number) => Uint8Array;
  vapidPublica: string | null;
}

/** Un aviso para un jugador (push) y la difusión del cambio (tiempo real). */
export interface Aviso {
  partida: string;
  bando: Bando;
  titulo: string;
  cuerpo: string;
}

export interface Salida {
  status: number;
  cuerpo: unknown;
  avisos: Aviso[];
  /** partida que ha cambiado (para avisar en tiempo real a quien la tenga abierta) */
  cambio: { id: string; n: number } | null;
}

class ErrorOnline extends Error {
  constructor(public status: number, public codigo: CodigoError, mensaje: string) {
    super(mensaje);
  }
}

const NOMBRE_BLOQUE: Record<Bando, string> = { P: 'Progresista', C: 'Conservador' };
const MAX_PARTIDAS_RESUMEN = 40;

const b64url = (b: Uint8Array) => {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export async function huella(token: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)));
  return [...d].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function codigoNuevo(ent: Entorno): string {
  const b = ent.azar(LARGO_CODIGO);
  return [...b].map((x) => ALFABETO_CODIGO[x % ALFABETO_CODIGO.length]).join('');
}

function uuid(ent: Entorno): string {
  const b = ent.azar(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const limpiarNombre = (s: unknown): string | null => {
  if (typeof s !== 'string') return null;
  const t = s.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 24);
  return t || null;
};

const esTexto = (x: unknown, max = 200): x is string => typeof x === 'string' && x.length > 0 && x.length <= max;

/** El asiento del token en esta partida (o error). */
async function asiento(f: Fila, token: unknown): Promise<Bando> {
  if (!esTexto(token, 100)) throw new ErrorOnline(403, 'token', 'Falta el token de la partida');
  const h = await huella(token);
  if (f.token_p === h) return 'P';
  if (f.token_c === h) return 'C';
  throw new ErrorOnline(403, 'token', 'Este enlace no es de esta partida');
}

async function cargar(alm: Almacen, c: Partial<Credencial>): Promise<{ f: Fila; bando: Bando }> {
  if (!esTexto(c.id, 64)) throw new ErrorOnline(400, 'peticion', 'Falta la partida');
  const f = await alm.porId(c.id);
  if (!f) throw new ErrorOnline(404, 'no-encontrada', 'La partida no existe');
  const bando = await asiento(f, c.token);
  return { f, bando };
}

function estadoPara(f: Fila, bando: Bando): EstadoOnline {
  const rival = RIVAL[bando];
  return {
    id: f.id,
    codigo: f.codigo,
    bando,
    ritmo: f.ritmo,
    n: f.n,
    vista: vistaDe(f.estado, bando),
    rival: { unido: !!(rival === 'P' ? f.token_p : f.token_c), nombre: rival === 'P' ? f.nombre_p : f.nombre_c },
  };
}

function resumenDe(f: Fila, bando: Bando): ResumenPartida {
  const rival = RIVAL[bando];
  return {
    id: f.id,
    codigo: f.codigo,
    bando,
    n: f.n,
    semana: f.estado.semana,
    turno: f.ganador || !f.turno_de ? null : f.turno_de === bando ? 'yo' : 'rival',
    rival: { unido: !!(rival === 'P' ? f.token_p : f.token_c), nombre: rival === 'P' ? f.nombre_p : f.nombre_c },
    ganador: f.ganador,
    actualizada: f.actualizada,
  };
}

const ok = (cuerpo: unknown, avisos: Aviso[] = [], cambio: Salida['cambio'] = null): Salida => ({ status: 200, cuerpo, avisos, cambio });

function esRespuesta(r: unknown): r is Respuesta {
  if (!r || typeof r !== 'object') return false;
  const t = (r as { tipo?: unknown }).tipo;
  return t === 'accion' || t === 'opcion' || t === 'debate';
}

/** Procesa una petición del cliente. Nunca lanza: los errores salen como respuesta con su código. */
export async function procesar(pet: unknown, alm: Almacen, ent: Entorno): Promise<Salida> {
  try {
    if (!pet || typeof pet !== 'object') throw new ErrorOnline(400, 'peticion', 'Petición vacía');
    const p = pet as Peticion;
    switch (p.accion) {
      case 'config': {
        const c: Config = { vapidPublica: ent.vapidPublica, versionMotor: VERSION_MOTOR };
        return ok(c);
      }

      case 'crear': {
        if (p.bando !== 'P' && p.bando !== 'C') throw new ErrorOnline(400, 'peticion', 'Elige bloque');
        const ritmo = p.ritmo === 1 ? 1 : 2;
        const semilla = new DataView(ent.azar(4).buffer).getUint32(0) & 0x7fffffff;
        const estado = crearPartida(semilla, { ritmo });
        const token = b64url(ent.azar(24));
        const h = await huella(token);
        const nombre = limpiarNombre(p.nombre);
        for (let intento = 0; intento < 8; intento++) {
          const fila: Omit<Fila, 'creada' | 'actualizada'> = {
            id: uuid(ent),
            codigo: codigoNuevo(ent),
            version_motor: VERSION_MOTOR,
            ritmo,
            n: estado.n,
            turno_de: estado.pendiente?.bando ?? null,
            ganador: null,
            estado,
            token_p: p.bando === 'P' ? h : null,
            token_c: p.bando === 'C' ? h : null,
            nombre_p: p.bando === 'P' ? nombre : null,
            nombre_c: p.bando === 'C' ? nombre : null,
          };
          if ((await alm.insertar(fila)) === 'ok') {
            const ahora = ent.ahora().toISOString();
            const a: Asiento = { ...estadoPara({ ...fila, creada: ahora, actualizada: ahora }, p.bando), token };
            return ok(a);
          }
        }
        throw new ErrorOnline(500, 'interno', 'No se pudo crear la partida');
      }

      case 'unirse': {
        if (!esTexto(p.codigo, 20)) throw new ErrorOnline(400, 'peticion', 'Falta el código');
        const f = await alm.porCodigo(normalizarCodigo(p.codigo));
        if (!f) throw new ErrorOnline(404, 'no-encontrada', 'No hay ninguna partida con ese código');
        const libre: Bando | null = !f.token_p ? 'P' : !f.token_c ? 'C' : null;
        if (!libre) throw new ErrorOnline(409, 'llena', 'Esa partida ya tiene dos jugadores');
        if (ent.ahora().getTime() - new Date(f.creada).getTime() > DIAS_INVITACION * 86400000) {
          throw new ErrorOnline(410, 'caducada', 'La invitación ha caducado');
        }
        if (f.ganador) throw new ErrorOnline(409, 'terminada', 'Esa partida ya ha terminado');
        const token = b64url(ent.azar(24));
        const nombre = limpiarNombre(p.nombre);
        if (!(await alm.ocuparAsiento(f.id, libre, await huella(token), nombre))) {
          throw new ErrorOnline(409, 'llena', 'Alguien se ha unido antes que tú');
        }
        const g: Fila = { ...f, [libre === 'P' ? 'token_p' : 'token_c']: 'ocupado', [libre === 'P' ? 'nombre_p' : 'nombre_c']: nombre };
        const a: Asiento = { ...estadoPara(g, libre), token };
        const rival = RIVAL[libre];
        return ok(a, [{ partida: f.id, bando: rival, titulo: '176 · Ya tienes rival', cuerpo: `${nombre ?? 'Tu rival'} juega con el Bloque ${NOMBRE_BLOQUE[libre]}.` }], { id: f.id, n: f.n });
      }

      case 'ver': {
        const { f, bando } = await cargar(alm, p);
        return ok(estadoPara(f, bando));
      }

      case 'resumen': {
        if (!Array.isArray(p.partidas)) throw new ErrorOnline(400, 'peticion', 'Faltan las partidas');
        const res: ResumenPartida[] = [];
        for (const c of p.partidas.slice(0, MAX_PARTIDAS_RESUMEN)) {
          try {
            const { f, bando } = await cargar(alm, c);
            res.push(resumenDe(f, bando));
          } catch {
            // una partida borrada o un token viejo no impiden ver las demás
          }
        }
        return ok(res);
      }

      case 'jugar': {
        const { f, bando } = await cargar(alm, p);
        if (!esTexto(p.jugadaId, 64)) throw new ErrorOnline(400, 'peticion', 'Falta el identificador de la jugada');
        // reintento de una jugada ya aplicada: se devuelve el estado actual
        const previa = await alm.jugadaAplicada(p.jugadaId);
        if (previa) {
          if (previa.partida !== f.id) throw new ErrorOnline(400, 'peticion', 'Identificador de jugada repetido');
          return ok(estadoPara(f, bando));
        }
        if (f.version_motor !== VERSION_MOTOR) throw new ErrorOnline(409, 'version', 'Esta partida es de otra versión del juego');
        if (f.ganador) throw new ErrorOnline(409, 'terminada', 'La partida ya ha terminado');
        if (p.n !== f.n) throw new ErrorOnline(409, 'conflicto', 'La partida ha cambiado: vuelve a mirarla');
        const e = f.estado;
        if (!e.pendiente || e.pendiente.bando !== bando) throw new ErrorOnline(403, 'turno', 'No te toca');
        if (!esRespuesta(p.respuesta)) throw new ErrorOnline(400, 'invalida', 'Jugada mal formada');
        try {
          responder(e, p.respuesta);
        } catch (err) {
          throw new ErrorOnline(400, 'invalida', err instanceof Error ? err.message : 'Jugada no válida');
        }
        return await guardar(alm, f, bando, e, { jugadaId: p.jugadaId, bando, respuesta: p.respuesta });
      }

      case 'rendirse': {
        const { f, bando } = await cargar(alm, p);
        if (f.ganador) throw new ErrorOnline(409, 'terminada', 'La partida ya ha terminado');
        const e = f.estado;
        terminar(e, RIVAL[bando], `Abandono: el Bloque ${NOMBRE_BLOQUE[bando]} se retira de la campaña`);
        e.n++;
        return await guardar(alm, f, bando, e, { jugadaId: uuid(ent), bando, respuesta: { rendicion: true } });
      }

      case 'suscribir': {
        const { f, bando } = await cargar(alm, p);
        const s = p.suscripcion;
        if (!s || !esTexto(s.endpoint, 1000) || !/^https:\/\//.test(s.endpoint) || !esTexto(s.keys?.p256dh, 200) || !esTexto(s.keys?.auth, 100)) {
          throw new ErrorOnline(400, 'peticion', 'Suscripción no válida');
        }
        await alm.guardarSuscripcion(f.id, bando, { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } });
        return ok({ ok: true });
      }

      default:
        throw new ErrorOnline(400, 'peticion', 'Acción desconocida');
    }
  } catch (err) {
    if (err instanceof ErrorOnline) return { status: err.status, cuerpo: { error: err.message, codigo: err.codigo }, avisos: [], cambio: null };
    return { status: 500, cuerpo: { error: 'Error interno', codigo: 'interno' }, avisos: [], cambio: null };
  }
}

async function guardar(alm: Almacen, f: Fila, bando: Bando, e: Estado, jugada: CambioPartida['jugada']): Promise<Salida> {
  const turno = e.ganador ? null : e.pendiente?.bando ?? null;
  const r = await alm.aplicar({ id: f.id, nAnterior: f.n, estado: e, turno_de: turno, ganador: e.ganador, jugada });
  if (r === 'conflicto') throw new ErrorOnline(409, 'conflicto', 'La partida ha cambiado: vuelve a mirarla');
  const g: Fila = { ...f, n: e.n, estado: e, turno_de: turno, ganador: e.ganador };
  const rival = RIVAL[bando];
  const avisos: Aviso[] = [];
  if (e.ganador) {
    avisos.push({ partida: f.id, bando: rival, titulo: '176 · Fin de la campaña', cuerpo: e.ganador.motivo });
  } else if (turno === rival && f.turno_de !== rival) {
    // solo al pasar el turno: con 2 jugadas seguidas, un aviso por relevo
    avisos.push({ partida: f.id, bando: rival, titulo: '176 · Te toca', cuerpo: `Semana ${e.semana}: tu rival ya ha jugado.` });
  }
  return ok(estadoPara(g, bando), avisos, { id: f.id, n: e.n });
}
