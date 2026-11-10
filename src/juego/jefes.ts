// Los cuatro jefes. Cada uno es una pequeña máquina de estados con ataques anunciados.
import { type Ent } from '../tipos';
import { G, type Juego } from './juego';
import { andar, disparar, mirar, tocaJugador } from './enemigos';
import { GUION } from '../datos/guion';

export interface DefJefe {
  nombre: string;
  titulo: string;
  vida: number;
  /** vida de la segunda fase, si la tiene */
  vida2?: number;
  pal: string;
  rx?: number;
  ry?: number;
  pesado: true;
  grande?: boolean;
  recibe?: (j: Juego, e: Ent, clase: string, ox: number, oy: number) => number;
}

export const JEFES: Record<string, DefJefe> = {
  percebe: { nombre: 'EL PERCEBE', titulo: 'Patrón de la Lonja', vida: 56, pal: 'percebe', pesado: true, rx: 7, ry: 5, recibe: (_j, e) => (e.est === 'cansado' ? 1.5 : 1) },
  faraona: { nombre: 'LA FARAONA', titulo: 'Reina de las Bodegas', vida: 52, pal: 'faraona', pesado: true, recibe: (_j, e) => (e.est === 'deslumbrada' ? 2 : 1) },
  miura: {
    nombre: 'EL MIURA', titulo: 'Seiscientos kilos de mala idea', vida: 60, pal: 'miura', pesado: true, grande: true, rx: 9, ry: 7,
    recibe: (_j, e, clase) => (e.est === 'aturdido' ? (e.ole ? 2 : 1.25) : clase === 'remate' || clase === 'explosion' ? 1 : 0.3),
  },
  notario: {
    nombre: 'DON FERMÍN', titulo: '«El Notario»', vida: 40, vida2: 64, pal: 'notario', pesado: true,
    recibe: (_j, e, clase, ox, oy) => {
      if (e.fase === 1) return 1;
      if (e.est !== 'acecha' && e.est !== 'tajo') return 1;
      if (clase === 'giro' || clase === 'remate' || clase === 'explosion') return 1;
      const d = Math.hypot(ox - e.x, oy - e.y) || 1;
      const dx = [0, 1, 0, -1][e.dir], dy = [1, 0, -1, 0][e.dir];
      return (dx * (ox - e.x) + dy * (oy - e.y)) / d > 0.2 ? 0 : 1;
    },
  },
};

function anillo(j: Juego, e: Ent, max: number, dano: number, espera = 0): void {
  j.crear('proy', e.x, e.y, { z: e.z, clase: 'anillo', r: 6, max, dano, espera, vx: 0, vy: 0 });
}

