import { createECDH, randomBytes, webcrypto } from 'node:crypto';
// @ts-expect-error: http_ece no trae tipos (es la implementación de referencia de RFC 8188)
import ece from 'http_ece';
import { respuestaAzar } from '../src/ia/azar';
import type { Bando } from '../src/motor/base';
import type { Asiento, EstadoOnline, ResumenPartida, SuscripcionPush } from '../src/online/protocolo';
import { procesar, type Almacen, type CambioPartida, type Entorno, type Fila } from '../src/online/servidor';
import { aB64url, cabeceraVapid, cifrar, deB64url, enviarPush, type ClavesVapid } from '../src/online/webpush';

// —— un almacén en memoria con las mismas garantías que la base de datos ——
function almacenEnMemoria(): Almacen & { filas: Map<string, Fila>; jugadas: Map<string, string>; subs: { id: string; bando: Bando; s: SuscripcionPush }[] } {
  const filas = new Map<string, Fila>();
  const jugadas = new Map<string, string>();
  const subs: { id: string; bando: Bando; s: SuscripcionPush }[] = [];
  const copia = <T>(x: T): T => JSON.parse(JSON.stringify(x));
  return {
    filas, jugadas, subs,
    async porId(id) { const f = filas.get(id); return f ? copia(f) : null; },
    async porCodigo(c) { const f = [...filas.values()].find((x) => x.codigo === c); return f ? copia(f) : null; },
    async insertar(f) {
      if ([...filas.values()].some((x) => x.codigo === f.codigo)) return 'repetido';
      const ahora = new Date().toISOString();
      filas.set(f.id, copia({ ...f, creada: ahora, actualizada: ahora }));
      return 'ok';
    },
    async ocuparAsiento(id, bando, h, nombre) {
      const f = filas.get(id)!;
      if (bando === 'P' ? f.token_p : f.token_c) return false;
      if (bando === 'P') { f.token_p = h; f.nombre_p = nombre; } else { f.token_c = h; f.nombre_c = nombre; }
      return true;
    },
    async aplicar(c: CambioPartida) {
      if (jugadas.has(c.jugada.jugadaId)) return 'repetida';
      const f = filas.get(c.id)!;
      if (f.n !== c.nAnterior) return 'conflicto';
      Object.assign(f, copia({ estado: c.estado, n: c.estado.n, turno_de: c.turno_de, ganador: c.ganador, actualizada: new Date().toISOString() }));
      jugadas.set(c.jugada.jugadaId, c.id);
      return 'ok';
    },
    async jugadaAplicada(j) { const p = jugadas.get(j); return p ? { partida: p } : null; },
    async guardarSuscripcion(id, bando, s) { subs.push({ id, bando, s }); },
  };
}

const entorno = (ahora = () => new Date()): Entorno => ({ ahora, azar: (n) => new Uint8Array(randomBytes(n)), vapidPublica: 'PUBLICA' });

