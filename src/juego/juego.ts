// Lógica del juego: no toca el DOM. Recibe la entrada de cada paso (60 Hz) y actualiza el estado;
// la vista lo pinta y el audio consume las colas `sonidos` y `musica`.
import { ALTO, ANCHO, DX, DY, T, TERR, partidaNueva, type DefSala, type Dir, type Ent, type Entrada, type Partida, type Paso } from '../tipos';
import { AGUA_Z, FOSO_Z, SOLIDO_Z, Sala } from '../mundo/sala';
import { SALAS } from '../datos/salas';
import { TEMAS, type Tema } from '../datos/temas';
import { ENEMIGOS, actualizarEnemigo, actualizarProyectil } from './enemigos';
import { JEFES, actualizarJefe } from './jefes';
import { GUION, MARCAS, PNJS } from '../datos/guion';
import { partir } from './texto';

export const G = 0.2;
export const VSALTO = 2.9;
export const PASO = 3;
export const VEL = 1.2;
const ENEMIGO_DE: Record<string, string> = { E: 'maton', F: 'navajero', H: 'botellero', D: 'perro', M: 'estibador', Q: 'crupier', R: 'novillero', U: 'guardaespaldas' };
export const OBJETOS = ['tracas', 'mechero', 'capote'] as const;
export const NOMBRE_ZONA: Record<string, string> = {
  pueblo: 'Puerto Albor', lonja: 'La Lonja', bodega: 'Las Bodegas', toros: 'Plaza de toros', hotel: 'Hotel Gran Sol',
};

export interface Almacen { leer(): string | null; escribir(s: string): void }
export type Modo = 'titulo' | 'escena' | 'juego' | 'dialogo' | 'pausa' | 'trans' | 'muerte' | 'tragaperras' | 'creditos';

interface Dialogo { cola: Paso[]; quien: string; paginas: string[]; pag: number; vis: number; op: string[] | null; sel: number; r: ((i: number) => Paso[] | void) | null }

export class Juego {
  p: Partida = partidaNueva();
  sala!: Sala;
  def!: DefSala;
  tema!: Tema;
  ents: Ent[] = [];
  jug!: Ent;
  modo: Modo = 'titulo';
  canales: Record<string, boolean> = {};
  sonidos: string[] = [];
  musica = 'titulo';
  cam = { x: 0, y: 0 };
  temblor = 0;
  destello = 0;
  pausaGolpe = 0;
  congelado = 0;
  tic = 0;
  dlg: Dialogo | null = null;
  trans: { t: number; sala: string; puerta: string | null; hecho: boolean } | null = null;
  tarjeta: { titulo: string; sub: string; t: number } | null = null;
  rotulo: { texto: string; t: number } | null = null;
  escena: { lineas: string[]; i: number; t: number; fin: () => void } | null = null;
  menu = { sel: 0, ops: [] as string[] };
  traga = { r: [0, 1, 2], t: 0, msg: '', gira: false };
  jefe: Ent | null = null;
  hayGuardado = false;
  private sigId = 1;
  puertaCelda = new Map<number, string>();
  private indicePuerta = 0;
  private antDy = 0;
  private antDx = 0;
  private entrada: { sala: string; puerta: string | null } = { sala: 'muelle', puerta: null };
  private zonaVista = '';

  constructor(public almacen: Almacen | null = null, public azar: () => number = Math.random) {
    this.hayGuardado = !!almacen?.leer();
    this.abrirTitulo();
  }

  // ───────────────────────── utilidades ─────────────────────────

  sfx(n: string): void { this.sonidos.push(n); }
  /** Durante el combate con un jefe no se puede salir de la sala. */
  sellada(): boolean { return !!this.jefe && this.jefe.est !== 'espera' && this.jefe.est !== 'vencido'; }
  ban(k: string): boolean { return !!this.p.banderas[k]; }
  pon(k: string, v = 1): void { this.p.banderas[k] = v; }
  sellos(): number { return (this.ban('jefe:percebe') ? 1 : 0) + (this.ban('jefe:faraona') ? 1 : 0) + (this.ban('jefe:miura') ? 1 : 0); }
  arma(): number { return this.p.katana ? 4 : this.p.bate ? 2 : 0; }
  objetosTenidos(): string[] { return OBJETOS.filter((o) => (this.p as any)[o]); }
  objetoActual(): string | null {
    const l = this.objetosTenidos();
    return l.length ? l[this.p.objeto % l.length] : null;
  }

  crear(tipo: string, x: number, y: number, extra: Record<string, any> = {}): Ent {
    const e: Ent = { id: this.sigId++, tipo, x, y, z: 0, vx: 0, vy: 0, vz: 0, rx: 5, ry: 4, dir: 0, vivo: true, solido: false, alto: 0, est: '', t: 0, ...extra };
    this.ents.push(e);
    return e;
  }

  fx(spr: string, x: number, y: number, z: number, n: number, paso = 4, extra: Record<string, any> = {}): Ent {
    return this.crear('fx', x, y, { z, spr, n, paso, t: 0, ...extra });
  }

  /** Apoyo más alto alcanzable y si algo bloquea, para una huella en (x, y) a altura z. */
  probar(x: number, y: number, rx: number, ry: number, z: number, ign?: Ent): { sup: number; blq: boolean; ent: Ent | null } {
    const s = this.sala;
    let sup = -999, blq = false, ent: Ent | null = null;
    const sellada = this.sellada();
    const c0 = Math.floor((x - rx) / T), c1 = Math.floor((x + rx - 0.01) / T);
    const f0 = Math.floor((y - ry) / T), f1 = Math.floor((y + ry - 0.01) / T);
    for (let f = f0; f <= f1; f++) {
      for (let c = c0; c <= c1; c++) {
        const h = s.suelo(c, f);
        if (h > z + PASO || (sellada && this.puertaCelda.has(f * s.an + c))) blq = true; else if (h > sup) sup = h;
      }
    }
    for (const o of this.ents) {
      if (!o.solido || o === ign || !o.vivo) continue;
      if (Math.abs(o.x - x) >= o.rx + rx || Math.abs(o.y - y) >= o.ry + ry) continue;
      const tope = o.z + o.alto;
      if (tope <= z + PASO) { if (tope > sup) { sup = tope; ent = o; } }
      else if (o.z < z + 20) blq = true;
    }
    return { sup, blq, ent };
  }

  /** Mueve por ejes; devuelve una máscara: 1 si chocó en x, 2 si chocó en y. `sinCaer` impide bajar escalones. */
  mover(e: Ent, dx: number, dy: number, sinCaer = false): number {
    let choque = 0;
    for (const eje of [0, 1]) {
      let d = eje === 0 ? dx : dy;
      while (d !== 0) {
        const paso = Math.abs(d) > 4 ? Math.sign(d) * 4 : d;
        d -= paso;
        const nx = e.x + (eje === 0 ? paso : 0), ny = e.y + (eje === 1 ? paso : 0);
        const r = this.probar(nx, ny, e.rx, e.ry, e.z, e);
        let libre = !r.blq;
        if (libre && sinCaer) {
          const bajo = this.sala.suelo(Math.floor(nx / T), Math.floor(ny / T));
          if (bajo < e.z - PASO && r.sup < e.z - PASO) libre = false;
        }
        if (libre) { e.x = nx; e.y = ny; } else { choque |= eje + 1; break; }
      }
    }
    return choque;
  }

