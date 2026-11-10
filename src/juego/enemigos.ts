// Enemigos comunes y proyectiles.
import { DX, DY, T, type Dir, type Ent } from '../tipos';
import { G, type Juego } from './juego';

export interface DefEnemigo {
  nombre: string;
  vida: number;
  vel: number;
  dano: number;
  pal: string;
  botin: [number, number];
  ia: 'cuerpo' | 'embiste' | 'lanza' | 'perro' | 'cartas' | 'carga';
  alcance?: number;
  prep?: number;
  pausa?: number;
  pesado?: boolean;
  rx?: number;
  ry?: number;
  /** multiplicador del daño recibido (0 = bloqueado) */
  recibe?: (j: Juego, e: Ent, clase: string, ox: number, oy: number) => number;
}

/** El guardaespaldas para los golpes de frente salvo cuando él mismo ataca. */
function escudo(_j: Juego, e: Ent, clase: string, ox: number, oy: number): number {
  if (clase === 'giro' || clase === 'remate' || clase === 'explosion') return 1;
  if (e.est === 'ataca' || e.est === 'recupera' || e.est === 'aturdido') return 1;
  const d = Math.hypot(ox - e.x, oy - e.y) || 1;
  const frente = (DX[e.dir] * (ox - e.x) + DY[e.dir] * (oy - e.y)) / d;
  return frente > 0.3 ? 0 : 1;
}

export const ENEMIGOS: Record<string, DefEnemigo> = {
  maton: { nombre: 'Matón', vida: 8, vel: 0.55, dano: 1, pal: 'maton', botin: [1, 2], ia: 'cuerpo', alcance: 17, prep: 24 },
  navajero: { nombre: 'Navajero', vida: 6, vel: 0.8, dano: 2, pal: 'navajero', botin: [1, 3], ia: 'embiste' },
  botellero: { nombre: 'Lanzabotellas', vida: 5, vel: 0.5, dano: 1, pal: 'botellero', botin: [1, 3], ia: 'lanza' },
  perro: { nombre: 'Perro de presa', vida: 4, vel: 1.1, dano: 1, pal: 'perro', botin: [0, 1], ia: 'perro', rx: 5, ry: 4 },
  estibador: { nombre: 'Estibador', vida: 18, vel: 0.4, dano: 2, pal: 'estibador', botin: [2, 4], ia: 'cuerpo', alcance: 21, prep: 32, pausa: 44, pesado: true },
  crupier: { nombre: 'Crupier', vida: 9, vel: 0.65, dano: 2, pal: 'crupier', botin: [2, 4], ia: 'cartas' },
  novillero: { nombre: 'Novillero', vida: 10, vel: 0.5, dano: 2, pal: 'novillero', botin: [2, 3], ia: 'carga' },
  guardaespaldas: { nombre: 'Guardaespaldas', vida: 16, vel: 0.55, dano: 2, pal: 'guardaespaldas', botin: [2, 5], ia: 'cuerpo', alcance: 18, prep: 20, pausa: 38, recibe: escudo },
};

export function mirar(e: Ent, dx: number, dy: number): void {
  e.dir = (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 0 : 2) as Dir;
}

/** Camina en una dirección, apartándose un poco de los compañeros para no amontonarse. */
export function andar(j: Juego, e: Ent, ux: number, uy: number, vel: number): number {
  let vx = ux * vel, vy = uy * vel;
  for (const o of j.ents) {
    if (o === e || !o.vivo || (o.tipo !== 'enemigo' && o.tipo !== 'jefe')) continue;
    const dx = e.x - o.x, dy = e.y - o.y;
    const d = Math.hypot(dx, dy);
    if (d < 13 && d > 0.01) { vx += (dx / d) * 0.35; vy += (dy / d) * 0.35; }
  }
  e.anda = (e.anda ?? 0) + vel;
  return j.mover(e, vx, vy, true);
}

export function disparar(j: Juego, e: Ent, clase: string, ux: number, uy: number, vel: number, dano: number, extra: Record<string, any> = {}): Ent {
  return j.crear('proy', e.x + ux * 8, e.y + uy * 6, { z: e.z + 10, clase, vx: ux * vel, vy: uy * vel, dano, vida: 90, rx: 3, ry: 3, dueno: e, base: e.z, ...extra });
}

export function tocaJugador(j: Juego, e: Ent, radio: number): boolean {
  const p = j.jug;
  return Math.hypot(p.x - e.x, p.y - e.y) < radio && Math.abs(p.z - e.z) < 16;
}