describe('Web Push', () => {
  it('cifra con aes128gcm de forma que la implementación de referencia lo descifra', async () => {
    const ua = createECDH('prime256v1');
    ua.generateKeys();
    const auth = randomBytes(16);
    const sus: SuscripcionPush = { endpoint: 'https://push.example.com/x', keys: { p256dh: aB64url(ua.getPublicKey()), auth: aB64url(auth) } };
    const mensaje = JSON.stringify({ titulo: '176 · Te toca', cuerpo: 'Semana 3: tu rival ya ha jugado.', partida: 'abc' });
    const cifrado = await cifrar(sus, new TextEncoder().encode(mensaje));
    const claro = ece.decrypt(Buffer.from(cifrado), { version: 'aes128gcm', privateKey: ua, authSecret: aB64url(auth) });
    expect(claro.toString('utf8')).toBe(mensaje);
  });

  it('firma la cabecera VAPID con ES256 para el origen del servicio de avisos', async () => {
    const par = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const privada = await webcrypto.subtle.exportKey('jwk', par.privateKey);
    const publica = aB64url(new Uint8Array(await webcrypto.subtle.exportKey('raw', par.publicKey)));
    const claves: ClavesVapid = { publica, privada, sujeto: 'https://charlas-app-camara.vercel.app' };
    const cab = await cabeceraVapid('https://fcm.googleapis.com/fcm/send/abc', claves, Date.UTC(2026, 9, 25));
    const [, jwt, k] = cab.match(/^vapid t=([^,]+), k=(.+)$/)!;
    expect(k).toBe(publica);
    const [h, c, f] = jwt.split('.');
    expect(JSON.parse(new TextDecoder().decode(deB64url(h)))).toEqual({ typ: 'JWT', alg: 'ES256' });
    const carga = JSON.parse(new TextDecoder().decode(deB64url(c)));
    expect(carga.aud).toBe('https://fcm.googleapis.com');
    expect(carga.sub).toBe(claves.sujeto);
    expect(carga.exp).toBe(Date.UTC(2026, 9, 25) / 1000 + 12 * 3600);
    const valida = await webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, par.publicKey, deB64url(f), new TextEncoder().encode(`${h}.${c}`));
    expect(valida).toBe(true);
  });

  it('marca como caducadas las suscripciones que el servicio da por perdidas', async () => {
    const ua = createECDH('prime256v1');
    ua.generateKeys();
    const par = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
    const claves: ClavesVapid = { publica: 'x', privada: await webcrypto.subtle.exportKey('jwk', par.privateKey), sujeto: 'https://a.b' };
    const sus: SuscripcionPush = { endpoint: 'https://push.example.com/x', keys: { p256dh: aB64url(ua.getPublicKey()), auth: aB64url(randomBytes(16)) } };
    const con = (status: number) => (async () => new Response(null, { status })) as unknown as typeof fetch;
    expect(await enviarPush(sus, {}, claves, con(201))).toBe('enviado');
    expect(await enviarPush(sus, {}, claves, con(410))).toBe('caducada');
    expect(await enviarPush(sus, {}, claves, con(500))).toBe('error');
  });
});