  /** Gravedad y aterrizaje. Devuelve true si acaba de tocar suelo. */
  fisica(e: Ent): boolean {
    const r = this.probar(e.x, e.y, e.rx, e.ry, e.z, e);
    e.apoyo = r.ent;
    if (e.z > r.sup + 0.01 || e.vz > 0) {
      e.vz = Math.max(-5, e.vz - G);
      e.z += e.vz;
      if (e.z <= r.sup) { e.z = r.sup; e.vz = 0; e.suelo = true; return true; }
      e.suelo = false;
      return false;
    }
    e.z = r.sup; e.vz = 0; e.suelo = true;
    return false;
  }

  dist(a: { x: number; y: number }, b: { x: number; y: number }): number { return Math.hypot(a.x - b.x, a.y - b.y); }

  // ───────────────────────── salas ─────────────────────────

  cargarSala(id: string, puerta: string | null): void {
    const def = SALAS[id];
    if (!def) throw new Error(`sala desconocida: ${id}`);
    this.def = def;
    this.sala = new Sala(def);
    this.tema = TEMAS[(def as any).tema ?? def.zona] ?? TEMAS.pueblo;
    this.ents = [];
    this.jefe = null;
    this.canales = {};
    this.puertaCelda.clear();
    this.entrada = { sala: id, puerta };
    this.p.sala = id; this.p.puerta = puerta;
    const s = this.sala;
    const canalDe = (c: string, i: number) => def.canal?.[c]?.[i] ?? 'a';
    const k = (c: string, i: number) => `${id}:${c}${i}`;
    let inicio: [number, number] | null = null;
    for (const o of s.objetos) {
      const x = o.col * T + 8, y = o.fila * T + 8, z = s.nivel(o.col, o.fila) * T;
      const base = { z, col: o.col, fila: o.fila, i: o.i };
      const ch = o.c;
      if (ch >= '1' && ch <= '9') { this.puertaCelda.set(o.fila * s.an + o.col, ch); s.extra[o.fila * s.an + o.col] = 0; continue; }
      switch (ch) {
        case 'P': inicio = [x, y]; break;
        case 'c': this.crear('caja', x, y, { ...base, rx: 8, ry: 8, solido: true, alto: 16, est: 'quieta' }); break;
        case 'b': this.crear('barril', x, y, { ...base, rx: 6, ry: 5, solido: true, alto: 14, golpeable: true }); break;
        case 'p': this.crear('placa', x, y, { ...base, canal: canalDe(ch, o.i), pisada: false }); break;
        case 'L': this.crear('palanca', x, y, { ...base, rx: 5, ry: 4, solido: true, alto: 40, canal: canalDe(ch, o.i), activo: this.ban(k('L', o.i)), golpeable: true, inter: true, cuenta: 0 }); break;
        case 'G': this.crear('reja', x, y, { ...base, rx: 8, ry: 8, solido: true, alto: 40, canal: canalDe(ch, o.i), abre: 0 }); break;
        case 'x': this.crear('puente', x, y, { ...base, canal: canalDe(ch, o.i), orig: s.tipo(o.col, o.fila), puesto: false }); break;
        case 'K': if (!this.ban(k('K', o.i))) this.crear('cerrojo', x, y, { ...base, rx: 8, ry: 8, solido: true, alto: 40 }); break;
        case 'k': if (!this.ban(k('k', o.i))) this.crear('recoge', x, y, { ...base, que: 'llave', clave: k('k', o.i) }); break;
        case 'C': this.crear('cofre', x, y, { ...base, rx: 7, ry: 5, solido: true, alto: 12, inter: true, que: def.cofres?.[o.i] ?? 'dinero:50', abierto: this.ban(k('C', o.i)) }); break;
        case 'i': this.crear('vela', x, y, { ...base, rx: 4, ry: 3, solido: true, alto: 40, canal: canalDe(ch, o.i), encendida: false }); break;
        case 'I': this.crear('vela', x, y, { ...base, rx: 4, ry: 3, solido: true, alto: 40, canal: '', encendida: true, fija: true }); break;
        case 'g': if (!this.ban(k('g', o.i))) this.crear('grieta', x, y, { ...base, rx: 8, ry: 8, solido: true, alto: 48 }); break;
        case 'f': if (!this.ban(k('f', o.i))) this.crear('barricada', x, y, { ...base, rx: 8, ry: 8, solido: true, alto: 48, arde: 0 }); break;
        case 'T': this.crear('cabina', x, y, { ...base, rx: 6, ry: 5, solido: true, alto: 48, inter: true }); break;
        case 'S': this.crear('cartel', x, y, { ...base, rx: 6, ry: 4, solido: true, alto: 48, inter: true, texto: def.carteles?.[o.i] ?? '…' }); break;
        case 'N': {
          const nom = def.pnj?.[o.i] ?? '';
          const d = PNJS[nom];
          if (!d) throw new Error(`PNJ desconocido «${nom}» en ${id}`);
          if (!d.si || d.si(this)) this.crear('pnj', x, y, { ...base, rx: 5, ry: 4, solido: true, alto: 48, inter: true, nom, pal: d.pal, dir: d.dir ?? 0 });
          break;
        }
        case '*': {
          const nom = def.marcas?.[o.i] ?? '';
          const d = MARCAS[nom];
          if (!d) throw new Error(`marca desconocida «${nom}» en ${id}`);
          if (!d.si || d.si(this)) this.crear('marca', x, y, { ...base, rx: 6, ry: 5, solido: d.solido !== false, alto: 48, inter: true, nom, spr: d.spr });
          break;
        }
        case 'm': {
          const [dx, dy, n] = def.plataformas?.[o.i] ?? [1, 0, 3];
          this.crear('plataforma', x, y, { ...base, z: -16, rx: 8, ry: 8, solido: true, alto: 16, x0: x, y0: y, x1: x + dx * n * T, y1: y + dy * n * T, ida: true, espera: 30 });
          break;
        }
        case 'h': this.crear('recoge', x, y, { ...base, que: 'vida' }); break;
        case '$': this.crear('recoge', x, y, { ...base, que: 'moneda', valor: 100 }); break;
        case 'J': {
          const nom = def.jefe ?? '';
          if (!this.ban('jefe:' + nom)) {
            const d = JEFES[nom];
            this.jefe = this.crear('jefe', x, y, { ...base, nom, vida: d.vida, vidaMax: d.vida, rx: d.rx ?? 6, ry: d.ry ?? 5, pal: d.pal, est: 'espera', kx: 0, ky: 0, flash: 0, fase: 1, n: 0 });
          }
          break;
        }
        default: {
          const tipo = ENEMIGO_DE[ch];
          if (!tipo) throw new Error(`carácter «${ch}» sin significado en ${id} (${o.col},${o.fila})`);
          const d = ENEMIGOS[tipo];
          this.crear('enemigo', x, y, { ...base, cls: tipo, vida: d.vida, pal: d.pal, est: 'quieto', kx: 0, ky: 0, flash: 0, alerta: false, rx: d.rx ?? 5, ry: d.ry ?? 4, x0: x, y0: y });
        }
      }
    }
    // Jugador
    let jx = 0, jy = 0, jdir: Dir = 0;
    if (puerta) {
      const celdas = [...this.puertaCelda.entries()].filter(([, c]) => c === puerta).map(([i]) => i);
      if (!celdas.length) throw new Error(`la sala ${id} no tiene la puerta ${puerta}`);
      const i = celdas[Math.min(this.indicePuerta, celdas.length - 1)];
      const c = i % s.an, f = (i / s.an) | 0;
      jx = c * T + 8; jy = f * T + 8;
      const orden: Dir[] = c === 0 ? [1, 0, 2, 3] : c === s.an - 1 ? [3, 0, 2, 1] : f === 0 ? [0, 1, 3, 2] : f === s.al - 1 ? [2, 1, 3, 0] : [0, 2, 1, 3];
      for (const d of orden) {
        const nc = c + DX[d], nf = f + DY[d];
        if (s.suelo(nc, nf) < SOLIDO_Z && s.suelo(nc, nf) > AGUA_Z && !this.puertaCelda.has(nf * s.an + nc)) { jx = nc * T + 8; jy = nf * T + 8; jdir = d; break; }
      }
    } else if (inicio) { [jx, jy] = inicio; } else { jx = s.an * 8; jy = s.al * 8; }
    const ant = this.jug;
    this.jug = this.crear('jugador', jx, jy, {
      dir: jdir, est: 'normal', inv: ant ? Math.max(ant.inv ?? 0, 20) : 0, combo: 0, sig: false, carga: 0, coyote: 0, empuje: 0, kx: 0, ky: 0,
      suelo: true, seguro: { x: jx, y: jy }, capoteListo: true, enfria: 0, anda: 0, dados: new Set<number>(), flash: 0,
    });
    this.jug.z = Math.max(0, this.probar(jx, jy, 5, 4, 200, this.jug).sup);
    this.jug.seguro.z = this.jug.z;
    this.actualizarCanales(true);
    this.centrarCamara(true);
    this.musica = def.musica ?? this.tema.musica;
    if (def.zona !== this.zonaVista) {
      this.zonaVista = def.zona;
      this.rotulo = { texto: def.nombre ?? NOMBRE_ZONA[def.zona] ?? '', t: 150 };
    } else if (def.nombre) this.rotulo = { texto: def.nombre, t: 120 };
    if (def.alEntrar) GUION.entrar[def.alEntrar]?.(this);
  }