export function actualizarEnemigo(j: Juego, e: Ent): void {
  const d = ENEMIGOS[e.cls];
  const p = j.jug;
  if (e.flash > 0) e.flash--;
  if (Math.abs(e.kx) + Math.abs(e.ky) > 0.05) { j.mover(e, e.kx, e.ky, true); e.kx *= 0.8; e.ky *= 0.8; }
  j.fisica(e);
  const dx = p.x - e.x, dy = p.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist, uy = dy / dist;
  const diana = p.est !== 'cae' && p.est !== 'muerto';
  if (!e.alerta) {
    if (dist < 92 && Math.abs(p.z - e.z) < 40 && diana) { e.alerta = true; e.est = 'anda'; e.t = 30 + Math.floor(j.azar() * 30); j.fx('aviso', e.x, e.y, e.z + 30, 1, 30); }
    else return;
  }
  if (e.est === 'golpeado') { if (--e.t <= 0) { e.est = 'anda'; e.t = 20; } return; }
  if (e.est === 'aturdido') { if (--e.t <= 0) { e.est = 'anda'; e.t = 40; } return; }
  if (e.est === 'recupera') { if (--e.t <= 0) { e.est = 'anda'; e.t = 40 + Math.floor(j.azar() * 40); } return; }
  if (!diana) return;
  const lado = e.id % 2 ? 1 : -1;

  switch (d.ia) {
    case 'cuerpo': {
      const alcance = d.alcance ?? 17;
      if (e.est === 'anda') {
        mirar(e, dx, dy);
        if (dist > alcance) andar(j, e, ux + -uy * 0.25 * lado, uy + ux * 0.25 * lado, d.vel);
        else { e.est = 'prepara'; e.t = d.prep ?? 24; }
      } else if (e.est === 'prepara') {
        if (--e.t <= 0) { e.est = 'ataca'; e.t = 10; e.dado = false; j.sfx('zas'); }
      } else if (e.est === 'ataca') {
        const cx = e.x + DX[e.dir] * 11, cy = e.y + DY[e.dir] * 9;
        if (!e.dado && Math.hypot(p.x - cx, p.y - cy) < alcance * 0.6 + 6 && Math.abs(p.z - e.z) < 16 && j.danarJugador(d.dano, e.x, e.y)) e.dado = true;
        if (--e.t <= 0) { e.est = 'recupera'; e.t = d.pausa ?? 34; }
      }
      break;
    }
    case 'embiste':
      if (e.est === 'anda') {
        mirar(e, dx, dy);
        if (dist > 48) andar(j, e, ux, uy, d.vel);
        else if (--e.t <= 0) { e.est = 'prepara'; e.t = 20; e.ux = ux; e.uy = uy; }
        else andar(j, e, -uy * lado, ux * lado, d.vel * 0.7);
      } else if (e.est === 'prepara') {
        if (--e.t <= 0) { e.est = 'ataca'; e.t = 15; e.dado = false; j.sfx('zas'); }
      } else if (e.est === 'ataca') {
        j.mover(e, e.ux * 2.7, e.uy * 2.7, true);
        if (!e.dado && tocaJugador(j, e, 11) && j.danarJugador(d.dano, e.x, e.y)) e.dado = true;
        if (--e.t <= 0) { e.est = 'recupera'; e.t = 38; }
      }
      break;
    case 'lanza':
      if (e.est === 'anda') {
        mirar(e, dx, dy);
        if (dist < 50) andar(j, e, -ux, -uy, d.vel);
        else if (dist > 92) andar(j, e, ux, uy, d.vel);
        else andar(j, e, -uy * lado, ux * lado, d.vel * 0.5);
        if (--e.t <= 0 && dist < 120) { e.est = 'prepara'; e.t = 20; }
      } else if (e.est === 'prepara') {
        if (--e.t <= 0) {
          const n = 42;
          j.crear('proy', e.x, e.y, { z: e.z + 12, clase: 'botella', vx: dx / n, vy: dy / n, vz: (G * n) / 2 - 12 / n, dano: d.dano, vida: 200, arco: true, base: p.z, rx: 3, ry: 3, dueno: e });
          j.sfx('lanza');
          e.est = 'recupera'; e.t = 30;
        }
      }
      break;
    case 'perro':
      if (e.est === 'anda') {
        mirar(e, dx, dy);
        const zig = Math.sin(j.tic * 0.15 + e.id) * 0.6;
        andar(j, e, ux - uy * zig, uy + ux * zig, d.vel);
        if (tocaJugador(j, e, 11) && j.danarJugador(d.dano, e.x, e.y)) { j.sfx('ladra'); e.est = 'huye'; e.t = 45; }
      } else if (e.est === 'huye') {
        andar(j, e, -ux, -uy, d.vel * 0.8);
        if (--e.t <= 0) e.est = 'anda';
      }
      break;
    case 'cartas':
      if (e.est === 'anda') {
        mirar(e, dx, dy);
        if (dist < 46) andar(j, e, -ux, -uy, d.vel);
        else if (dist > 88) andar(j, e, ux, uy, d.vel);
        else andar(j, e, -uy * lado, ux * lado, d.vel);
        if (--e.t <= 0 && dist < 130) { e.est = 'prepara'; e.t = 18; }
      } else if (e.est === 'prepara') {
        if (--e.t <= 0) {
          const a = Math.atan2(dy, dx);
          for (const da of [-0.32, 0, 0.32]) disparar(j, e, 'carta', Math.cos(a + da), Math.sin(a + da), 1.9, d.dano);
          j.sfx('lanza');
          e.est = 'recupera'; e.t = 34;
        }
      }
      break;
    case 'carga':
      if (e.est === 'anda') {
        mirar(e, dx, dy);
        if (dist > 84) andar(j, e, ux, uy, d.vel);
        else andar(j, e, -uy * lado, ux * lado, d.vel * 0.6);
        if (--e.t <= 0 && dist < 110) { e.est = 'prepara'; e.t = 34; }
      } else if (e.est === 'prepara') {
        mirar(e, dx, dy);
        if (--e.t <= 0) { e.est = 'ataca'; e.ux = ux; e.uy = uy; e.rec = 0; e.ole = false; e.dado = false; j.sfx('carga'); }
      } else if (e.est === 'ataca') {
        const choque = j.mover(e, e.ux * 2.5, e.uy * 2.5, true);
        e.rec += 2.5; e.anda = (e.anda ?? 0) + 2.5;
        if (!e.dado && tocaJugador(j, e, 12)) {
          if (p.est === 'capote') { if (!e.ole) { e.ole = true; j.sfx('ole'); j.p.duende = Math.min(100, j.p.duende + 15); } }
          else if (j.danarJugador(d.dano, e.x, e.y, 4)) e.dado = true;
        }
        if (choque) { e.est = 'aturdido'; e.t = e.ole ? 150 : 95; j.sfx('golpazo'); j.temblor = 5; }
        else if (e.rec > 150) { e.est = 'recupera'; e.t = 30; }
      }
      break;
  }
}

