// Pintado del juego a 256×224. Lee el estado de `Juego` y no lo modifica.
import { ALTO, ANCHO, DX, DY, T, TERR, type Ent } from '../tipos';
import { OBJETOS, type Juego } from '../juego/juego';
import { JEFES } from '../juego/jefes';
import { DECO } from '../datos/deco';
import { GUION } from '../datos/guion';
import { partir } from '../juego/texto';
import { lienzo } from './arte';
import type { Graficos } from './graficos';

type Ctx = CanvasRenderingContext2D;
const NEGRO = '#080510';
const ICONO: Record<string, string> = { tracas: 'i_tracas', mechero: 'i_mechero', capote: 'i_capote' };
const RODILLO = ['i_bocata', 'i_llave', 'i_clavel', 'i_sello', 'i_siete'];

export class Vista {
  private luz: HTMLCanvasElement;
  private lctx: Ctx;
  private focos: [number, number, number, string][] = [];
  /** se juega con controles táctiles (cambia los textos de ayuda) */
  tactil = false;

  constructor(private g: Graficos, private ctx: Ctx) {
    [this.luz, this.lctx] = lienzo(ANCHO, ALTO);
  }

  pintar(j: Juego): void {
    const ctx = this.ctx;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = NEGRO;
    ctx.fillRect(0, 0, ANCHO, ALTO);
    if (j.modo === 'titulo') { this.titulo(j); return; }
    if (j.modo === 'creditos') { this.creditos(j); return; }
    if (j.modo === 'escena') { this.escena(j); return; }
    if (!j.sala) return;
    this.mundo(j);
    this.hud(j);
    if (j.tarjeta) this.tarjeta(j);
    if (j.dlg) this.dialogo(j);
    if (j.modo === 'pausa') this.pausa(j);
    if (j.modo === 'muerte') this.muerte(j);
    if (j.modo === 'tragaperras') this.tragaperras(j);
    if (j.trans) {
      const a = j.trans.t < 12 ? j.trans.t / 12 : (24 - j.trans.t) / 12;
      ctx.globalAlpha = Math.round(a * 4) / 4;
      ctx.fillStyle = NEGRO; ctx.fillRect(0, 0, ANCHO, ALTO);
      ctx.globalAlpha = 1;
    }
    if (j.destello > 0) { ctx.globalAlpha = Math.min(0.7, j.destello / 8); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, ANCHO, ALTO); ctx.globalAlpha = 1; }
  }

  // ───────────────────────── mundo ─────────────────────────

  private mundo(j: Juego): void {
    const { ctx, g } = this;
    const s = j.sala, tema = j.tema;
    const tx = j.temblor > 0 ? Math.round(Math.sin(j.tic * 2.1) * Math.min(3, j.temblor / 3)) : 0;
    const ty = j.temblor > 0 ? Math.round(Math.cos(j.tic * 2.7) * Math.min(3, j.temblor / 3)) : 0;
    const cx = Math.round(j.cam.x) + tx, cy = Math.round(j.cam.y) + ty;
    this.focos = [];
    if (tema.fondo) ctx.drawImage(g.cielo, -Math.round(cx * 0.25) - 40, -Math.round(cy * 0.1));
    ctx.save();
    ctx.translate(-cx, -cy);

    // Cosas que se ordenan por profundidad.
    const cosas: { y: number; f: () => void }[] = [];
    const planos: { y: number; f: () => void }[] = [];
    for (const [nombre, col, fila] of j.def.deco ?? []) {
      const d = DECO[nombre];
      const spr = d.anim ? d.spr + (Math.floor(j.tic / 10) % d.anim) : d.spr;
      const [, h] = g.tam(spr);
      const zb = s.nivel(col, fila) * T;
      const x = col * T + (d.dx ?? 0), y = (fila + 1) * T - h + (d.dy ?? 0) - zb;
      (d.plano ? planos : cosas).push({ y: (fila + 1) * T - 1, f: () => g.d(ctx, spr, x, y) });
      if (d.luz) this.focos.push([col * T + d.luz[0] - cx, (fila + 1) * T + d.luz[1] - zb - cy, d.luz[2], d.luz[3]]);
    }
    for (const e of j.ents) {
      if (!e.vivo) continue;
      if (e.tipo === 'placa') { planos.push({ y: e.y, f: () => this.ent(j, e, cx, cy) }); continue; }
      cosas.push({ y: e.tipo === 'proy' && e.clase === 'anillo' ? e.y - 400 : e.y + (e.tipo === 'fx' ? 6 : 0), f: () => this.ent(j, e, cx, cy) });
    }
    cosas.sort((a, b) => a.y - b.y);

    const c0 = Math.max(0, Math.floor(cx / T)), c1 = Math.min(s.an - 1, Math.floor((cx + ANCHO) / T));
    const f0 = Math.max(0, Math.floor(cy / T)), f1 = Math.min(s.al - 1, Math.floor((cy + ALTO) / T) + 4);
    // Primero todo lo que está a ras de suelo y lo que va pegado a él; después, por filas,
    // los suelos elevados (que tapan lo que tienen detrás) y los personajes.
    for (let f = f0; f <= f1; f++) for (let c = c0; c <= c1; c++) if (s.nivel(c, f) === 0 || s.tipo(c, f) === TERR.MURO) this.celda(j, c, f);
    for (const p of planos) p.f();
    let k = 0;
    for (let f = f0; f <= f1; f++) {
      for (let c = c0; c <= c1; c++) if (s.nivel(c, f) > 0 && s.tipo(c, f) !== TERR.MURO) this.celda(j, c, f);
      while (k < cosas.length && cosas[k].y < (f + 1) * T) cosas[k++].f();
    }
    while (k < cosas.length) cosas[k++].f();
    if (j.sellada()) for (const i of j.puertaCelda.keys()) g.d(ctx, 'reja', (i % s.an) * T, Math.floor(i / s.an) * T - 8);
    ctx.restore();

    // Luz: la escena se multiplica por un mapa de luz ambiente al que se suman los focos.
    for (const [x, col, fila, r, color] of (j.def.luces ?? []).map((l) => [0, ...l] as [number, number, number, number, string])) { void x; this.focos.push([col * T + 8 - cx, fila * T + 8 - cy, r, color]); }
    for (const [texto, col, fila, color] of j.def.neones ?? []) {
      const w = g.ancho(texto) + 6;
      this.focos.push([col * T + w / 2 - cx, fila * T + 16 - cy, Math.max(30, w * 0.75), color]);
    }
    const l = this.lctx;
    l.globalCompositeOperation = 'source-over';
    l.fillStyle = j.def.oscura ? '#161222' : tema.ambiente;
    l.fillRect(0, 0, ANCHO, ALTO);
    l.globalCompositeOperation = 'lighter';
    for (const [x, y, r, color] of this.focos) {
      if (x < -r || y < -r || x > ANCHO + r || y > ALTO + r) continue;
      l.drawImage(g.disco(r, color), Math.round(x - r), Math.round(y - r));
    }
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.luz, 0, 0);
    ctx.globalCompositeOperation = 'source-over';

    // Neones: se pintan después de la luz, a pleno brillo, con su halo sumado.
    for (const [texto, col, fila, color] of j.def.neones ?? []) {
      const x = Math.round(col * T - cx), y = Math.round(fila * T - cy);
      const w = g.ancho(texto) + 6;
      const parpadea = (j.tic + col * 37) % 140 < 4;
      ctx.fillStyle = '#120a1c'; ctx.fillRect(x, y, w, 12);
      ctx.globalAlpha = parpadea ? 0.3 : 0.75;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + 11, w, 1); ctx.fillRect(x, y, 1, 12); ctx.fillRect(x + w - 1, y, 1, 12);
      ctx.globalAlpha = parpadea ? 0.4 : 1;
      g.t(ctx, texto, x + 3, y + 1, color, 0, null);
      ctx.globalAlpha = parpadea ? 0.1 : 0.45;
      g.t(ctx, texto, x + 3, y + 1, '#ffffff', 0, null);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = color;
      ctx.globalAlpha = parpadea ? 0.05 : 0.22; ctx.fillRect(x - 2, y - 2, w + 4, 16);
      ctx.globalAlpha = parpadea ? 0.03 : 0.1; ctx.fillRect(x - 5, y - 5, w + 10, 22);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
  }

  private var(lista: string[], c: number, f: number): string {
    return lista[(c * 7 + f * 13 + ((c * f) >> 1)) % lista.length];
  }

  private celda(j: Juego, c: number, f: number): void {
    const { ctx, g } = this;
    const s = j.sala, tm = j.tema;
    const t = s.tipo(c, f);
    const x = c * T, y = f * T;
    const esSuelo = (k: number) => k !== TERR.MURO && k !== TERR.VACIO && k !== TERR.AGUA && k !== TERR.FOSO;
    switch (t) {
      case TERR.VACIO:
        if (!tm.fondo) { ctx.fillStyle = NEGRO; ctx.fillRect(x, y, T, T); }
        return;
      case TERR.MURO: {
        const cara = s.cara[f * s.an + c];
        if (cara === 0) g.d(ctx, tm.muroTop, x, y);
        else if (cara === 1) g.d(ctx, tm.muroBase, x, y);
        else g.d(ctx, tm.muroCara[0], x, y);
        if (cara === 1) { ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(x, y + 14, T, 2); }
        if (cara === 0 && s.cara[(f + 1) * s.an + c] > 0) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x, y + 13, T, 3); }
        return;
      }
      case TERR.AGUA: {
        ctx.fillStyle = tm.colorAgua; ctx.fillRect(x, y, T, T);
        if ((c * 5 + f * 3) % 4 === 0) g.d(ctx, tm.olas + ((Math.floor(j.tic / 14) + c + f) % 4), x, y);
        if (s.tipo(c, f - 1) !== TERR.AGUA) { ctx.fillStyle = 'rgba(0,0,20,0.4)'; ctx.fillRect(x, y, T, 5); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(x, y + 5, T, 1); }
        return;
      }
      case TERR.FOSO: {
        const norte = s.tipo(c, f - 1);
        if (!tm.fondo) { ctx.fillStyle = tm.colorFoso; ctx.fillRect(x, y, T, T); }
        if (esSuelo(norte)) {
          g.d(ctx, tm.caraBase, x, y);
          ctx.fillStyle = 'rgba(8,4,16,0.55)'; ctx.fillRect(x, y, T, T);
          ctx.fillStyle = 'rgba(8,4,16,0.5)'; ctx.fillRect(x, y + 8, T, 8);
        }
        return;
      }
    }
    // Suelos: se pintan desplazados hacia arriba según su altura, con la cara del escalón debajo.
    const h = s.nivel(c, f);
    const sy = y - h * T;
    let spr: string;
    if (t === TERR.ALT) spr = this.var(tm.alt, c, f);
    else if (t === TERR.TER) spr = this.var(tm.ter, c, f);
    else if (h > 0) spr = this.var(tm.alto, c, f);
    else spr = this.var(tm.suelo, c, f);
    g.d(ctx, spr, x, sy);
    if (t >= TERR.CINTA_S && t <= TERR.CINTA_O) {
      const d = t - TERR.CINTA_S;
      ctx.save();
      ctx.translate(x + 8, sy + 8);
      ctx.rotate([0, -Math.PI / 2, Math.PI, Math.PI / 2][d]);
      g.d(ctx, 'cinta' + (Math.floor(j.tic / 5) % 4), -8, -8);
      ctx.restore();
    } else if (t === TERR.RELLENO) {
      ctx.fillStyle = tm.colorFoso; ctx.fillRect(x, sy, T, T);
      g.dTrozo(ctx, 'caja', x, sy + 2, 12);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x, sy, T, 2); ctx.fillRect(x, sy + 14, T, 2);
    } else if (t === TERR.PUENTE) {
      g.d(ctx, 'tabla1', x, sy);
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x, sy, 1, T); ctx.fillRect(x + 15, sy, 1, T);
    }
    const nivelDe = (cc: number, ff: number) => (esSuelo(s.tipo(cc, ff)) ? s.nivel(cc, ff) : s.tipo(cc, ff) === TERR.MURO ? 9 : -1);
    const hs = Math.max(0, Math.min(h, nivelDe(c, f + 1) < 0 ? 0 : nivelDe(c, f + 1) === 9 ? 0 : nivelDe(c, f + 1)));
    for (let k = 1; k <= h - hs; k++) {
      const fy = sy + k * T;
      g.d(ctx, k === h - hs ? tm.caraBase : tm.cara[(k - 1) % tm.cara.length], x, fy);
    }
    // Realce de bordes y sombras de los escalones vecinos.
    const hn = nivelDe(c, f - 1), ho = nivelDe(c - 1, f), he = nivelDe(c + 1, f), hsur = nivelDe(c, f + 1);
    if (h > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      if (hsur < h) ctx.fillRect(x, sy + 15, T, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      if (ho < h && ho >= -1) ctx.fillRect(x, sy, 1, T + (h - hs) * T);
      if (he < h && he >= -1) ctx.fillRect(x + 15, sy, 1, T + (h - hs) * T);
      if (hn < h && hn >= 0) ctx.fillRect(x, sy, T, 1);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    if (hn === 9) ctx.fillRect(x, sy, T, 3);
    if (ho !== 9 && ho > h) ctx.fillRect(x, sy, 3, T);
    if (he !== 9 && he > h) ctx.fillRect(x + 13, sy, 3, T);
  }

  // ───────────────────────── entidades ─────────────────────────

  private sombra(j: Juego, e: Ent, ancho = 10): void {
    const ctx = this.ctx;
    const base = e.suelo === false || e.tipo === 'proy' || e.tipo === 'recoge' ? Math.max(j.probar(e.x, e.y, e.rx, e.ry, e.z, e).sup, e.tipo === 'proy' ? e.base ?? 0 : -99) : e.z;
    if (base < -20) return;
    const x = Math.round(e.x), y = Math.round(e.y - base);
    const m = ancho / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.33)';
    ctx.fillRect(x - m + 1, y, ancho - 2, 1); ctx.fillRect(x - m, y + 1, ancho, 2); ctx.fillRect(x - m + 1, y + 3, ancho - 2, 1);
  }

  /** Pinta un personaje de la hoja base. atq: fotograma de ataque (0–3) o -1. */
  private persona(e: Ent, pal: string, fr: number, atq: number, salto: boolean, doble = false): void {
    const { ctx, g } = this;
    const blanco = e.flash > 0 && e.flash % 4 < 2;
    const hoja = doble ? g.pjDoble(blanco ? 'blanco' : pal) : g.pj(blanco ? 'blanco' : pal);
    const k = doble ? 2 : 1;
    const x = Math.round(e.x), y = Math.round(e.y - e.z);
    if (atq >= 0) {
      const fila = [128, 192, 160, 224][e.dir];
      ctx.drawImage(hoja, atq * 32 * k, fila * k, 32 * k, 32 * k, x - 16 * k, y + 3 - 27 * k, 32 * k, 32 * k);
    } else {
      ctx.drawImage(hoja, ((salto ? 144 : 0) + fr * 16) * k, e.dir * 32 * k, 16 * k, 32 * k, x - 8 * k, y + 3 - 27 * k, 16 * k, 32 * k);
    }
  }

  private ent(j: Juego, e: Ent, cx: number, cy: number): void {
    const { ctx, g } = this;
    const x = Math.round(e.x), y = Math.round(e.y - e.z);
    const foco = (r: number, color: string, dy = -10) => this.focos.push([x - cx, y + dy - cy, r, color]);
    switch (e.tipo) {
      case 'jugador': {
        const p = j.p;
        if (j.def.oscura) foco(p.mechero ? 64 : 42, '#b8b8d0'); else foco(30, '#303048');
        if (e.est === 'cae') {
          if (e.agua && e.t < 22) return;
          const k = Math.max(0.15, e.t / 34);
          const hoja = g.pj('rai');
          ctx.drawImage(hoja, 0, e.dir * 32, 16, 32, x - 8 * k, Math.round(e.y) + 10 - 24 * k - (34 - e.t) * 0.2, 16 * k, 32 * k);
          return;
        }
        const pal = p.katana ? 'rai_katana' : p.bate ? 'rai_bate' : 'rai';
        if (e.est === 'muerto') {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate((-Math.PI / 2) * Math.min(1, (90 - e.t) / 16));
          ctx.drawImage(g.pj(pal), 0, 0, 16, 32, -8, -24, 16, 32);
          ctx.restore();
          return;
        }
        this.sombra(j, e);
        if (e.inv > 0 && e.est !== 'herido' && j.tic % 4 < 2) return;
        const cargado = e.est === 'carga' && e.carga >= 36;
        const flash = e.flash;
        if (cargado && j.tic % 6 < 3) e.flash = 2; else if (e.est === 'herido') e.flash = e.t % 4 < 2 ? 2 : 0;
        if (e.est === 'ataque') this.persona(e, pal, 0, Math.min(3, Math.floor(e.t / 4.5)), false);
        else if (e.est === 'giro') {
          this.persona(e, pal, 0, 1 + (Math.floor(e.t / 2) % 2), false);
          const r = e.remate ? 44 : 26;
          const a0 = e.t * 0.9;
          ctx.fillStyle = e.remate ? '#ffd040' : '#ffffff';
          for (let i = 0; i < 7; i++) {
            const a = a0 - i * 0.22;
            ctx.globalAlpha = 1 - i / 7;
            ctx.fillRect(Math.round(x + Math.cos(a) * r) - 1, Math.round(y - 8 + Math.sin(a) * r * 0.7) - 1, 3, 3);
            if (e.remate) ctx.fillRect(Math.round(x + Math.cos(a + Math.PI) * r) - 1, Math.round(y - 8 + Math.sin(a + Math.PI) * r * 0.7) - 1, 3, 3);
          }
          ctx.globalAlpha = 1;
        } else {
          const fr = e.anda > 0 ? Math.floor(e.anda / 7) % 4 : 0;
          this.persona(e, pal, fr, -1, !e.suelo && e.est !== 'capote');
        }
        e.flash = flash;
        if (e.est === 'capote') g.d(ctx, 'i_capote', x - 6 - DX[e.dir] * 9, y - 18 - DY[e.dir] * 6);
        return;
      }
      case 'pnj': this.sombra(j, e); this.persona(e, e.pal, 0, -1, false); return;
      case 'enemigo': {
        this.sombra(j, e);
        if (e.cls === 'perro') {
          const lado = e.dir === 3 || (e.dir !== 1 && j.jug.x < e.x) ? 'i' : 'd';
          const spr = `perro_${lado}${Math.floor((e.anda ?? 0) / 5) % 2}`;
          if (e.flash > 0 && e.flash % 4 < 2) { ctx.globalCompositeOperation = 'lighter'; g.d(ctx, spr, x - 8, y - 9); ctx.globalCompositeOperation = 'source-over'; }
          g.d(ctx, spr, x - 8, y - 9);
          return;
        }
        const prep = e.est === 'prepara';
        const guarda = e.flash;
        if (prep && j.tic % 8 < 3) e.flash = 2;
        const conArma = e.cls === 'maton' || e.cls === 'navajero' || e.cls === 'estibador' || e.cls === 'guardaespaldas';
        const atq = e.est === 'ataca' && conArma ? Math.min(3, Math.floor((e.cls === 'navajero' ? 15 - e.t : 10 - e.t) / 3)) : prep && conArma ? 0 : -1;
        this.persona(e, e.pal, Math.floor((e.anda ?? 0) / 7) % 4, atq, false);
        e.flash = guarda;
        if (prep) g.d(ctx, 'aviso', x - 8, y - 42);
        if (e.est === 'aturdido') this.estrellas(j, x, y - 28);
        return;
      }
      case 'jefe': {
        const d = JEFES[e.nom];
        const k = d.grande ? 2 : 1;
        if (e.oculta) {
          if (e.est === 'ojos') { ctx.fillStyle = '#ff3040'; ctx.fillRect(x - 3, y - 17, 2, 2); ctx.fillRect(x + 2, y - 17, 2, 2); }
          ctx.globalAlpha = j.dist(e, j.jug) < 34 ? 0.5 : 0.07;
        }
        this.sombra(j, e, d.grande ? 20 : 12);
        const guarda = e.flash;
        const avisa = ['barrido', 'gancho', 'salta', 'abanico', 'apagon', 'escarba', 'apunta', 'tajo', 'onda', 'pisoton'].includes(e.est);
        if (avisa && j.tic % 8 < 3) e.flash = 2;
        let atq = -1;
        if (e.est === 'barrido') atq = e.t > 8 ? 0 : Math.min(3, Math.floor((8 - e.t) / 2) + 1);
        else if (e.est === 'dash' || e.est === 'embiste') atq = 2;
        else if (e.est === 'tajo' || e.est === 'abanico') atq = 0;
        if (e.nom === 'miura' || (e.nom === 'notario' && e.fase === 1) || e.nom === 'percebe' && atq < 0) atq = e.nom === 'percebe' ? atq : -1;
        const cansado = e.est === 'cansado' || e.est === 'aturdido' || e.est === 'deslumbrada' || e.est === 'vencido';
        this.persona(e, e.pal, cansado ? 0 : Math.floor((e.anda ?? 0) / 7) % 4, atq, e.est === 'aire', d.grande);
        e.flash = guarda;
        ctx.globalAlpha = 1;
        if (avisa) g.d(ctx, 'aviso', x - 8, y - 18 - 24 * k);
        if (e.est === 'aturdido' || e.est === 'deslumbrada' || e.est === 'cansado') this.estrellas(j, x, y - 4 - 24 * k);
        if (e.est === 'apunta') {
          ctx.fillStyle = 'rgba(255,48,64,0.7)';
          const dx = j.jug.x - e.x, dy = j.jug.y - j.jug.z - (e.y - e.z), n = Math.hypot(dx, dy) || 1;
          for (let i = 12; i < n; i += 4) ctx.fillRect(Math.round(x + (dx / n) * i), Math.round(y - 12 + (dy / n) * i), 1, 1);
        }
        return;
      }
      case 'caja': g.d(ctx, 'caja', x - 8, y + 8 - 28); return;
      case 'barril': this.sombra(j, e, 14); g.d(ctx, 'olla', x - 8, y - 11); return;
      case 'cofre': g.d(ctx, e.abierto ? 'cofre_ab' : 'cofre', x - 8, y - 10); return;
      case 'cartel': g.d(ctx, 'cartel', x - 8, y - 10); return;
      case 'cabina': g.d(ctx, 'cabina', x - 8, y - 24); foco(26, '#6090d0'); return;
      case 'placa': g.d(ctx, e.pisada ? 'placa1' : 'placa0', x - 8, y - 8); return;
      case 'palanca': g.d(ctx, e.activo ? 'palanca1' : 'palanca0', x - 6, y - 8); return;
      case 'reja': g.dTrozo(ctx, 'reja', x - 8, y + 8 - 24 + e.abre * 1.5, 24 - e.abre * 1.5); return;
      case 'cerrojo': {
        g.d(ctx, j.tema.muroBase, x - 8, y - 8);
        g.d(ctx, 'puerta_madera', x - 8, y + 8 - 21);
        g.d(ctx, 'i_llave', x - 6, y - 14);
        return;
      }
      case 'grieta': g.d(ctx, j.tema.muroCara[0], x - 8, y - 24); g.d(ctx, j.tema.muroBase, x - 8, y - 8); g.d(ctx, 'grieta', x - 8, y - 22); g.d(ctx, 'grieta', x - 8, y - 9); return;
      case 'barricada':
        g.d(ctx, 'barricada', x - 8, y + 8 - 26);
        if (e.arde) { g.d(ctx, 'fuego' + (Math.floor(j.tic / 4) % 7), x - 8, y - 20); g.d(ctx, 'fuego' + (Math.floor(j.tic / 4 + 3) % 7), x - 4, y - 10); foco(40, '#ff9040'); }
        return;
      case 'vela':
        g.d(ctx, 'brasero', x - 5, y - 8);
        if (e.encendida) { g.d(ctx, 'fuego' + (Math.floor(j.tic / 5 + e.id) % 7), x - 8, y - 22); foco(60 + (j.tic % 10 < 5 ? 2 : 0), '#ffb060', -14); }
        return;
      case 'plataforma': g.d(ctx, 'plataforma', x - 8, Math.round(e.y - (e.z + 16)) - 8); return;
      case 'marca':
        if (e.spr === 'gato') { g.d(ctx, 'gato', x - 6, y - 6); return; }
        if (e.spr === 'altar') { g.d(ctx, 'altar', x - 8, y - 16); foco(34, '#ffd080'); return; }
        g.d(ctx, e.spr, x - 8, y - 8);
        foco(24, '#ff60c0');
        return;
      case 'recoge': {
        if (e.caduca !== undefined && e.caduca < 120 && j.tic % 6 < 3) return;
        this.sombra(j, e, 8);
        const b = Math.round(Math.sin((j.tic + e.id * 9) * 0.12) * 1.5);
        if (e.que === 'moneda') g.d(ctx, 'moneda' + (Math.floor(j.tic / 6 + e.id) % 4), x - 8, y - 14);
        else if (e.que === 'vida') g.d(ctx, 'vida' + (Math.floor(j.tic / 8) % 4), x - 8, y - 14 + b);
        else g.d(ctx, 'i_llave', x - 6, y - 14 + b);
        return;
      }
      case 'traca':
        g.d(ctx, 'traca', x - 4, y - 6);
        g.d(ctx, 'chispa' + (Math.floor(j.tic / 3) % 4), x - 8, y - 16);
        foco(20, '#ffa040');
        return;
      case 'proy': {
        if (e.clase === 'anillo') {
          if (e.espera > 0) return;
          const n = Math.max(12, Math.floor(e.r * 0.9));
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + e.r * 0.02;
            ctx.fillStyle = i % 2 ? '#fff0c0' : '#ffb040';
            ctx.fillRect(Math.round(e.x + Math.cos(a) * e.r) - 1, Math.round(e.y - e.z + Math.sin(a) * e.r * 0.8) - 1, 3, 2);
          }
          return;
        }
        this.sombra(j, e, 6);
        const gira = Math.floor(e.t / 3) % 4;
        if (e.clase === 'botella' || e.clase === 'carta' || e.clase === 'abanico') {
          const spr = e.clase;
          const [w, h] = g.tam(spr);
          ctx.save(); ctx.translate(x, y); ctx.rotate((gira * Math.PI) / 2); g.d(ctx, spr, -w / 2, -h / 2); ctx.restore();
        } else if (e.clase === 'onda') {
          ctx.save(); ctx.translate(x, y - 4); ctx.rotate(Math.atan2(e.vy, e.vx) - Math.PI / 2); g.d(ctx, 'onda', -6, -3); ctx.restore();
          foco(18, '#60d0e0', 0);
        } else if (e.clase === 'gancho') {
          const o = e.dueno;
          ctx.fillStyle = '#a5a5ad';
          const dx = e.x - o.x, dy = e.y - e.z - (o.y - o.z - 10), n = Math.hypot(dx, dy) || 1;
          for (let i = 6; i < n; i += 4) ctx.fillRect(Math.round(o.x + (dx / n) * i), Math.round(o.y - o.z - 10 + (dy / n) * i), 2, 2);
          g.d(ctx, 'gancho', x - 4, y - 4);
        } else { g.d(ctx, 'bala', x - 2, y - 2); foco(12, '#ffd060', 0); }
        return;
      }
      case 'fx': {
        const fr = Math.min(e.n - 1, Math.floor(e.t / e.paso));
        const yy = Math.round(e.y - e.z);
        switch (e.spr) {
          case 'humo': g.d(ctx, 'humo' + fr, x - 16, yy - 16); if (e.grande) { foco(56 - fr * 6, '#ffb060', 0); g.d(ctx, 'humo' + fr, x - 26, yy - 22); g.d(ctx, 'humo' + fr, x - 6, yy - 10); } return;
          case 'chispa': g.d(ctx, 'chispa' + fr, x - 8, yy - 8); return;
          case 'trozos': g.d(ctx, 'trozos' + fr, x - 16, yy - 16); return;
          case 'fuego': g.d(ctx, 'fuego' + fr, x - 8, yy - 12); foco(34, '#ff9040', 0); return;
          case 'aviso': g.d(ctx, 'aviso', x - 8, yy - 16 - Math.min(6, e.t)); return;
          case 'estela': ctx.globalAlpha = 0.35; ctx.drawImage(g.pj('blanco'), 0, e.dir * 32, 16, 32, x - 8, yy + 3 - 27, 16, 32); ctx.globalAlpha = 1; return;
        }
      }
    }
  }

  private estrellas(j: Juego, x: number, y: number): void {
    for (let i = 0; i < 3; i++) {
      const a = j.tic * 0.15 + (i * Math.PI * 2) / 3;
      this.g.d(this.ctx, 'chispa2', x - 8 + Math.cos(a) * 8, y - 8 + Math.sin(a) * 3);
    }
  }

  // ───────────────────────── marcador ─────────────────────────

  private caja(x: number, y: number, w: number, h: number): void {
    const ctx = this.ctx;
    const bandas = ['#1a2060', '#161a52', '#121444', '#0e1036'];
    ctx.fillStyle = '#080510'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = '#f0e8d8'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#8088b0'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    const ih = h - 4;
    bandas.forEach((b, i) => { ctx.fillStyle = b; ctx.fillRect(x + 2, y + 2 + Math.floor((ih * i) / 4), w - 4, Math.ceil(ih / 4)); });
    ctx.fillStyle = '#080510';
    ctx.fillRect(x, y, 1, 1); ctx.fillRect(x + w - 1, y, 1, 1); ctx.fillRect(x, y + h - 1, 1, 1); ctx.fillRect(x + w - 1, y + h - 1, 1, 1);
  }

  private hud(j: Juego): void {
    const { ctx, g } = this;
    const p = j.p;
    for (let i = 0; i < p.vidaMax / 2; i++) {
      const v = Math.max(0, Math.min(2, p.vida - i * 2));
      g.d(ctx, 'cor' + v, 6 + i * 8, 6);
    }
    if (p.bate) {
      const lleno = p.duende >= 100;
      ctx.fillStyle = '#080510'; ctx.fillRect(5, 15, 54, 6);
      ctx.fillStyle = '#30284c'; ctx.fillRect(6, 16, 52, 4);
      const w = Math.round((52 * p.duende) / 100);
      ctx.fillStyle = lleno ? (j.tic % 10 < 5 ? '#fff0a0' : '#ff5030') : '#e07020'; ctx.fillRect(6, 16, w, 4);
      ctx.fillStyle = lleno ? '#ffffff' : '#ffb040'; ctx.fillRect(6, 16, w, 1);
      if (lleno) g.t(ctx, '¡DUENDE!', 62, 13, j.tic % 10 < 5 ? '#fff0a0' : '#ff5030');
    }
    const obj = j.objetoActual();
    this.caja(ANCHO - 26, 4, 20, 20);
    if (obj) g.d(ctx, ICONO[obj], ANCHO - 22, 8);
    g.t(ctx, `${p.dinero} pts`, ANCHO - 30, 5, '#f8e080', 2);
    const llaves = p.llaves[j.def.zona] ?? 0;
    if (llaves) { g.d(ctx, 'i_llave', ANCHO - 44, 14); g.t(ctx, 'x' + llaves, ANCHO - 30, 16, '#fff', 2); }
    if (j.jefe && j.jefe.est !== 'espera') {
      const b = j.jefe, d = JEFES[b.nom];
      const w = 120, x = (ANCHO - w) / 2, y = ALTO - 14;
      g.t(ctx, d.nombre, ANCHO / 2, y - 11, '#ffd0d0', 1);
      ctx.fillStyle = '#080510'; ctx.fillRect(x - 1, y - 1, w + 2, 7);
      ctx.fillStyle = '#401020'; ctx.fillRect(x, y, w, 5);
      ctx.fillStyle = '#e03040'; ctx.fillRect(x, y, Math.round((w * Math.max(0, b.vida)) / b.vidaMax), 5);
      ctx.fillStyle = '#ff9090'; ctx.fillRect(x, y, Math.round((w * Math.max(0, b.vida)) / b.vidaMax), 1);
    }
    if (j.rotulo && j.modo !== 'dialogo') {
      const r = j.rotulo;
      const a = Math.min(1, r.t / 20, (150 - r.t) / 12 + 1);
      ctx.globalAlpha = Math.max(0, Math.round(a * 4) / 4);
      const w = g.ancho(r.texto) + 24;
      ctx.fillStyle = 'rgba(8,5,16,0.75)'; ctx.fillRect((ANCHO - w) / 2, 34, w, 15);
      ctx.fillStyle = '#ff4fa0'; ctx.fillRect((ANCHO - w) / 2, 34, w, 1); ctx.fillRect((ANCHO - w) / 2, 48, w, 1);
      g.t(ctx, r.texto, ANCHO / 2, 36, '#fff', 1);
      ctx.globalAlpha = 1;
    }
  }

  private tarjeta(j: Juego): void {
    const { ctx, g } = this;
    const t = j.tarjeta!;
    const k = Math.min(1, (150 - t.t) / 14, t.t / 10);
    const h = Math.round(34 * k);
    ctx.fillStyle = 'rgba(8,5,16,0.88)'; ctx.fillRect(0, 96 - h, ANCHO, h * 2);
    ctx.fillStyle = '#e03040'; ctx.fillRect(0, 96 - h, ANCHO, 2); ctx.fillRect(0, 96 + h - 2, ANCHO, 2);
    if (k < 0.9) return;
    const dx = Math.max(0, 150 - t.t - 14) < 8 ? (8 - (150 - t.t - 14)) * 12 : 0;
    g.t(ctx, t.titulo, ANCHO / 2 - dx, 74, '#fff', 1, '#e03040', 3);
    g.t(ctx, t.sub, ANCHO / 2 + dx, 106, '#ffd080', 1);
  }

  private dialogo(j: Juego): void {
    const { ctx, g } = this;
    const d = j.dlg!;
    const x = 8, y = 158, w = 240, h = 58;
    const texto = (d.paginas[d.pag] ?? '').slice(0, d.vis);
    if (d.paginas[d.pag] || d.quien) {
      this.caja(x, y, w, h);
      let ty = y + 8;
      if (d.quien) { g.t(ctx, d.quien, x + 8, y + 5, '#ffd040'); ty = y + 17; } else ty = y + 11;
      texto.split('\n').forEach((l, i) => g.t(ctx, l, x + 8, ty + i * 12, d.quien ? '#fff' : '#d8e0ff'));
      const completa = d.vis >= (d.paginas[d.pag] ?? '').length;
      if (completa && !d.op && j.tic % 30 < 18) { ctx.fillStyle = '#fff'; ctx.fillRect(x + w - 14, y + h - 10, 5, 1); ctx.fillRect(x + w - 13, y + h - 9, 3, 1); ctx.fillRect(x + w - 12, y + h - 8, 1, 1); }
    }
    if (d.op && d.vis >= (d.paginas[d.pag] ?? '').length && d.pag >= d.paginas.length - 1) {
      const ow = Math.max(...d.op.map((o) => g.ancho(o))) + 26;
      const oh = d.op.length * 12 + 8;
      const ox = ANCHO - 8 - ow, oy = y - oh - 3;
      this.caja(ox, oy, ow, oh);
      d.op.forEach((o, i) => {
        g.t(ctx, o, ox + 16, oy + 4 + i * 12, i === d.sel ? '#ffd040' : '#fff');
        if (i === d.sel) { ctx.fillStyle = '#ffd040'; const cy = oy + 9 + i * 12; ctx.fillRect(ox + 7, cy - 2, 1, 5); ctx.fillRect(ox + 8, cy - 1, 1, 3); ctx.fillRect(ox + 9, cy, 1, 1); }
      });
    }
  }

  private cursor(x: number, y: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#ffd040';
    ctx.fillRect(x, y - 2, 1, 5); ctx.fillRect(x + 1, y - 1, 1, 3); ctx.fillRect(x + 2, y, 1, 1);
  }

  private pausa(j: Juego): void {
    const { ctx, g } = this;
    const p = j.p;
    ctx.fillStyle = 'rgba(8,5,16,0.7)'; ctx.fillRect(0, 0, ANCHO, ALTO);
    this.caja(12, 28, 108, 168);
    g.t(ctx, 'PAUSA', 66, 36, '#ff4fa0', 1, '#101018', 2);
    j.menu.ops.forEach((o, i) => {
      g.t(ctx, o, 34, 68 + i * 14, i === j.menu.sel ? '#ffd040' : '#fff');
      if (i === j.menu.sel) this.cursor(24, 73 + i * 14);
    });
    g.t(ctx, 'Objetos', 22, 118, '#8088b0');
    const tengo: [string, boolean][] = [['i_bate', p.bate && !p.katana], ['i_katana', p.katana], ...OBJETOS.map((o) => [ICONO[o], (p as any)[o]] as [string, boolean])];
    let ix = 22;
    for (const [ic, si] of tengo) if (si) { g.d(ctx, ic, ix, 130); ix += 16; }
    g.d(ctx, 'i_sello', 22, 150); g.t(ctx, `${j.sellos()}/3`, 38, 152, '#fff');
    g.d(ctx, 'i_tinta', 62, 150); g.t(ctx, `x${p.tinta}`, 78, 152, '#fff');
    g.d(ctx, 'i_cromo', 22, 168); g.t(ctx, `x${p.cromos}`, 38, 170, '#fff');
    g.d(ctx, 'i_bocata', 62, 168); g.t(ctx, `x${p.bocatas}`, 78, 170, '#fff');
    // la espalda
    this.caja(128, 28, 116, 168);
    g.t(ctx, 'La espalda', 186, 34, '#8088b0', 1);
    this.espalda(162, 50, p.tatuaje);
    g.t(ctx, `Pieza ${p.tatuaje} de 6`, 186, 164, '#fff', 1);
    g.t(ctx, `Vida máxima: ${p.vidaMax / 2}`, 186, 176, '#ffd040', 1);
  }

  /** La espalda de Rai, con las piezas del tatuaje que lleve hechas. */
  private espalda(x: number, y: number, n: number): void {
    const ctx = this.ctx;
    const piel = '#e8d0a8', sombra = '#b89878', k = '#101018';
    ctx.fillStyle = k; ctx.fillRect(x + 15, y - 1, 18, 14); ctx.fillRect(x - 1, y + 11, 50, 98);
    ctx.fillStyle = '#28283c'; ctx.fillRect(x + 16, y, 16, 8);
    ctx.fillStyle = piel; ctx.fillRect(x + 18, y + 6, 12, 7); ctx.fillRect(x, y + 12, 48, 96);
    ctx.fillStyle = sombra; ctx.fillRect(x, y + 12, 3, 96); ctx.fillRect(x + 45, y + 12, 3, 96); ctx.fillRect(x + 23, y + 20, 2, 80);
    if (n >= 1) { // olas
      for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? '#3070c0' : '#184890'; ctx.fillRect(x + 4 + i * 8, y + 92 - (i % 2) * 3, 8, 12 + (i % 2) * 3); ctx.fillStyle = '#f0f0f8'; ctx.fillRect(x + 4 + i * 8, y + 92 - (i % 2) * 3, 8, 1); }
    }
    if (n >= 2) { // clavel negro
      ctx.fillStyle = '#181020'; ctx.fillRect(x + 6, y + 22, 12, 10); ctx.fillRect(x + 8, y + 20, 8, 14);
      ctx.fillStyle = '#c02038'; ctx.fillRect(x + 9, y + 24, 2, 2); ctx.fillRect(x + 13, y + 26, 2, 2); ctx.fillRect(x + 11, y + 29, 2, 2);
      ctx.fillStyle = '#207040'; ctx.fillRect(x + 11, y + 34, 2, 8);
    }
    if (n >= 3) { // carpa
      ctx.fillStyle = '#e07020'; ctx.fillRect(x + 6, y + 56, 10, 22); ctx.fillRect(x + 8, y + 52, 6, 30);
      ctx.fillStyle = '#f8f0e0'; ctx.fillRect(x + 9, y + 60, 2, 2); ctx.fillRect(x + 11, y + 66, 2, 2); ctx.fillRect(x + 9, y + 72, 2, 2);
      ctx.fillStyle = '#a04010'; ctx.fillRect(x + 7, y + 82, 8, 4); ctx.fillRect(x + 5, y + 84, 12, 2);
    }
    if (n >= 4) { // toro
      ctx.fillStyle = '#201820'; ctx.fillRect(x + 30, y + 24, 12, 9); ctx.fillRect(x + 28, y + 27, 3, 4);
      ctx.fillStyle = '#f0f0f8'; ctx.fillRect(x + 28, y + 22, 2, 3); ctx.fillRect(x + 33, y + 21, 2, 3);
      ctx.fillStyle = '#c02038'; ctx.fillRect(x + 30, y + 27, 1, 1);
    }
    if (n >= 5) { // dragón
      ctx.fillStyle = '#207048';
      for (let i = 0; i < 12; i++) ctx.fillRect(x + 22 + Math.round(Math.sin(i * 0.9) * 5), y + 34 + i * 5, 5, 5);
      ctx.fillStyle = '#40b070';
      for (let i = 0; i < 12; i++) ctx.fillRect(x + 23 + Math.round(Math.sin(i * 0.9) * 5), y + 35 + i * 5, 2, 2);
      ctx.fillStyle = '#f8d040'; ctx.fillRect(x + 21, y + 32, 7, 4); ctx.fillStyle = '#c02038'; ctx.fillRect(x + 22, y + 33, 1, 1); ctx.fillRect(x + 26, y + 33, 1, 1);
    }
    if (n >= 6) { // sol naciente
      ctx.fillStyle = '#e02838'; ctx.fillRect(x + 19, y + 14, 10, 6); ctx.fillRect(x + 21, y + 13, 6, 8);
      for (let i = 0; i < 5; i++) ctx.fillRect(x + 6 + i * 9, y + 13 + Math.abs(2 - i) * 2, 3, 2);
    }
  }

  private muerte(j: Juego): void {
    const { ctx, g } = this;
    ctx.fillStyle = 'rgba(60,4,16,0.72)'; ctx.fillRect(0, 0, ANCHO, ALTO);
    g.t(ctx, 'HAS CAÍDO', ANCHO / 2, 60, '#fff', 1, '#e03040', 3);
    g.t(ctx, 'El barrio sigue esperando.', ANCHO / 2, 104, '#ffd0d0', 1);
    j.menu.ops.forEach((o, i) => {
      g.t(ctx, o, ANCHO / 2, 136 + i * 16, i === j.menu.sel ? '#ffd040' : '#fff', 1);
      if (i === j.menu.sel) this.cursor(ANCHO / 2 - g.ancho(o) / 2 - 10, 141 + i * 16);
    });
  }

  private tragaperras(j: Juego): void {
    const { ctx, g } = this;
    const t = j.traga;
    ctx.fillStyle = 'rgba(8,5,16,0.75)'; ctx.fillRect(0, 0, ANCHO, ALTO);
    this.caja(58, 44, 140, 124);
    g.t(ctx, 'LA BIEN PAGÁ', ANCHO / 2, 52, '#ff4fa0', 1, '#101018', 2);
    for (let i = 0; i < 3; i++) {
      const x = 76 + i * 38;
      ctx.fillStyle = '#080510'; ctx.fillRect(x - 1, 83, 30, 30);
      ctx.fillStyle = '#f0e8d8'; ctx.fillRect(x, 84, 28, 28);
      const [c, cx] = [g, ctx];
      cx.save(); cx.translate(x + 2, 86); cx.scale(2, 2); c.d(cx, RODILLO[t.r[i]], 0, 0); cx.restore();
    }
    g.t(ctx, t.msg, ANCHO / 2, 124, '#ffd040', 1);
    g.t(ctx, `Tienes ${j.p.dinero} pts`, ANCHO / 2, 138, '#fff', 1);
    g.t(ctx, 'Acción: tirar · Salto: salir', ANCHO / 2, 152, '#8088b0', 1);
  }

  // ───────────────────────── pantallas ─────────────────────────

  private titulo(j: Juego): void {
    const { ctx, g } = this;
    ctx.drawImage(g.cielo, -((j.tic * 0.1) % 256), 0);
    ctx.fillStyle = 'rgba(8,5,16,0.35)'; ctx.fillRect(0, 0, ANCHO, ALTO);
    ctx.save(); ctx.translate(ANCHO / 2 - 18, 14); ctx.scale(3, 3); g.d(ctx, 'i_clavel', 0, 0); ctx.restore();
    const parpadea = j.tic % 170 < 5;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#ff2060'; ctx.globalAlpha = parpadea ? 0.05 : 0.16; ctx.fillRect(34, 56, 188, 44);
    ctx.globalAlpha = parpadea ? 0.03 : 0.1; ctx.fillRect(24, 48, 208, 60);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    g.t(ctx, 'CLAVEL NEGRO', ANCHO / 2, 60, parpadea ? '#a03050' : '#ff4f90', 1, '#40081c', 3);
    ctx.globalAlpha = parpadea ? 0.1 : 0.5; g.t(ctx, 'CLAVEL NEGRO', ANCHO / 2, 60, '#ffffff', 1, null, 3); ctx.globalAlpha = 1;
    g.t(ctx, 'Una historia de Puerto Albor · 1999', ANCHO / 2, 104, '#f8e080', 1);
    j.menu.ops.forEach((o, i) => {
      g.t(ctx, o, ANCHO / 2, 138 + i * 16, i === j.menu.sel ? '#ffd040' : '#fff', 1);
      if (i === j.menu.sel) this.cursor(ANCHO / 2 - g.ancho(o) / 2 - 10, 143 + i * 16);
    });
    g.t(ctx, this.tactil ? 'Pulsa GOLPE para empezar' : 'Z golpe · X salto · C objeto · V cambiar · Intro pausa', ANCHO / 2, 196, '#8088b0', 1);
    g.t(ctx, 'Gráficos CC0 de ArMM1998 y Kenney', ANCHO / 2, 208, '#505880', 1);
  }

  private escena(j: Juego): void {
    const { ctx, g } = this;
    const e = j.escena!;
    ctx.drawImage(g.cielo, -60, 0);
    ctx.fillStyle = 'rgba(8,5,16,0.72)'; ctx.fillRect(0, 0, ANCHO, ALTO);
    const lineas = e.lineas[e.i].split('\n').flatMap((l) => (l ? partir(l, 208) : ['']));
    const a = Math.min(1, e.t / 24);
    ctx.globalAlpha = Math.round(a * 5) / 5;
    const y0 = 112 - (lineas.length * 14) / 2;
    lineas.forEach((l, i) => g.t(ctx, l, ANCHO / 2, y0 + i * 14, '#f0e8d8', 1));
    ctx.globalAlpha = 1;
    if (e.t > 40 && j.tic % 40 < 24) g.t(ctx, '▼'.replace('▼', '·'), ANCHO / 2, 200, '#8088b0', 1);
  }

  private creditos(j: Juego): void {
    const { ctx, g } = this;
    ctx.drawImage(g.cielo, -((j.congelado * 0.15) % 256), 0);
    ctx.fillStyle = 'rgba(8,5,16,0.55)'; ctx.fillRect(0, 0, ANCHO, ALTO);
    const lineas = GUION.creditos;
    const alto = lineas.length * 14;
    const y0 = Math.max(ALTO / 2 - alto / 2, ALTO - j.congelado * 0.45);
    lineas.forEach((l, i) => {
      const y = y0 + i * 14;
      if (y < -12 || y > ALTO) return;
      if (i === 0) g.t(ctx, l, ANCHO / 2, y - 14, '#ff4f90', 1, '#40081c', 2);
      else g.t(ctx, l, ANCHO / 2, y, l.startsWith('«') || l.startsWith('de ') || l === 'Claude' || l.startsWith('Tiny5') ? '#fff' : '#f8e080', 1);
    });
    if (j.congelado > 240 && j.tic % 40 < 24) g.t(ctx, 'FIN', ANCHO / 2, 206, '#8088b0', 1);
  }
}