  irA(sala: string, puerta: string | null): void {
    if (this.trans) return;
    this.trans = { t: 0, sala, puerta, hecho: false };
    this.modo = 'trans';
    this.sfx('puerta');
  }

  centrarCamara(ya = false): void {
    const j = this.jug, s = this.sala;
    const mx = s.an * T - ANCHO, my = s.al * T - ALTO;
    let tx = j.x - ANCHO / 2, ty = j.y - j.z * 0.5 - ALTO / 2 - 8;
    tx = mx <= 0 ? mx / 2 : Math.max(0, Math.min(mx, tx));
    ty = my <= 0 ? my / 2 : Math.max(0, Math.min(my, ty));
    if (ya) { this.cam.x = tx; this.cam.y = ty; return; }
    this.cam.x += (tx - this.cam.x) * 0.18;
    this.cam.y += (ty - this.cam.y) * 0.18;
  }

  // ───────────────────────── guardado ─────────────────────────

  guardar(): void {
    if (!this.almacen) return;
    this.p.sala = this.entrada.sala; this.p.puerta = this.entrada.puerta;
    this.almacen.escribir(JSON.stringify(this.p));
    this.hayGuardado = true;
  }

  cargar(): boolean {
    const s = this.almacen?.leer();
    if (!s) return false;
    try {
      this.p = { ...partidaNueva(), ...JSON.parse(s) };
      this.zonaVista = '';
      this.cargarSala(this.p.sala, this.p.puerta);
      this.modo = 'juego';
      return true;
    } catch { return false; }
  }

  nueva(): void {
    this.p = partidaNueva();
    this.zonaVista = '';
    this.verEscena(GUION.intro, () => { this.cargarSala('muelle', null); this.modo = 'juego'; GUION.entrar.inicio?.(this); });
  }

  abrirTitulo(): void {
    this.modo = 'titulo';
    this.musica = 'titulo';
    this.menu = { sel: 0, ops: this.hayGuardado ? ['Continuar', 'Nueva partida'] : ['Nueva partida'] };
  }

  verEscena(lineas: string[], fin: () => void): void {
    this.escena = { lineas, i: 0, t: 0, fin };
    this.modo = 'escena';
  }

  // ───────────────────────── diálogo ─────────────────────────

  decir(pasos: Paso[]): void {
    if (!pasos.length) return;
    if (this.dlg) { this.dlg.cola.push(...pasos); return; }
    this.dlg = { cola: [...pasos], quien: '', paginas: [], pag: 0, vis: 0, op: null, sel: 0, r: null };
    this.modo = 'dialogo';
    this.avanzarDialogo();
  }

  private avanzarDialogo(): void {
    const d = this.dlg!;
    for (;;) {
      const paso = d.cola.shift();
      if (paso === undefined) {
        this.dlg = null;
        if (this.modo === 'dialogo') this.modo = 'juego';
        return;
      }
      if (typeof paso === 'string' || Array.isArray(paso)) {
        const [quien, texto] = typeof paso === 'string' ? ['', paso] : paso;
        d.quien = quien;
        const lineas = partir(texto, 226);
        d.paginas = [];
        for (let i = 0; i < lineas.length; i += 3) d.paginas.push(lineas.slice(i, i + 3).join('\n'));
        d.pag = 0; d.vis = 0; d.op = null; d.r = null;
        const sig = d.cola[0];
        if (sig && typeof sig === 'object' && !Array.isArray(sig) && 'op' in sig) { d.cola.shift(); d.op = sig.op; d.r = sig.r; d.sel = 0; }
        return;
      }
      if ('f' in paso) {
        const mas = paso.f();
        if (mas) d.cola.unshift(...mas);
        if (this.modo !== 'dialogo') { // la acción cambió de modo (transición, escena…)
          if (!d.cola.length) this.dlg = null;
          return;
        }
        continue;
      }
      // opciones sin texto previo
      d.quien = ''; d.paginas = ['']; d.pag = 0; d.vis = 0; d.op = paso.op; d.r = paso.r; d.sel = 0;
      return;
    }
  }

  private actDialogo(en: Entrada, arriba: boolean, abajo: boolean): void {
    const d = this.dlg;
    if (!d) { this.modo = 'juego'; return; }
    const texto = d.paginas[d.pag] ?? '';
    if (d.vis < texto.length) {
      d.vis += en.m.a || en.m.b ? 3 : 1;
      if (this.tic % 3 === 0) this.sfx('letra');
      if (en.p.a && d.vis > 4) d.vis = texto.length;
      return;
    }
    const ultima = d.pag >= d.paginas.length - 1;
    if (ultima && d.op) {
      if (arriba) { d.sel = (d.sel + d.op.length - 1) % d.op.length; this.sfx('cursor'); }
      if (abajo) { d.sel = (d.sel + 1) % d.op.length; this.sfx('cursor'); }
      if (en.p.a) {
        this.sfx('ok');
        const mas = d.r?.(d.sel);
        if (mas) d.cola.unshift(...mas);
        this.avanzarDialogo();
      }
      return;
    }
    if (en.p.a || en.p.b) {
      this.sfx('ok');
      if (!ultima) { d.pag++; d.vis = 0; } else this.avanzarDialogo();
    }
  }

