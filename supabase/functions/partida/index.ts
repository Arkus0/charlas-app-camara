// Edge Function `partida`: el servidor del modo online. Recibe las peticiones del juego (crear, unirse, ver,
// jugar, rendirse, suscribirse a avisos), las procesa con la lógica de src/online/servidor.ts (empaquetada en
// motor.js con `npm run empaquetar`) y, tras guardar, envía los avisos push y difunde el cambio en tiempo real.
// Se despliega sin verificar JWT: cada partida se protege con el token secreto de cada asiento. No necesita secretos
// propios: las claves VAPID de los avisos las genera la primera vez y las guarda en la tabla `ajustes`.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import * as motor from './motor.js';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

type Bando = 'P' | 'C';
interface Suscripcion { endpoint: string; keys: { p256dh: string; auth: string } }
interface Aviso { partida: string; bando: Bando; titulo: string; cuerpo: string }
interface Salida { status: number; cuerpo: unknown; avisos: Aviso[]; cambio: { id: string; n: number } | null }

// motor.js es JavaScript minificado: sus tipos se declaran aquí (los de verdad están en src/online/servidor.ts)
const procesar = motor.procesar as (peticion: unknown, almacen: unknown, entorno: unknown) => Promise<Salida>;
const enviarPush = motor.enviarPush as (s: Suscripcion, datos: unknown, claves: ClavesVapid) => Promise<'enviado' | 'caducada' | 'error'>;

const URL_SB = Deno.env.get('SUPABASE_URL')!;
const CLAVE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(URL_SB, CLAVE, { auth: { persistSession: false, autoRefreshToken: false } });

const SUJETO_VAPID = 'https://charlas-app-camara.vercel.app';
interface ClavesVapid { publica: string; privada: JsonWebKey; sujeto: string }
let vapid: Promise<ClavesVapid | null> | null = null;

const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Las claves VAPID del servidor: se generan la primera vez y se guardan en `ajustes` (solo la clave de servicio las lee). */
function clavesVapid(): Promise<ClavesVapid | null> {
  vapid ??= (async () => {
    const leer = async () => (await db.from('ajustes').select('valor').eq('clave', 'vapid').maybeSingle()).data?.valor as { publica: string; privada: JsonWebKey } | undefined;
    let v = await leer();
    if (!v) {
      const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
      const nuevas = {
        publica: b64url(new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey))),
        privada: await crypto.subtle.exportKey('jwk', par.privateKey),
      };
      // si dos instancias las crean a la vez, gana la primera y las dos usan esa
      await db.from('ajustes').insert({ clave: 'vapid', valor: nuevas });
      v = await leer();
    }
    return v ? { ...v, sujeto: SUJETO_VAPID } : null;
  })().catch(() => { vapid = null; return null; });
  return vapid;
}

const MAX_CUERPO = 64 * 1024;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Max-Age': '86400',
};

const json = (status: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

function falla(error: { message?: string } | null): never {
  throw new Error(error?.message ?? 'Error de la base de datos');
}

const almacen = {
  async porId(id: string) {
    const { data, error } = await db.from('partidas').select('*').eq('id', id).maybeSingle();
    if (error) falla(error);
    return data;
  },
  async porCodigo(codigo: string) {
    const { data, error } = await db.from('partidas').select('*').eq('codigo', codigo).maybeSingle();
    if (error) falla(error);
    return data;
  },
  async insertar(fila: Record<string, unknown>) {
    const { error } = await db.from('partidas').insert(fila);
    if (!error) return 'ok';
    if (error.code === '23505') return 'repetido';
    falla(error);
  },
  async ocuparAsiento(id: string, bando: Bando, huella: string, nombre: string | null) {
    const token = bando === 'P' ? 'token_p' : 'token_c';
    const nom = bando === 'P' ? 'nombre_p' : 'nombre_c';
    const { data, error } = await db.from('partidas').update({ [token]: huella, [nom]: nombre }).eq('id', id).is(token, null).select('id');
    if (error) falla(error);
    return (data?.length ?? 0) > 0;
  },
  async aplicar(c: { id: string; nAnterior: number; estado: unknown; turno_de: Bando | null; ganador: unknown; jugada: { jugadaId: string; bando: Bando; respuesta: unknown } }) {
    const { data, error } = await db.rpc('aplicar_jugada', {
      p_id: c.id, p_n: c.nAnterior, p_estado: c.estado, p_turno: c.turno_de, p_ganador: c.ganador,
      p_jugada_id: c.jugada.jugadaId, p_bando: c.jugada.bando, p_respuesta: c.jugada.respuesta,
    });
    if (error) falla(error);
    return data;
  },
  async jugadaAplicada(jugadaId: string) {
    const { data, error } = await db.from('jugadas').select('partida_id').eq('jugada_id', jugadaId).maybeSingle();
    if (error) falla(error);
    return data ? { partida: data.partida_id as string } : null;
  },
  async guardarSuscripcion(id: string, bando: Bando, s: Suscripcion) {
    const { error } = await db.from('suscripciones_push').upsert({ partida_id: id, bando, endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth });
    if (error) falla(error);
  },
};

async function avisar(a: Aviso) {
  const claves = await clavesVapid();
  if (!claves) return;
  const { data } = await db.from('suscripciones_push').select('endpoint, p256dh, auth').eq('partida_id', a.partida).eq('bando', a.bando);
  for (const s of data ?? []) {
    const r = await enviarPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, { titulo: a.titulo, cuerpo: a.cuerpo, partida: a.partida, url: `./#/p/${a.partida}` }, claves);
    if (r === 'caducada') await db.from('suscripciones_push').delete().eq('endpoint', s.endpoint);
  }
}

/** Avisa en tiempo real a quien tenga la partida abierta (solo el número de jugada: nada secreto). */
async function difundir(id: string, n: number) {
  await fetch(`${URL_SB}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: { apikey: CLAVE, Authorization: `Bearer ${CLAVE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ topic: `partida-${id}`, event: 'cambio', payload: { n } }] }),
  }).catch(() => undefined);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'Solo POST', codigo: 'peticion' });
  const texto = await req.text();
  if (texto.length > MAX_CUERPO) return json(413, { error: 'Petición demasiado grande', codigo: 'peticion' });
  let peticion: unknown;
  try {
    peticion = JSON.parse(texto);
  } catch {
    return json(400, { error: 'JSON no válido', codigo: 'peticion' });
  }
  const salida = await procesar(peticion, almacen, {
    ahora: () => new Date(),
    azar: (n: number) => crypto.getRandomValues(new Uint8Array(n)),
    vapidPublica: (peticion as { accion?: string })?.accion === 'config' ? (await clavesVapid())?.publica ?? null : null,
  });
  const despues = Promise.all([
    ...salida.avisos.map((a) => avisar(a).catch(() => undefined)),
    salida.cambio ? difundir(salida.cambio.id, salida.cambio.n) : Promise.resolve(),
  ]);
  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(despues);
  else await despues;
  return json(salida.status, salida.cuerpo);
});