export function actualizarJefe(j: Juego, e: Ent): void {
  const d = JEFES[e.nom];
  const p = j.jug;
  if (e.flash > 0) e.flash--;
  const dx = p.x - e.x, dy = p.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist, uy = dy / dist;

  if (e.est === 'espera') {
    mirar(e, dx, dy);
    if (dist < 96) {
      e.est = 'anda'; e.t = 0;
      j.tarjeta = { titulo: d.nombre, sub: d.titulo, t: 150 };
      j.sfx('jefe');
      const antes = GUION.jefes[e.nom]?.antes(j);
      if (antes?.length) j.decir(antes);
    }
    return;
  }
  if (e.est === 'vencido') {
    e.t++;
    if (e.t % 9 === 0 && e.t < 90) {
      j.fx('humo', e.x + (j.azar() - 0.5) * 22, e.y + (j.azar() - 0.5) * 12, e.z + j.azar() * 22, 6, 3);
      j.sfx('golpe');
    }
    if (e.t === 100) {
      e.vivo = false;
      j.jefe = null;
      j.pon('jefe:' + e.nom);
      j.musica = j.def.musica ?? j.tema.musica;
      j.sfx('fanfarria');
      j.decir(GUION.jefes[e.nom]?.despues(j) ?? []);
    }
    return;
  }
  if (e.est === 'cambio') {
    e.t++;
    if (e.t === 2) j.decir(GUION.jefes[e.nom]?.fase2?.(j) ?? []);
    if (e.t === 50) { e.pal = d.pal + '2'; j.sfx('listo'); j.destello = 6; }
    if (e.t > 80) { e.est = 'acecha'; e.t = 0; e.n = 0; }
    return;
  }
  if (Math.abs(e.kx) + Math.abs(e.ky) > 0.05) { j.mover(e, e.kx, e.ky, true); e.kx *= 0.8; e.ky *= 0.8; }
  if (e.est !== 'aire') j.fisica(e);
  if (p.est === 'muerto') return;
  const f2 = d.vida2 ? e.fase === 2 : e.vida <= e.vidaMax / 2;

  switch (e.nom) {
    // ───────── El Percebe: barrido, gancho y salto con onda (hay que saltarla) ─────────
    case 'percebe':
      switch (e.est) {
        case 'anda':
          mirar(e, dx, dy);
          andar(j, e, ux, uy, f2 ? 0.62 : 0.46);
          e.t++;
          if (dist < 27) { e.est = 'barrido'; e.t = 28; }
          else if (e.t > (f2 ? 55 : 75)) { e.est = e.n % 3 === 2 ? 'salta' : 'gancho'; e.t = e.est === 'salta' ? 22 : 30; }
          break;
        case 'barrido':
          e.t--;
          if (e.t === 8) { j.sfx('zas'); if (dist < 36 && Math.abs(p.z - e.z) < 16) j.danarJugador(2, e.x, e.y, 3.5); }
          if (e.t <= 0) { e.est = 'recupera'; e.t = 44; e.n++; }
          break;
        case 'gancho':
          mirar(e, dx, dy);
          if (--e.t <= 0) { e.garfio = disparar(j, e, 'gancho', ux, uy, 3.2, 2, { vida: 120 }); j.sfx('lanza'); e.est = 'tira'; }
          break;
        case 'tira':
          if (!e.garfio?.vivo) { e.est = 'recupera'; e.t = 30; e.n++; }
          break;
        case 'salta':
          if (--e.t <= 0) { e.est = 'aire'; e.vz = 4.1; e.vx = dx / 41; e.vy = dy / 41; j.sfx('salto'); }
          break;
        case 'aire':
          j.mover(e, e.vx, e.vy, true);
          e.vz -= G; e.z += e.vz;
          if (e.z <= 0 && e.vz < 0) {
            e.z = 0; e.vz = 0;
            j.temblor = 16; j.sfx('golpazo');
            anillo(j, e, 84, 2);
            if (f2) anillo(j, e, 84, 2, 22);
            e.est = 'cansado'; e.t = f2 ? 75 : 95; e.n++;
          }
          break;
        default:
          if (--e.t <= 0) { e.est = 'anda'; e.t = 0; }
      }
      break;

    // ───────── La Faraona: abanicos que vuelven y embestidas a oscuras ─────────
    case 'faraona': {
      const velas = j.ents.filter((o) => o.tipo === 'vela' && !o.fija);
      switch (e.est) {
        case 'anda': {
          mirar(e, dx, dy);
          e.ang = (e.ang ?? 0) + 0.035;
          const tx = p.x + Math.cos(e.ang) * 62, ty = p.y + Math.sin(e.ang) * 50;
          const l = Math.hypot(tx - e.x, ty - e.y) || 1;
          andar(j, e, (tx - e.x) / l, (ty - e.y) / l, f2 ? 1.15 : 0.95);
          if (++e.t > 75) { e.est = 'abanico'; e.t = 22; }
          break;
        }
        case 'abanico':
          mirar(e, dx, dy);
          if (--e.t <= 0) {
            const a = Math.atan2(dy, dx);
            const n = f2 ? 5 : 3;
            for (let i = 0; i < n; i++) {
              const da = (i - (n - 1) / 2) * 0.34;
              disparar(j, e, 'abanico', Math.cos(a + da), Math.sin(a + da), 2.1, 2, { vuelve: 40, vida: 84, atraviesa: true });
            }
            j.sfx('lanza');
            e.n++;
            e.est = e.n % 2 === 0 ? 'apagon' : 'recupera';
            e.t = e.est === 'apagon' ? 44 : 50;
          }
          break;
        case 'apagon':
          if (--e.t <= 0) {
            for (const v of velas) v.encendida = false;
            j.sfx('apagon'); j.destello = 3;
            e.oculta = true; e.cuenta = 0;
            e.est = 'acecha'; e.t = 46;
          }
          break;
        case 'acecha': {
          if (velas.filter((v) => v.encendida).length >= Math.min(3, velas.length)) {
            e.oculta = false; e.est = 'deslumbrada'; e.t = 170; j.sfx('listo'); j.destello = 4;
            break;
          }
          const a = (e.cuenta * 2.4 + e.id) % (Math.PI * 2);
          const tx = p.x + Math.cos(a) * 66, ty = p.y + Math.sin(a) * 52;
          const l = Math.hypot(tx - e.x, ty - e.y) || 1;
          andar(j, e, (tx - e.x) / l, (ty - e.y) / l, 1.3);
          if (--e.t <= 0) { e.est = 'ojos'; e.t = 32; j.sfx('aviso'); }
          break;
        }
        case 'ojos':
          mirar(e, dx, dy);
          if (--e.t <= 0) { e.est = 'embiste'; e.t = 22; e.ux = ux; e.uy = uy; e.dado = false; j.sfx('zas'); }
          break;
        case 'embiste':
          j.mover(e, e.ux * 3.1, e.uy * 3.1, true);
          if (!e.dado && tocaJugador(j, e, 12) && j.danarJugador(2, e.x, e.y, 3.5)) e.dado = true;
          if (--e.t <= 0) {
            e.cuenta++;
            if (e.cuenta >= 4) { for (const v of velas) v.encendida = true; e.oculta = false; e.est = 'recupera'; e.t = 60; j.sfx('fuego'); }
            else { e.est = 'acecha'; e.t = 40; }
          }
          break;
        default:
          if (--e.t <= 0) { e.est = 'anda'; e.t = 0; }
      }
      break;
    }

    // ───────── El Miura: embiste hasta estrellarse; el capote lo deja vendido ─────────
    case 'miura':
      switch (e.est) {
        case 'anda':
          mirar(e, dx, dy);
          andar(j, e, ux, uy, 0.4);
          if (++e.t > 50) { e.est = 'escarba'; e.t = f2 ? 32 : 46; j.sfx('carga'); }
          break;
        case 'escarba':
          mirar(e, dx, dy);
          if (--e.t <= 0) { e.est = 'carga'; e.ux = ux; e.uy = uy; e.ole = false; e.dado = false; }
          break;
        case 'carga': {
          const choque = j.mover(e, e.ux * 3.1, e.uy * 3.1, true);
          e.anda = (e.anda ?? 0) + 3;
          if (tocaJugador(j, e, 17)) {
            if (p.est === 'capote') { if (!e.ole) { e.ole = true; j.sfx('ole'); j.p.duende = Math.min(100, j.p.duende + 25); } }
            else if (!e.dado && j.danarJugador(3, e.x, e.y, 4.5)) e.dado = true;
          }
          if (choque) {
            e.est = 'aturdido'; e.t = e.ole ? 200 : 105; e.n++;
            j.temblor = 16; j.sfx('golpazo');
            j.fx('humo', e.x + e.ux * 10, e.y + e.uy * 8, 8, 6, 3);
          }
          break;
        }
        case 'aturdido':
          if (--e.t <= 0) { e.ole = false; if (f2 && e.n % 2 === 0) { e.est = 'pisoton'; e.t = 26; e.k = 2; } else { e.est = 'anda'; e.t = 0; } }
          break;
        case 'pisoton':
          if (--e.t <= 0) { e.est = 'aire'; e.vz = 3.4; e.vx = 0; e.vy = 0; j.sfx('salto'); }
          break;
        case 'aire':
          e.vz -= G; e.z += e.vz;
          if (e.z <= 0 && e.vz < 0) {
            e.z = 0; e.vz = 0; j.temblor = 14; j.sfx('golpazo'); anillo(j, e, 96, 2);
            if (--e.k > 0) { e.est = 'pisoton'; e.t = 20; } else { e.est = 'recupera'; e.t = 40; }
          }
          break;
        default:
          if (--e.t <= 0) { e.est = 'anda'; e.t = 0; }
      }
      break;

    // ───────── Don Fermín: primero pistola y escoltas; luego, la katana ─────────
    case 'notario':
      if (e.fase === 1) {
        switch (e.est) {
          case 'anda': {
            mirar(e, dx, dy);
            const lado = Math.floor(e.t / 50) % 2 ? 1 : -1;
            if (dist < 62) andar(j, e, -ux, -uy, 0.8);
            else if (dist > 104) andar(j, e, ux, uy, 0.7);
            else andar(j, e, -uy * lado, ux * lado, 0.7);
            if (++e.t > 62) { e.est = 'apunta'; e.t = 36; j.sfx('aviso'); }
            break;
          }
          case 'apunta':
            mirar(e, dx, dy);
            if (--e.t <= 0) { e.est = 'dispara'; e.t = 0; e.k = 3; }
            break;
          case 'dispara':
            mirar(e, dx, dy);
            if (e.t++ % 8 === 0) {
              disparar(j, e, 'bala', ux, uy, 3, 2, { vida: 80 });
              j.sfx('tiro');
              if (--e.k <= 0) {
                e.n++;
                e.est = 'recupera'; e.t = 64;
                const escoltas = j.ents.filter((o) => o.tipo === 'enemigo' && o.vivo).length;
                if (e.n % 3 === 0 && escoltas === 0) {
                  for (const s of [-1, 1]) {
                    const x = e.x + s * 28, y = e.y + 10;
                    if (!j.probar(x, y, 5, 4, e.z).blq) {
                      j.crear('enemigo', x, y, { z: e.z, cls: 'guardaespaldas', vida: 8, pal: 'guardaespaldas', est: 'anda', kx: 0, ky: 0, flash: 0, alerta: true, t: 40, x0: x, y0: y });
                      j.fx('humo', x, y, e.z + 8, 6, 3);
                    }
                  }
                  j.sfx('aviso');
                }
              }
            }
            break;
          default:
            if (--e.t <= 0) { e.est = 'anda'; e.t = 0; }
        }
      } else {
        switch (e.est) {
          case 'acecha': {
            mirar(e, dx, dy);
            e.ang = (e.ang ?? 0) + 0.04;
            const tx = p.x + Math.cos(e.ang) * 52, ty = p.y + Math.sin(e.ang) * 44;
            const l = Math.hypot(tx - e.x, ty - e.y) || 1;
            andar(j, e, (tx - e.x) / l, (ty - e.y) / l, 1.15);
            if (++e.t > 52) {
              if (e.n % 3 === 2) { e.est = 'onda'; e.t = 28; } else { e.est = 'tajo'; e.t = 18; e.k = e.vida < e.vidaMax / 2 ? 3 : 2; }
              j.sfx('aviso');
            }
            break;
          }
          case 'tajo':
            mirar(e, dx, dy);
            if (--e.t <= 0) { e.est = 'dash'; e.t = 12; e.ux = ux; e.uy = uy; e.dado = false; j.sfx('zas'); }
            break;
          case 'dash':
            j.mover(e, e.ux * 3.6, e.uy * 3.6, true);
            if (!e.dado && tocaJugador(j, e, 14) && j.danarJugador(3, e.x, e.y, 3.5)) e.dado = true;
            if (--e.t <= 0) {
              if (--e.k > 0) { e.est = 'tajo'; e.t = 13; } else { e.est = 'recupera'; e.t = 58; e.n++; }
            }
            break;
          case 'onda':
            mirar(e, dx, dy);
            if (--e.t <= 0) {
              const a = Math.atan2(dy, dx);
              for (const da of [-0.4, 0, 0.4]) disparar(j, e, 'onda', Math.cos(a + da), Math.sin(a + da), 2.4, 2, { suelo: true, z: e.z, vida: 110, atraviesa: true });
              j.sfx('giro');
              e.est = 'recupera'; e.t = 48; e.n++;
            }
            break;
          default:
            if (--e.t <= 0) { e.est = 'acecha'; e.t = 0; }
        }
      }
      break;
  }
}