  /** Entrega un objeto al jugador y devuelve el texto que lo anuncia. */
  dar(que: string): Paso[] {
    const p = this.p;
    const [cosa, n] = que.split(':');
    this.sfx(cosa === 'dinero' || cosa === 'bocata' || cosa === 'llave' ? 'cofre' : 'fanfarria');
    switch (cosa) {
      case 'dinero': p.dinero += +n; return [`Dentro hay ${n} pesetas.`];
      case 'llave': p.llaves[this.def.zona] = (p.llaves[this.def.zona] ?? 0) + 1; return ['Una llave pequeña. Abre un cerrojo de este sitio.'];
      case 'tinta': p.tinta++; return ['¡Un bote de TINTA! Llévaselo al Chino Pérez, el tatuador de la plaza: cada pieza de tu espalda te hará más duro.'];
      case 'bocata': p.bocatas = Math.min(5, p.bocatas + 1); return ['Un bocata de calamares envuelto en papel de plata. Cómetelo desde el menú de pausa.'];
      case 'cromo': p.cromos++; return [`Un cromo de la Liga 98-99. Llevas ${p.cromos}.`];
      case 'bate': p.bate = true; return ['¡Tienes el BATE del bar! Golpea con el botón de acción; encadena hasta tres golpes y mantenlo pulsado para cargar un giro.'];
      case 'katana': p.katana = true; return ['¡La KATANA de Don Hideo! El acero que cruzó medio mundo. Golpea el doble de fuerte.'];
      case 'tracas': p.tracas = true; p.objeto = this.objetosTenidos().indexOf('tracas'); return ['¡TRACAS de las Fallas! Úsalas con el botón de objeto: revientan muros agrietados… y a quien pillen cerca.'];
      case 'mechero': p.mechero = true; p.objeto = this.objetosTenidos().indexOf('mechero'); return ['¡El MECHERO de gasolina! Enciende velas y mechas, quema barricadas de madera y alumbra en la oscuridad.'];
      case 'capote': p.capote = true; p.objeto = this.objetosTenidos().indexOf('capote'); return ['¡El CAPOTE de brega! Un quiebro rápido que esquiva embestidas. Úsalo en pleno salto para cruzar vacíos enormes.'];
      case 'vida': p.vida = p.vidaMax; return ['Te sientes como nuevo.'];
      case 'cana': this.pon('cana'); return ['Una caña de pescar con «CARMELA» grabado a navaja en el mango. Chema, el pescador del muelle, la estará echando de menos.'];
    }
    return [];
  }

  // ───────────────────────── paso principal ─────────────────────────

  paso(en: Entrada): void {
    this.tic++;
    const arriba = en.dy < -0.5 && this.antDy >= -0.5, abajo = en.dy > 0.5 && this.antDy <= 0.5;
    const izq = en.dx < -0.5 && this.antDx >= -0.5, der = en.dx > 0.5 && this.antDx <= 0.5;
    this.antDy = en.dy; this.antDx = en.dx;
    if (this.temblor > 0) this.temblor--;
    if (this.destello > 0) this.destello--;
    if (this.rotulo && --this.rotulo.t <= 0) this.rotulo = null;
    if (this.trans) {
      // fundido entre salas: bloquea todo lo demás mientras dura
      const t = this.trans;
      t.t++;
      if (t.t === 12 && !t.hecho) {
        t.hecho = true;
        this.cargarSala(t.sala, t.puerta);
        this.guardar();
      }
      if (t.t >= 24) {
        this.trans = null;
        if (this.modo === 'trans') {
          if (this.dlg) { this.modo = 'dialogo'; this.avanzarDialogo(); } else this.modo = 'juego';
        }
      }
      return;
    }
    switch (this.modo) {
      case 'titulo':
        if (arriba || abajo) { this.menu.sel = (this.menu.sel + 1) % this.menu.ops.length; this.sfx('cursor'); }
        if (en.p.a || en.p.e) {
          this.sfx('ok');
          if (this.menu.ops[this.menu.sel] === 'Continuar') { if (!this.cargar()) this.nueva(); } else this.nueva();
        }
        break;
      case 'escena': {
        const e = this.escena!;
        e.t++;
        if (en.p.a || en.p.e || e.t > 260) {
          if (e.t < 30) break;
          e.i++; e.t = 0;
          if (e.i >= e.lineas.length) { this.escena = null; e.fin(); }
        }
        break;
      }
      case 'dialogo': this.actDialogo(en, arriba, abajo); break;
      case 'pausa': this.actPausa(en, arriba, abajo); break;
      case 'muerte':
        if (arriba || abajo) { this.menu.sel = (this.menu.sel + 1) % 2; this.sfx('cursor'); }
        if (en.p.a) {
          this.sfx('ok');
          if (this.menu.sel === 0) {
            this.p.vida = this.p.vidaMax;
            this.p.dinero = Math.floor(this.p.dinero * 0.9);
            this.jug = undefined as any;
            this.cargarSala(this.entrada.sala, this.entrada.puerta);
            this.modo = 'juego';
          } else this.abrirTitulo();
        }
        break;
      case 'tragaperras': this.actTragaperras(en); break;
      case 'creditos':
        this.congelado++;
        if ((en.p.a || en.p.e) && this.congelado > 240) this.abrirTitulo();
        break;
      case 'trans': break;
      case 'juego': this.actJuego(en); break;
    }
  }

  private actPausa(en: Entrada, arriba: boolean, abajo: boolean): void {
    const ops = this.menu.ops;
    if (arriba) { this.menu.sel = (this.menu.sel + ops.length - 1) % ops.length; this.sfx('cursor'); }
    if (abajo) { this.menu.sel = (this.menu.sel + 1) % ops.length; this.sfx('cursor'); }
    if (en.p.e || en.p.b) { this.modo = 'juego'; this.sfx('ok'); return; }
    if (!en.p.a) return;
    const op = ops[this.menu.sel];
    if (op === 'Seguir') { this.modo = 'juego'; this.sfx('ok'); }
    else if (op.startsWith('Comer bocata')) {
      if (this.p.bocatas > 0 && this.p.vida < this.p.vidaMax) {
        this.p.bocatas--; this.p.vida = Math.min(this.p.vidaMax, this.p.vida + 6); this.sfx('cura');
        this.abrirPausa(this.menu.sel);
      } else this.sfx('no');
    } else if (op === 'Salir al título') { this.guardar(); this.abrirTitulo(); }
  }

  abrirPausa(sel = 0): void {
    this.modo = 'pausa';
    this.menu = { sel, ops: ['Seguir', `Comer bocata (${this.p.bocatas})`, 'Salir al título'] };
  }

  abrirTragaperras(): void {
    this.modo = 'tragaperras';
    this.traga = { r: [0, 1, 2], t: 0, msg: 'Pulsa acción: 100 pts la tirada', gira: false };
  }

  private actTragaperras(en: Entrada): void {
    const g = this.traga;
    if (g.gira) {
      g.t++;
      if (g.t % 4 === 0) {
        this.sfx('letra');
        for (let i = 0; i < 3; i++) if (g.t < 40 + i * 25) g.r[i] = Math.floor(this.azar() * 5);
      }
      if (g.t >= 95) {
        g.gira = false;
        const [a, b, c] = g.r;
        let premio = 0;
        if (a === b && b === c) premio = [400, 600, 800, 1200, 2500][a];
        else if (a === b || b === c || a === c) premio = 150;
        if (premio) { this.p.dinero += premio; g.msg = `¡Premio! +${premio} pts`; this.sfx('fanfarria'); }
        else { g.msg = 'Nada. La casa siempre gana.'; this.sfx('no'); }
      }
      return;
    }
    if (en.p.b || en.p.e) { this.modo = 'juego'; return; }
    if (en.p.a) {
      if (this.p.dinero < 100) { g.msg = 'No te llega: son 100 pts.'; this.sfx('no'); return; }
      this.p.dinero -= 100; g.gira = true; g.t = 0; g.msg = '…';
    }
  }

  // ───────────────────────── juego ─────────────────────────

