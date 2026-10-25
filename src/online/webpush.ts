// Avisos Web Push sin dependencias, solo con WebCrypto (funciona en Deno y en Node): firma VAPID (RFC 8292) y
// cifrado del mensaje con aes128gcm (RFC 8291 y RFC 8188).
import type { SuscripcionPush } from './protocolo';

const te = new TextEncoder();

export const aB64url = (b: Uint8Array): string => {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const deB64url = (s: string): Uint8Array => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

const unir = (...partes: Uint8Array[]): Uint8Array => {
  const r = new Uint8Array(partes.reduce((a, p) => a + p.length, 0));
  let i = 0;
  for (const p of partes) { r.set(p, i); i += p.length; }
  return r;
};

/** Claves VAPID: la pública en bruto (65 bytes, base64url) y la privada como JWK. */
export interface ClavesVapid {
  publica: string;
  privada: JsonWebKey;
  /** contacto del servidor de avisos: una URL https o un mailto: */
  sujeto: string;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, largo: number): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, largo * 8));
}

/** Cifra el mensaje para una suscripción (aes128gcm). `efimera` y `sal` solo se pasan en las pruebas. */
export async function cifrar(
  sus: SuscripcionPush,
  mensaje: Uint8Array,
  prueba?: { efimera: CryptoKeyPair; sal: Uint8Array },
): Promise<Uint8Array> {
  const uaPublica = deB64url(sus.keys.p256dh);
  const secreto = deB64url(sus.keys.auth);
  const efimera = prueba?.efimera ?? (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']));
  const asPublica = new Uint8Array(await crypto.subtle.exportKey('raw', efimera.publicKey));
  const ua = await crypto.subtle.importKey('raw', uaPublica, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const compartido = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: ua }, efimera.privateKey, 256));
  const ikm = await hkdf(secreto, compartido, unir(te.encode('WebPush: info\0'), uaPublica, asPublica), 32);
  const sal = prueba?.sal ?? crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(sal, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(sal, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const clave = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // un solo registro: el mensaje y el delimitador 0x02 de último registro
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, clave, unir(mensaje, new Uint8Array([2]))));
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return unir(sal, rs, new Uint8Array([asPublica.length]), asPublica, cifrado);
}

/** La cabecera Authorization de VAPID para el servicio de avisos de `endpoint`. */
export async function cabeceraVapid(endpoint: string, claves: ClavesVapid, ahora = Date.now()): Promise<string> {
  const aud = new URL(endpoint).origin;
  const cab = aB64url(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const carga = aB64url(te.encode(JSON.stringify({ aud, exp: Math.floor(ahora / 1000) + 12 * 3600, sub: claves.sujeto })));
  const k = await crypto.subtle.importKey('jwk', { ...claves.privada, key_ops: ['sign'] }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  // WebCrypto firma ECDSA en formato r||s, que es justo el de JWS
  const firma = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, k, te.encode(`${cab}.${carga}`)));
  return `vapid t=${cab}.${carga}.${aB64url(firma)}, k=${claves.publica}`;
}

export type ResultadoPush = 'enviado' | 'caducada' | 'error';

/** Envía un aviso. 'caducada' (404/410) significa que hay que borrar la suscripción. */
export async function enviarPush(sus: SuscripcionPush, datos: unknown, claves: ClavesVapid, f: typeof fetch = fetch): Promise<ResultadoPush> {
  try {
    const cuerpo = await cifrar(sus, te.encode(JSON.stringify(datos)));
    const r = await f(sus.endpoint, {
      method: 'POST',
      headers: {
        Authorization: await cabeceraVapid(sus.endpoint, claves),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(3 * 86400),
        Urgency: 'normal',
      },
      body: cuerpo,
    });
    if (r.status === 404 || r.status === 410) return 'caducada';
    return r.ok ? 'enviado' : 'error';
  } catch {
    return 'error';
  }
}