export function actualizarProyectil(j: Juego, e: Ent): void {
  const p = j.jug;
  e.t++;
  if (e.clase === 'anillo') {
    if (e.espera > 0) { e.espera--; return; }
    e.r += 1.7;
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    if (Math.abs(d - e.r) < 5 && p.z - e.z < 7) j.danarJugador(e.dano, e.x, e.y, 3);
    if (e.r > e.max) e.vivo = false;
    return;
  }
  e.x += e.vx; e.y += e.vy;
  if (e.arco) {
    e.vz -= G; e.z += e.vz;
    if (e.z <= e.base) {
      e.vivo = false;
      j.sfx('rompe');
      j.fx('trozos', e.x, e.y, e.base + 4, 3, 4);
      if (Math.hypot(p.x - e.x, p.y - e.y) < 12 && Math.abs(p.z - e.base) < 12) j.danarJugador(e.dano, e.x, e.y);
    }
    return;
  }
  if (e.vuelve && e.t === e.vuelve) { e.vx = -e.vx; e.vy = -e.vy; }
  if (e.clase === 'gancho' && e.t > 30) {
    // vuelve a la mano
    const d = j.dist(e, e.dueno) || 1;
    e.vx = ((e.dueno.x - e.x) / d) * 3.4; e.vy = ((e.dueno.y - e.y) / d) * 3.4;
    if (d < 10) { e.vivo = false; return; }
  }
  if (--e.vida <= 0) { e.vivo = false; return; }
  const h = j.sala.suelo(Math.floor(e.x / T), Math.floor(e.y / T));
  if (h > e.z && e.clase !== 'gancho') { e.vivo = false; j.fx('chispa', e.x, e.y, e.z, 4, 3); return; }
  const dz = e.suelo ? p.z - e.base : Math.abs(p.z + 10 - e.z);
  if (Math.hypot(p.x - e.x, p.y - e.y) < 9 && (e.suelo ? dz < 8 : dz < 16)) {
    if (e.clase === 'gancho') {
      // el gancho te arrastra hacia el Percebe
      if (j.danarJugador(e.dano, p.x * 2 - e.dueno.x, p.y * 2 - e.dueno.y, 4.5)) { e.t = 31; j.sfx('clang'); }
    } else if (j.danarJugador(e.dano, e.x - e.vx * 4, e.y - e.vy * 4) && !e.atraviesa) e.vivo = false;
  }
}