  private actJuego(en: Entrada): void {
    if (this.tarjeta) {
      if (--this.tarjeta.t <= 0) this.tarjeta = null;
      return;
    }
    if (this.pausaGolpe > 0) { this.pausaGolpe--; return; }
    this.p.pasos++;
    if (en.p.e && this.jug.est !== 'cae' && this.jug.est !== 'muerto') { this.abrirPausa(); this.sfx('ok'); return; }
    // plataformas antes que nadie, para arrastrar a quien llevan encima
    for (const e of this.ents) if (e.tipo === 'plataforma') this.actPlataforma(e);
    this.actJugador(en);
    if (this.modo !== 'juego') return;
    for (const e of this.ents) {
      if (!e.vivo) continue;
      switch (e.tipo) {
        case 'enemigo': actualizarEnemigo(this, e); break;
        case 'jefe': actualizarJefe(this, e); break;
        case 'proy': actualizarProyectil(this, e); break;
        case 'fx': if (++e.t >= e.n * e.paso) e.vivo = false; if (e.vx || e.vy) { e.x += e.vx; e.y += e.vy; } break;
        case 'caja': this.actCaja(e); break;
        case 'traca': this.actTraca(e); break;
        case 'recoge': this.actRecoge(e); break;
        case 'barricada': if (e.arde > 0 && --e.arde === 0) { e.vivo = false; this.pon(`${this.def.id}:f${e.i}`); this.fx('humo', e.x, e.y, e.z + 8, 6, 4); } break;
        case 'palanca': if (e.cuenta > 0) { if (e.cuenta % 30 === 0) this.sfx('tic'); if (--e.cuenta === 0) { e.activo = false; this.sfx('no'); } } break;
        case 'reja': {
          const abierta = !!this.canales[e.canal];
          const antes = e.abre;
          e.abre = Math.max(0, Math.min(16, e.abre + (abierta ? 1 : -1)));
          if (abierta && antes === 0) this.sfx('reja');
          // no se cierra encima de alguien
          if (!abierta && e.abre < 16 && !e.solido && this.dist(e, this.jug) < 14) e.abre = 16;
          e.solido = e.abre < 12;
          break;
        }
      }
    }
    this.actualizarCanales(false);
    this.ents = this.ents.filter((e) => e.vivo);
    this.centrarCamara();
    // puertas
    const j = this.jug;
    if (this.modo === 'juego' && j.suelo && j.est !== 'cae') {
      const i = Math.floor(j.y / T) * this.sala.an + Math.floor(j.x / T);
      const ch = this.puertaCelda.get(i);
      if (ch) {
        const dest = this.def.puertas?.[ch];
        if (!dest) throw new Error(`puerta ${ch} sin destino en ${this.def.id}`);
        const cond = this.def.bloqueo?.[ch];
        const pega = cond ? GUION.bloqueos[cond]?.(this) : null;
        if (pega) {
          j.x -= DX[j.dir] * 10; j.y -= DY[j.dir] * 10;
          const r = this.probar(j.x, j.y, j.rx, j.ry, j.z, j);
          if (r.blq) { j.x = j.seguro.x; j.y = j.seguro.y; }
          this.decir(pega);
        } else {
          const iguales = [...this.puertaCelda.entries()].filter(([, c]) => c === ch).map(([k]) => k);
          this.indicePuerta = iguales.indexOf(i);
          this.irA(dest[0], dest[1]);
        }
      }
    }
  }

  private actualizarCanales(inicial: boolean): void {
    const id = this.def.id;
    const fuentes: Record<string, { placas: boolean[]; pal: boolean[]; velas: boolean[] }> = {};
    const f = (c: string) => (fuentes[c] ??= { placas: [], pal: [], velas: [] });
    let enemigos = 0;
    for (const e of this.ents) {
      if (!e.vivo) continue;
      if (e.tipo === 'enemigo' || e.tipo === 'jefe') enemigos++;
      else if (e.tipo === 'placa') {
        let pisada = false;
        for (const o of this.ents) {
          if (!o.vivo || o === e) continue;
          if (o.tipo !== 'jugador' && o.tipo !== 'caja' && o.tipo !== 'enemigo') continue;
          if (Math.abs(o.x - e.x) < 8 && Math.abs(o.y - e.y) < 8 && Math.abs(o.z - e.z) < 4 && o.est !== 'desliza') { pisada = true; break; }
        }
        if (pisada && !e.pisada && !inicial) this.sfx('placa');
        e.pisada = pisada;
        f(e.canal).placas.push(pisada);
      } else if (e.tipo === 'palanca') f(e.canal).pal.push(e.activo);
      else if (e.tipo === 'vela' && e.canal) f(e.canal).velas.push(e.encendida);
    }
    const antes = this.canales;
    const ahora: Record<string, boolean> = {};
    for (const [c, s] of Object.entries(fuentes)) {
      let on = s.placas.every(Boolean) && s.velas.every(Boolean);
      if (s.pal.length) on = on && s.pal.some(Boolean);
      const fijo = this.ban(`${id}:~${c}`);
      if (on && !fijo && !s.placas.length && !s.pal.length) { this.pon(`${id}:~${c}`); if (!inicial) this.sfx('secreto'); }
      ahora[c] = on || fijo;
    }
    const despejado = enemigos === 0 || this.ban(`${id}:~!`);
    if (enemigos === 0 && !this.ban(`${id}:~!`) && this.ents.some((e) => e.tipo === 'reja' && e.canal === '!')) {
      this.pon(`${id}:~!`);
      if (!inicial) this.sfx('secreto');
    }
    ahora['!'] = despejado;
    for (const c of Object.keys(ahora)) if (ahora[c] && !antes[c] && !inicial && c !== '!' && (fuentes[c]?.placas.length || fuentes[c]?.pal.length)) this.sfx('reja');
    this.canales = ahora;
    // puentes retráctiles y velas ya resueltas
    for (const e of this.ents) {
      if (e.tipo === 'puente') {
        const on = !!ahora[e.canal];
        if (on !== e.puesto) { e.puesto = on; this.sala.terr[e.fila * this.sala.an + e.col] = on ? TERR.PUENTE : e.orig; }
      } else if (inicial && e.tipo === 'vela' && e.canal && this.ban(`${id}:~${e.canal}`)) e.encendida = true;
      else if (inicial && e.tipo === 'reja' && ahora[e.canal]) { e.abre = 16; e.solido = false; }
    }
  }

  private actPlataforma(e: Ent): void {
    if (e.espera > 0) { e.espera--; return; }
    const tx = e.ida ? e.x1 : e.x0, ty = e.ida ? e.y1 : e.y0;
    const dx = Math.sign(tx - e.x) * 0.5, dy = Math.sign(ty - e.y) * 0.5;
    e.x += dx; e.y += dy;
    const j = this.jug;
    if (j.apoyo === e && j.suelo) { j.x += dx; j.y += dy; }
    if (Math.abs(tx - e.x) < 0.5 && Math.abs(ty - e.y) < 0.5) { e.x = tx; e.y = ty; e.ida = !e.ida; e.espera = 45; }
  }