describe('Servidor online', () => {
  const crear = async (alm: Almacen, bando: Bando = 'P', ent = entorno()) => (await procesar({ accion: 'crear', bando, nombre: 'Ana' }, alm, ent)).cuerpo as Asiento;
  const unirse = async (alm: Almacen, codigo: string, ent = entorno()) => procesar({ accion: 'unirse', codigo, nombre: 'Bea' }, alm, ent);

  it('crea una partida, el rival se une con el código y cada uno ve solo lo suyo', async () => {
    const alm = almacenEnMemoria();
    const a = await crear(alm, 'C');
    expect(a.bando).toBe('C');
    expect(a.codigo).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(a.rival.unido).toBe(false);
    const s = await unirse(alm, a.codigo.toLowerCase());
    expect(s.status).toBe(200);
    const b = s.cuerpo as Asiento;
    expect(b.bando).toBe('P');
    expect(b.rival).toEqual({ unido: true, nombre: 'Ana' });
    expect(s.avisos).toEqual([expect.objectContaining({ bando: 'C', titulo: '176 · Ya tienes rival' })]);
    // nadie más puede entrar
    expect((await unirse(alm, a.codigo)).status).toBe(409);
    // el token se guarda como huella, nunca en claro
    const f = alm.filas.get(a.id)!;
    expect(JSON.stringify(f)).not.toContain(a.token);
    // cada vista lleva solo su mano
    const vp = (await procesar({ accion: 'ver', id: a.id, token: b.token }, alm, entorno())).cuerpo as EstadoOnline;
    expect(vp.vista.yo).toBe('P');
    expect(vp.vista.mano).toEqual(f.estado.manos.P);
    expect(JSON.stringify(vp.vista)).not.toContain('"manos"');
    expect(JSON.stringify(vp.vista)).not.toContain('"rng"');
  });

  it('rechaza tokens ajenos, turnos que no tocan, vistas viejas y jugadas inválidas', async () => {
    const alm = almacenEnMemoria();
    const a = await crear(alm, 'P');
    const b = (await unirse(alm, a.codigo)).cuerpo as Asiento;
    const f = structuredClone(alm.filas.get(a.id)!);
    const d = f.estado.pendiente!;
    const quien = d.bando === 'P' ? a : b;
    const otro = d.bando === 'P' ? b : a;
    const r = respuestaAzar(d, { rng: 1 });
    expect((await procesar({ accion: 'ver', id: a.id, token: 'falso' }, alm, entorno())).status).toBe(403);
    expect((await procesar({ accion: 'jugar', id: a.id, token: otro.token, n: f.n, jugadaId: 'j0', respuesta: r }, alm, entorno())).status).toBe(403);
    expect((await procesar({ accion: 'jugar', id: a.id, token: quien.token, n: f.n - 1, jugadaId: 'j1', respuesta: r }, alm, entorno())).status).toBe(409);
    const mala = await procesar({ accion: 'jugar', id: a.id, token: quien.token, n: f.n, jugadaId: 'j2', respuesta: { tipo: 'accion', carta: 999999, modo: 'evento' } }, alm, entorno());
    expect(mala.status).toBe(400);
    expect((mala.cuerpo as { codigo: string }).codigo).toBe('invalida');
    // la buena, y su reintento (mismo identificador) no se aplica dos veces
    const buena = await procesar({ accion: 'jugar', id: a.id, token: quien.token, n: f.n, jugadaId: 'j3', respuesta: r }, alm, entorno());
    expect(buena.status).toBe(200);
    const n1 = (buena.cuerpo as EstadoOnline).n;
    expect(n1).toBe(f.n + 1);
    const otra = await procesar({ accion: 'jugar', id: a.id, token: quien.token, n: f.n, jugadaId: 'j3', respuesta: r }, alm, entorno());
    expect(otra.status).toBe(200);
    expect((otra.cuerpo as EstadoOnline).n).toBe(n1);
    expect(alm.filas.get(a.id)!.n).toBe(n1);
  });

  it('juega una partida entera por el protocolo, con avisos solo al pasar el turno', async () => {
    const alm = almacenEnMemoria();
    const a = await crear(alm, 'P');
    const b = (await unirse(alm, a.codigo)).cuerpo as Asiento;
    const token: Record<Bando, string> = { P: a.token, C: b.token };
    const azar = { rng: 7 };
    let jugadas = 0;
    let relevos = 0;
    for (let i = 0; i < 2000; i++) {
      const f = structuredClone(alm.filas.get(a.id)!);
      if (f.ganador) break;
      const bando = f.turno_de!;
      // el jugador decide con su vista, como en el móvil
      const v = ((await procesar({ accion: 'ver', id: a.id, token: token[bando] }, alm, entorno())).cuerpo as EstadoOnline).vista;
      expect(v.pendiente?.bando).toBe(bando);
      const s = await procesar({ accion: 'jugar', id: a.id, token: token[bando], n: f.n, jugadaId: `j${i}`, respuesta: respuestaAzar(v.pendiente!, azar) }, alm, entorno());
      expect(s.status, JSON.stringify(s.cuerpo)).toBe(200);
      expect(s.cambio).toEqual({ id: a.id, n: f.n + 1 });
      for (const av of s.avisos) expect(av.bando).not.toBe(bando);
      relevos += s.avisos.length;
      jugadas++;
    }
    const f = alm.filas.get(a.id)!;
    expect(f.ganador).not.toBeNull();
    expect(f.turno_de).toBeNull();
    expect(jugadas).toBeGreaterThan(20);
    expect(relevos).toBeGreaterThan(5);
    expect(relevos).toBeLessThan(jugadas);
    // terminada: no se puede seguir jugando
    const fin = await procesar({ accion: 'jugar', id: a.id, token: a.token, n: f.n, jugadaId: 'otra', respuesta: { tipo: 'opcion', i: 0 } }, alm, entorno());
    expect(fin.status).toBe(409);
  });

  it('con 2 jugadas por turno, cada jugador encadena dos acciones antes de pasar el turno', async () => {
    const alm = almacenEnMemoria();
    const a = await crear(alm, 'P');
    const b = (await unirse(alm, a.codigo)).cuerpo as Asiento;
    expect(a.ritmo).toBe(2);
    const token: Record<Bando, string> = { P: a.token, C: b.token };
    const seguidas: number[] = [];
    let racha = 0;
    let anterior: Bando | null = null;
    for (let i = 0; i < 60; i++) {
      const f = alm.filas.get(a.id)!;
      if (f.ganador) break;
      const d = f.estado.pendiente!;
      if (d.tipo === 'accion') {
        if (d.bando === anterior) racha++;
        else { if (anterior) seguidas.push(racha); racha = 1; anterior = d.bando; }
      }
      // siempre acción básica en la agenda: no abre decisiones intermedias
      const r = d.tipo === 'accion' ? { tipo: 'accion' as const, carta: 'basica' as const, modo: 'agenda' as const, destino: 'VIV', sentido: 'sube' as const } : respuestaAzar(d, { rng: i });
      await procesar({ accion: 'jugar', id: a.id, token: token[d.bando], n: f.n, jugadaId: `k${i}`, respuesta: r }, alm, entorno());
    }
    expect(seguidas.length).toBeGreaterThan(3);
    expect(seguidas.filter((x) => x === 2).length).toBeGreaterThan(seguidas.length / 2);
  });

  it('las invitaciones caducan a los 7 días y rendirse da la partida al rival', async () => {
    const alm = almacenEnMemoria();
    const a = await crear(alm, 'P');
    const tarde = entorno(() => new Date(Date.now() + 8 * 86400000));
    expect((await unirse(alm, a.codigo, tarde)).status).toBe(410);
    const b = (await unirse(alm, a.codigo)).cuerpo as Asiento;
    const s = await procesar({ accion: 'rendirse', id: a.id, token: b.token }, alm, entorno());
    expect(s.status).toBe(200);
    expect(alm.filas.get(a.id)!.ganador?.bando).toBe('P');
    expect(s.avisos[0]).toEqual(expect.objectContaining({ bando: 'P', titulo: '176 · Fin de la campaña' }));
    const res = (await procesar({ accion: 'resumen', partidas: [{ id: a.id, token: a.token }, { id: 'no-existe', token: 'x' }] }, alm, entorno())).cuerpo as ResumenPartida[];
    expect(res).toHaveLength(1);
    expect(res[0]).toEqual(expect.objectContaining({ bando: 'P', turno: null }));
    expect(res[0].ganador?.bando).toBe('P');
  });

  it('guarda suscripciones push válidas y rechaza las que no lo son', async () => {
    const alm = almacenEnMemoria();
    const a = await crear(alm, 'C');
    const s: SuscripcionPush = { endpoint: 'https://fcm.googleapis.com/fcm/send/xyz', keys: { p256dh: 'BPx', auth: 'aa' } };
    expect((await procesar({ accion: 'suscribir', id: a.id, token: a.token, suscripcion: s }, alm, entorno())).status).toBe(200);
    expect((await procesar({ accion: 'suscribir', id: a.id, token: a.token, suscripcion: { ...s, endpoint: 'http://inseguro' } }, alm, entorno())).status).toBe(400);
    expect(alm.subs).toEqual([{ id: a.id, bando: 'C', s }]);
    expect((await procesar({ accion: 'config' }, alm, entorno())).cuerpo).toEqual(expect.objectContaining({ vapidPublica: 'PUBLICA' }));
    expect((await procesar({ accion: 'nada' }, alm, entorno())).status).toBe(400);
    expect((await procesar(null, alm, entorno())).status).toBe(400);
  });
});