  private actCaja(e: Ent): void {
    const s = this.sala;
    if (e.est === 'desliza') {
      e.x += e.mx; e.y += e.my;
      if (--e.t <= 0) {
        e.col += e.mx; e.fila += e.my;
        e.x = e.col * T + 8; e.y = e.fila * T + 8;
        e.est = s.suelo(e.col, e.fila) < e.z ? 'cae' : 'quieta';
      }
    } else if (e.est === 'cae') {
      e.vz -= G; e.z += e.vz;
      const h = s.suelo(e.col, e.fila);
      if (e.z <= Math.max(h, -16)) {
        const t = s.tipo(e.col, e.fila);
        if (t === TERR.FOSO || t === TERR.AGUA) {
          s.terr[e.fila * s.an + e.col] = TERR.RELLENO;
          e.vivo = false;
          this.sfx(t === TERR.AGUA ? 'agua' : 'golpazo');
          this.fx('humo', e.x, e.y, 4, 6, 4);
        } else { e.z = h; e.vz = 0; e.est = 'quieta'; this.sfx('golpazo'); this.temblor = 4; }
      }
    }
  }

  /** Intenta empujar una caja una casilla. */
  empujar(c: Ent, d: Dir): boolean {
    if (c.est !== 'quieta') return false;
    const s = this.sala;
    const nc = c.col + DX[d], nf = c.fila + DY[d];
    const h = s.suelo(nc, nf);
    if (h >= SOLIDO_Z || h > c.z + 0.5) return false;
    const x = nc * T + 8, y = nf * T + 8;
    for (const o of this.ents) {
      if (o === c || !o.vivo || o.tipo === 'jugador' || o.tipo === 'fx' || o.tipo === 'placa' || o.tipo === 'puente' || o.tipo === 'recoge') continue;
      if (Math.abs(o.x - x) < o.rx + 8 && Math.abs(o.y - y) < o.ry + 8 && o.z + Math.max(o.alto, 12) > c.z) return false;
    }
    c.est = 'desliza'; c.mx = DX[d]; c.my = DY[d]; c.t = T;
    this.sfx('empuja');
    return true;
  }

  private actTraca(e: Ent): void {
    this.fisica(e);
    if (e.t % 8 === 0) this.sfx('mecha');
    if (--e.t <= 0) { e.vivo = false; this.explosion(e.x, e.y, e.z, 30, 5, true); }
  }

  explosion(x: number, y: number, z: number, radio: number, dano: number, deJugador: boolean): void {
    this.sfx('explosion');
    this.temblor = 10; this.destello = 4;
    this.fx('humo', x, y, z + 6, 6, 4, { grande: true });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      this.fx('chispa', x + Math.cos(a) * 10, y + Math.sin(a) * 8, z + 6, 4, 4, { vx: Math.cos(a) * 1.2, vy: Math.sin(a) * 1.0 });
    }
    for (const o of this.ents) {
      if (!o.vivo) continue;
      const d = Math.hypot(o.x - x, o.y - y);
      if (d > radio + o.rx || Math.abs(o.z - z) > 24) continue;
      if (o.tipo === 'grieta') { o.vivo = false; this.pon(`${this.def.id}:g${o.i}`); this.fx('trozos', o.x, o.y, o.z + 8, 3, 6); this.sfx('secreto'); }
      else if (o.tipo === 'vela' && !o.encendida) { o.encendida = true; this.sfx('fuego'); }
      else if (o.tipo === 'barricada' && !o.arde) o.arde = 50;
      else if (o.tipo === 'jugador') { if (d < radio - 8) this.danarJugador(deJugador ? 1 : dano, x, y); }
      else if (deJugador) this.golpear(o, dano, x, y, 4, 'explosion');
    }
  }

  private actRecoge(e: Ent): void {
    if (e.vz || e.z > e.base) { e.vz -= G; e.z += e.vz; if (e.z <= e.base) { e.z = e.base; e.vz = 0; } }
    if (e.vx || e.vy) { this.mover(e, e.vx, e.vy, true); e.vx *= 0.9; e.vy *= 0.9; if (Math.abs(e.vx) + Math.abs(e.vy) < 0.05) e.vx = e.vy = 0; }
    if (e.caduca !== undefined && --e.caduca <= 0) { e.vivo = false; return; }
    e.t++;
    const j = this.jug;
    if (e.t < 12 || this.dist(e, j) > 11 || Math.abs(e.z - j.z) > 14) return;
    const p = this.p;
    if (e.que === 'moneda') { p.dinero += e.valor; this.sfx('moneda'); }
    else if (e.que === 'vida') {
      if (p.vida >= p.vidaMax) return;
      p.vida = Math.min(p.vidaMax, p.vida + 2); this.sfx('cura');
    } else if (e.que === 'llave') { this.pon(e.clave); this.decir(this.dar('llave')); }
    e.vivo = false;
  }

  soltar(x: number, y: number, z: number, que: string, valor = 0): void {
    const a = this.azar() * Math.PI * 2;
    this.crear('recoge', x, y, { z: z + 4, base: z, vz: 2, vx: Math.cos(a) * 0.7, vy: Math.sin(a) * 0.7, que, valor, caduca: 600, rx: 3, ry: 3 });
  }

  botin(e: Ent, min: number, max: number): void {
    const n = min + Math.floor(this.azar() * (max - min + 1));
    for (let i = 0; i < n; i++) this.soltar(e.x, e.y, e.z, 'moneda', this.azar() < 0.25 ? 100 : 25);
    if (this.p.vida < this.p.vidaMax && this.azar() < 0.3) this.soltar(e.x, e.y, e.z, 'vida');
  }

  // ───────────────────────── combate ─────────────────────────

  danarJugador(n: number, ox: number, oy: number, fuerza = 2.6): boolean {
    const j = this.jug;
    if (j.inv > 0 || j.est === 'capote' || j.est === 'cae' || j.est === 'muerto' || this.modo !== 'juego') return false;
    this.p.vida -= n;
    j.inv = 70; j.est = 'herido'; j.t = 14; j.combo = 0; j.carga = 0;
    const d = Math.hypot(j.x - ox, j.y - oy) || 1;
    j.kx = ((j.x - ox) / d) * fuerza; j.ky = ((j.y - oy) / d) * fuerza;
    this.sfx('dano'); this.temblor = 6;
    this.p.duende = Math.min(100, this.p.duende + 5);
    if (this.p.vida <= 0) this.morir();
    return true;
  }

  private morir(): void {
    const j = this.jug;
    this.p.vida = 0; this.p.muertes++;
    j.est = 'muerto'; j.t = 90;
    this.sfx('muerte');
    this.musica = '';
  }

  /** Aplica un golpe a cualquier cosa golpeable. Devuelve true si le hizo algo. */
  golpear(o: Ent, dano: number, ox: number, oy: number, fuerza: number, clase: string): boolean {
    if (!o.vivo) return false;
    if (o.tipo === 'barril') {
      if (clase === 'fuego') return false;
      o.vivo = false; this.sfx('rompe'); this.fx('trozos', o.x, o.y, o.z + 6, 3, 5);
      this.botin(o, 0, 2);
      return true;
    }
    if (o.tipo === 'palanca') {
      if (clase === 'fuego') return false;
      this.accionarPalanca(o);
      return true;
    }
    if (o.tipo === 'vela') {
      if ((clase === 'fuego' || clase === 'explosion') && !o.encendida) { o.encendida = true; this.sfx('fuego'); return true; }
      return false;
    }
    if (o.tipo === 'barricada') {
      if (clase === 'fuego' && !o.arde) { o.arde = 50; this.sfx('fuego'); return true; }
      if (clase === 'golpe') this.sfx('clang');
      return false;
    }
    if (o.tipo !== 'enemigo' && o.tipo !== 'jefe') return false;
    if (o.tipo === 'jefe' && (o.est === 'vencido' || o.est === 'cambio' || o.est === 'espera' || o.est === 'presenta')) return false;
    const def = o.tipo === 'jefe' ? JEFES[o.nom] : ENEMIGOS[o.cls];
    const mult = def.recibe ? def.recibe(this, o, clase, ox, oy) : 1;
    o.alerta = true;
    if (mult <= 0) {
      this.sfx('clang');
      this.fx('chispa', (o.x + ox) / 2, (o.y + oy) / 2, o.z + 12, 4, 3);
      return false;
    }
    o.vida -= Math.max(1, Math.round(dano * mult));
    o.flash = 10;
    const d = Math.hypot(o.x - ox, o.y - oy) || 1;
    const k = def.pesado ? fuerza * 0.25 : fuerza;
    o.kx = ((o.x - ox) / d) * k; o.ky = ((o.y - oy) / d) * k;
    if (!def.pesado && o.tipo === 'enemigo') { o.est = 'golpeado'; o.t = 14; }
    this.sfx(clase === 'fuego' ? 'fuego' : 'golpe');
    this.fx('chispa', o.x, o.y, o.z + 12, 4, 3);
    if (clase !== 'fuego' && clase !== 'explosion') { this.pausaGolpe = clase === 'golpe' ? 2 : 5; this.p.duende = Math.min(100, this.p.duende + (clase === 'remate' ? 0 : 7)); }
    if (o.vida <= 0) this.matar(o);
    return true;
  }

  matar(o: Ent): void {
    if (o.tipo === 'jefe') {
      const dj = JEFES[o.nom];
      if (dj.vida2 && o.fase === 1) {
        o.fase = 2; o.vida = o.vidaMax = dj.vida2; o.est = 'cambio'; o.t = 0;
        this.sfx('jefecae'); this.temblor = 14;
        for (const e of this.ents) if (e.tipo === 'proy' || e.tipo === 'enemigo') { e.vivo = false; this.fx('humo', e.x, e.y, e.z + 8, 6, 3); }
        return;
      }
      o.est = 'vencido'; o.t = 0; o.vida = 0;
      this.sfx('jefecae'); this.temblor = 20; this.destello = 8;
      for (const e of this.ents) if (e.tipo === 'proy' || e.tipo === 'enemigo') { e.vivo = false; this.fx('humo', e.x, e.y, e.z + 8, 6, 3); }
      return;
    }
    o.vivo = false;
    this.sfx('cae');
    this.fx('humo', o.x, o.y, o.z + 8, 6, 3);
    const d = ENEMIGOS[o.cls];
    this.botin(o, d.botin[0], d.botin[1]);
  }

  accionarPalanca(o: Ent): void {
    const dur = this.def.tiempo?.[o.canal];
    if (dur) { o.activo = true; o.cuenta = dur; }
    else { o.activo = !o.activo; if (o.activo) this.pon(`${this.def.id}:L${o.i}`); else delete this.p.banderas[`${this.def.id}:L${o.i}`]; }
    this.sfx('palanca');
  }

  // ───────────────────────── jugador ─────────────────────────

  private reaparecer(): void {
    const j = this.jug;
    j.x = j.seguro.x; j.y = j.seguro.y; j.z = j.seguro.z; j.vz = 0;
    j.est = 'normal'; j.inv = 0; j.suelo = true;
    if (!this.danarJugador(2, j.x, j.y, 0)) { this.p.vida -= 2; if (this.p.vida <= 0) this.morir(); }
    if (j.est !== 'muerto') { j.kx = j.ky = 0; j.t = 4; j.inv = 80; }
  }

  private actJugador(en: Entrada): void {
    const j = this.jug, p = this.p, s = this.sala;
    if (j.inv > 0) j.inv--;
    if (j.enfria > 0) j.enfria--;
    if (j.flash > 0) j.flash--;
    if (j.est === 'muerto') {
      if (--j.t <= 0) { this.modo = 'muerte'; this.menu = { sel: 0, ops: ['Volver a intentarlo', 'Salir al título'] }; this.musica = 'muerte'; }
      return;
    }
    if (j.est === 'cae') { if (--j.t <= 0) this.reaparecer(); return; }
    if (j.est === 'herido') {
      this.mover(j, j.kx, j.ky); j.kx *= 0.85; j.ky *= 0.85;
      this.fisica(j);
      this.comprobarCaida();
      if (--j.t <= 0 && j.est === 'herido') j.est = 'normal';
      return;
    }
    if (j.est === 'capote') {
      this.mover(j, DX[j.dir] * 3, DY[j.dir] * 3);
      if (this.tic % 3 === 0) this.fx('estela', j.x, j.y, j.z, 3, 3, { dir: j.dir });
      if (--j.t <= 0) { j.est = 'normal'; j.vz = Math.min(j.vz, 0); j.enfria = 26; }
      return;
    }
    let mx = en.dx, my = en.dy;
    const l = Math.hypot(mx, my);
    if (l > 1) { mx /= l; my /= l; }
    let vel = VEL;
    const arma = this.arma();

    // ── ataque ──
    if (j.est === 'ataque') {
      j.t++;
      vel = 0.35;
      if (j.t === 1 && j.combo === 3) this.mover(j, DX[j.dir] * 5, DY[j.dir] * 5, true);
      if (en.p.a && j.t >= 5) j.sig = true;
      if (j.t >= 4 && j.t <= 11) this.barrido(j.x + DX[j.dir] * 13, j.y + DY[j.dir] * 11, 15, arma * (j.combo === 3 ? 1.5 : 1), j.combo === 3 ? 4 : 2.4, 'golpe');
      if (j.t >= 17) {
        if (j.sig && j.combo < 3) { j.combo++; j.t = 0; j.sig = false; j.dados.clear(); this.sfx('zas'); }
        else if (en.m.a) { j.est = 'carga'; j.carga = 0; }
        else { j.est = 'normal'; j.combo = 0; }
      }
    } else if (j.est === 'carga') {
      vel = 0.6;
      if (en.m.a) { j.carga++; if (j.carga === 36) { this.sfx('listo'); j.flash = 8; } }
      else if (j.carga >= 36) {
        j.est = 'giro'; j.t = 0; j.dados.clear(); j.dir0 = j.dir;
        j.remate = p.duende >= 100;
        if (j.remate) { p.duende = 0; this.destello = 6; this.temblor = 12; this.sfx('remate'); } else this.sfx('giro');
      } else { j.est = 'normal'; j.combo = 0; }
    } else if (j.est === 'giro') {
      j.t++;
      vel = 0.5;
      j.dir = ((j.dir0 + Math.floor(j.t / 4)) % 4) as Dir;
      if (j.t >= 2 && j.t <= 16) this.barrido(j.x, j.y, j.remate ? 46 : 27, arma * (j.remate ? 4 : 2), 5, j.remate ? 'remate' : 'giro');
      if (j.t >= 22) { j.est = 'normal'; j.combo = 0; j.dir = j.dir0; }
    }

    // ── movimiento ──
    const eraSuelo = j.suelo;
    if (mx || my) {
      if (j.est === 'normal' || j.est === 'carga') {
        const actual = DX[j.dir] * mx + DY[j.dir] * my;
        if (actual < 0.5) j.dir = (Math.abs(mx) > Math.abs(my) ? (mx > 0 ? 1 : 3) : my > 0 ? 0 : 2) as Dir;
      }
      const choque = this.mover(j, mx * vel, my * vel);
      j.anda += vel;
      // empujar cajas y abrir cerrojos
      const cardinal = Math.abs(mx) > 0.7 ? (mx > 0 ? 1 : 3) : Math.abs(my) > 0.7 ? (my > 0 ? 0 : 2) : -1;
      if (choque && cardinal >= 0 && j.suelo && j.est === 'normal') {
        const px = j.x + DX[cardinal] * (j.rx + 3), py = j.y + DY[cardinal] * (j.ry + 3);
        const o = this.ents.find((e) => e.vivo && e.solido && (e.tipo === 'caja' || e.tipo === 'cerrojo') && Math.abs(e.x - px) < e.rx && Math.abs(e.y - py) < e.ry && Math.abs(e.z - j.z) < 3);
        if (o?.tipo === 'caja') {
          if (++j.empuje >= 14) { j.empuje = 0; this.empujar(o, cardinal as Dir); }
        } else if (o?.tipo === 'cerrojo') {
          if ((p.llaves[this.def.zona] ?? 0) > 0) {
            p.llaves[this.def.zona]--; o.vivo = false; this.pon(`${this.def.id}:K${o.i}`); this.sfx('cerrojo');
            this.fx('humo', o.x, o.y, o.z + 8, 6, 3);
          } else if (++j.empuje === 30) this.decir(['Está cerrado con llave.']);
        } else j.empuje = 0;
      } else j.empuje = 0;
    } else { j.empuje = 0; j.anda = 0; }

    // ── salto ──
    if (en.p.b && (j.suelo || j.coyote > 0) && j.est !== 'giro') {
      j.vz = VSALTO; j.suelo = false; j.coyote = 0; this.sfx('salto');
    }
    if (!en.m.b && j.vz > 1.3) j.vz = 1.3;
    const aterriza = this.fisica(j);
    if (aterriza && j.vz === 0) { this.sfx('paso'); }
    if (j.suelo) { j.coyote = 5; j.capoteListo = true; } else if (j.coyote > 0) j.coyote--;
    void eraSuelo;

    // ── cinta transportadora ──
    if (j.suelo && !j.apoyo) {
      const t = s.tipoEn(j.x, j.y);
      if (t >= TERR.CINTA_S && t <= TERR.CINTA_O) { const d = t - TERR.CINTA_S; this.mover(j, DX[d] * 0.7, DY[d] * 0.7); }
    }

    // ── sitio seguro al que volver tras una caída ──
    if (j.suelo && !j.apoyo && this.tic % 4 === 0) {
      const t = s.tipoEn(j.x, j.y);
      if ((t === TERR.SUELO || t === TERR.ALT || t === TERR.TER) && Math.abs(s.suelo(Math.floor(j.x / T), Math.floor(j.y / T)) - j.z) < 1) {
        const c = Math.floor(j.x / T) * T + 8, f = Math.floor(j.y / T) * T + 8;
        j.seguro = { x: c, y: f, z: j.z };
      }
    }
    if (this.comprobarCaida()) return;

    // ── acción: hablar, abrir o golpear ──
    if (en.p.a && j.est === 'normal') {
      const cerca = (k: number, soloPnj: boolean) => {
        const px = j.x + DX[j.dir] * 12 * k, py = j.y + DY[j.dir] * 10 * k;
        return this.ents.find((e) => e.vivo && e.inter && (!soloPnj || e.tipo === 'pnj') && Math.abs(e.x - px) < e.rx + 5 && Math.abs(e.y - py) < e.ry + 6 && Math.abs(e.z - j.z) < 12);
      };
      // a los personajes se les puede hablar por encima de un mostrador
      const o = cerca(1, false) ?? cerca(2.6, true);
      if (o && j.suelo) this.interactuar(o);
      else if (arma) { j.est = 'ataque'; j.t = 0; j.combo = 1; j.sig = false; j.dados.clear(); this.sfx('zas'); }
    }
    if (this.modo !== 'juego') return;

    // ── objeto ──
    if (en.p.d) { const n = this.objetosTenidos().length; if (n > 1) { p.objeto = (p.objeto + 1) % n; this.sfx('cursor'); } }
    if (en.p.c && (j.est === 'normal' || j.est === 'carga')) this.usarObjeto();
  }

  private comprobarCaida(): boolean {
    const j = this.jug;
    if (j.z > -9) return false;
    const agua = this.sala.tipoEn(j.x, j.y) === TERR.AGUA;
    j.est = 'cae'; j.t = 34; j.agua = agua;
    this.sfx(agua ? 'agua' : 'caida');
    if (agua) this.fx('humo', j.x, j.y, -4, 6, 3);
    return true;
  }

  /** Golpe en área alrededor de (x, y): cada objetivo solo lo recibe una vez por ataque. */
  private barrido(x: number, y: number, radio: number, dano: number, fuerza: number, clase: string): void {
    const j = this.jug;
    for (const o of this.ents) {
      if (!o.vivo || o === j || j.dados.has(o.id)) continue;
      if (o.tipo !== 'enemigo' && o.tipo !== 'jefe' && !o.golpeable && o.tipo !== 'barricada') continue;
      if (Math.hypot(o.x - x, o.y - y) > radio + o.rx || Math.abs(o.z - j.z) > 18) continue;
      j.dados.add(o.id);
      this.golpear(o, dano, j.x, j.y, fuerza, clase);
    }
  }

  private interactuar(o: Ent): void {
    const j = this.jug;
    switch (o.tipo) {
      case 'pnj': {
        const d = Math.abs(j.x - o.x) > Math.abs(j.y - o.y) ? (j.x > o.x ? 1 : 3) : j.y > o.y ? 0 : 2;
        o.dir = d as Dir;
        this.decir(PNJS[o.nom].habla(this));
        break;
      }
      case 'marca': this.decir(MARCAS[o.nom].usar(this, o)); break;
      case 'cartel': this.decir([o.texto]); break;
      case 'cabina':
        this.p.vida = this.p.vidaMax;
        this.guardar();
        this.sfx('guardar');
        this.decir(['Descuelgas, marcas el número del bar y le cuentas a Maruja por dónde andas. Partida guardada y fuerzas recuperadas.']);
        break;
      case 'cofre':
        if (o.abierto) { this.decir(['Está vacío.']); break; }
        o.abierto = true;
        this.pon(`${this.def.id}:C${o.i}`);
        this.decir(this.dar(o.que));
        break;
      case 'palanca': this.accionarPalanca(o); break;
    }
  }

  private usarObjeto(): void {
    const j = this.jug;
    const obj = this.objetoActual();
    if (!obj) return;
    if (obj === 'tracas') {
      if (this.ents.some((e) => e.tipo === 'traca')) return;
      const x = j.x + DX[j.dir] * 10, y = j.y + DY[j.dir] * 8;
      const libre = !this.probar(x, y, 3, 3, j.z, j).blq;
      this.crear('traca', libre ? x : j.x, libre ? y : j.y, { z: j.z, t: 80, rx: 3, ry: 3 });
      this.sfx('mecha');
    } else if (obj === 'mechero') {
      if (j.enfria > 0) return;
      j.enfria = 28;
      const x = j.x + DX[j.dir] * 14, y = j.y + DY[j.dir] * 12;
      this.fx('fuego', x, y, j.z + 4, 6, 4);
      this.sfx('fuego');
      for (const o of this.ents) {
        if (!o.vivo || o === j) continue;
        if (Math.hypot(o.x - x, o.y - y) < 14 + o.rx && Math.abs(o.z - j.z) < 18) this.golpear(o, 1, j.x, j.y, 1, 'fuego');
      }
    } else if (obj === 'capote') {
      if (!j.capoteListo || j.enfria > 0) return;
      j.capoteListo = false;
      j.est = 'capote'; j.t = 16; j.vz = 0; j.combo = 0;
      j.inv = Math.max(j.inv, 20);
      this.sfx('capote');
    }
  }
}
