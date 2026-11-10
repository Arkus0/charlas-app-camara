// Sonido sintetizado con WebAudio: instrumentos de onda con envolvente y eco (al estilo del chip de la SNES),
// un secuenciador para la música y efectos hechos con osciladores y ruido.
import { PISTAS, type Pista } from '../datos/musica';

const NOTA: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
function frec(n: string): number {
  const m = /^([a-g])(#?)(\d)$/.exec(n);
  if (!m) return 0;
  const midi = NOTA[m[1]] + (m[2] ? 1 : 0) + (+m[3] + 1) * 12;
  return 440 * 2 ** ((midi - 69) / 12);
}

interface Evento { paso: number; nota: string; dur: number }
function leer(notas: string): { eventos: Evento[]; largo: number } {
  const fichas = notas.split(/\s+/).filter((f) => f && f !== '|');
  const eventos: Evento[] = [];
  fichas.forEach((f, i) => {
    if (f === '-') { if (eventos.length) eventos[eventos.length - 1].dur++; }
    else if (f !== '.') eventos.push({ paso: i, nota: f, dur: 1 });
  });
  return { eventos, largo: fichas.length };
}

type Op = ['t', OscillatorType, number, number, number, number, number?] | ['r', number, number, BiquadFilterType, number, number, number?];
// ['t', onda, frec inicial, frec final, duración, volumen, retardo]  ·  ['r', duración, volumen, filtro, frec inicial, frec final, retardo]
const EFECTOS: Record<string, Op[]> = {
  zas: [['r', 0.12, 0.35, 'bandpass', 2400, 600]],
  golpe: [['r', 0.08, 0.5, 'lowpass', 1800, 300], ['t', 'square', 180, 60, 0.1, 0.35]],
  dano: [['t', 'square', 420, 110, 0.22, 0.4], ['r', 0.1, 0.3, 'lowpass', 1200, 300]],
  salto: [['t', 'square', 260, 620, 0.12, 0.22]],
  paso: [['r', 0.04, 0.18, 'lowpass', 500, 200]],
  moneda: [['t', 'square', 1320, 1320, 0.06, 0.25], ['t', 'square', 1760, 1760, 0.14, 0.25, 0.06]],
  cofre: [['t', 'triangle', 523, 523, 0.09, 0.4], ['t', 'triangle', 659, 659, 0.09, 0.4, 0.09], ['t', 'triangle', 784, 784, 0.18, 0.4, 0.18]],
  fanfarria: [['t', 'square', 523, 523, 0.1, 0.3], ['t', 'square', 659, 659, 0.1, 0.3, 0.1], ['t', 'square', 784, 784, 0.1, 0.3, 0.2], ['t', 'square', 1047, 1047, 0.4, 0.3, 0.3], ['t', 'triangle', 262, 262, 0.7, 0.4]],
  letra: [['t', 'square', 880, 880, 0.02, 0.07]],
  cursor: [['t', 'square', 660, 660, 0.04, 0.18]],
  ok: [['t', 'square', 880, 1320, 0.07, 0.2]],
  no: [['t', 'sawtooth', 140, 110, 0.18, 0.3]],
  puerta: [['r', 0.3, 0.25, 'lowpass', 300, 1400]],
  reja: [['t', 'sawtooth', 90, 180, 0.3, 0.25], ['r', 0.3, 0.2, 'bandpass', 900, 2200]],
  placa: [['t', 'square', 330, 220, 0.06, 0.3]],
  palanca: [['t', 'square', 200, 120, 0.07, 0.35], ['r', 0.05, 0.3, 'highpass', 2000, 2000]],
  secreto: [['t', 'triangle', 784, 784, 0.1, 0.35], ['t', 'triangle', 740, 740, 0.1, 0.35, 0.1], ['t', 'triangle', 622, 622, 0.1, 0.35, 0.2], ['t', 'triangle', 440, 440, 0.1, 0.35, 0.3], ['t', 'triangle', 415, 415, 0.1, 0.35, 0.4], ['t', 'triangle', 659, 659, 0.1, 0.35, 0.5], ['t', 'triangle', 831, 831, 0.1, 0.35, 0.6], ['t', 'triangle', 1047, 1047, 0.3, 0.35, 0.7]],
  explosion: [['r', 0.6, 0.8, 'lowpass', 2400, 80], ['t', 'sine', 120, 30, 0.5, 0.7]],
  mecha: [['r', 0.05, 0.12, 'highpass', 5000, 7000]],
  fuego: [['r', 0.3, 0.3, 'bandpass', 700, 2600]],
  agua: [['r', 0.35, 0.45, 'bandpass', 2200, 400], ['t', 'sine', 500, 160, 0.2, 0.2]],
  caida: [['t', 'triangle', 900, 120, 0.5, 0.35]],
  cura: [['t', 'triangle', 660, 660, 0.08, 0.3], ['t', 'triangle', 880, 880, 0.08, 0.3, 0.08], ['t', 'triangle', 1320, 1320, 0.2, 0.3, 0.16]],
  guardar: [['t', 'triangle', 523, 523, 0.12, 0.35], ['t', 'triangle', 784, 784, 0.12, 0.35, 0.12], ['t', 'triangle', 1047, 1047, 0.3, 0.35, 0.24]],
  cerrojo: [['t', 'square', 150, 300, 0.1, 0.35], ['r', 0.12, 0.3, 'highpass', 3000, 3000, 0.08]],
  empuja: [['r', 0.25, 0.3, 'lowpass', 260, 180]],
  golpazo: [['r', 0.3, 0.7, 'lowpass', 900, 70], ['t', 'sine', 90, 35, 0.3, 0.7]],
  rompe: [['r', 0.18, 0.5, 'highpass', 2600, 5200]],
  lanza: [['r', 0.14, 0.28, 'bandpass', 800, 3200]],
  clang: [['t', 'square', 1900, 1700, 0.12, 0.25], ['t', 'square', 2830, 2600, 0.12, 0.2]],
  listo: [['t', 'triangle', 990, 1980, 0.16, 0.35]],
  giro: [['r', 0.32, 0.45, 'bandpass', 500, 3200]],
  remate: [['r', 0.6, 0.7, 'bandpass', 300, 4200], ['t', 'sawtooth', 110, 880, 0.5, 0.35], ['t', 'sine', 150, 40, 0.5, 0.6, 0.15]],
  capote: [['r', 0.2, 0.35, 'bandpass', 1400, 400]],
  ole: [['t', 'sawtooth', 330, 392, 0.12, 0.3], ['t', 'sawtooth', 392, 523, 0.3, 0.3, 0.12]],
  carga: [['t', 'sawtooth', 70, 110, 0.4, 0.4], ['r', 0.4, 0.3, 'lowpass', 300, 600]],
  ladra: [['t', 'sawtooth', 300, 180, 0.08, 0.4], ['t', 'sawtooth', 320, 170, 0.1, 0.4, 0.12]],
  cae: [['t', 'square', 520, 90, 0.3, 0.3], ['r', 0.2, 0.25, 'lowpass', 1500, 300]],
  jefecae: [['r', 1.2, 0.7, 'lowpass', 1800, 60], ['t', 'sawtooth', 220, 30, 1.2, 0.5]],
  jefe: [['t', 'sawtooth', 82, 82, 0.9, 0.5], ['t', 'sawtooth', 123, 123, 0.9, 0.4], ['r', 0.5, 0.4, 'lowpass', 400, 100]],
  aviso: [['t', 'square', 1175, 1175, 0.06, 0.25], ['t', 'square', 1568, 1568, 0.1, 0.25, 0.07]],
  apagon: [['t', 'triangle', 700, 60, 0.7, 0.4], ['r', 0.5, 0.3, 'lowpass', 2000, 100]],
  tiro: [['r', 0.16, 0.7, 'highpass', 900, 300], ['t', 'square', 240, 60, 0.1, 0.4]],
  tic: [['t', 'square', 1500, 1500, 0.02, 0.2]],
  muerte: [['t', 'triangle', 392, 98, 0.9, 0.45]],
};

export class Sonido {
  private ctx: AudioContext | null = null;
  private salida!: GainNode;
  private gMusica!: GainNode;
  private gEfectos!: GainNode;
  private eco!: DelayNode;
  private ruido!: AudioBuffer;
  private pista: Pista | null = null;
  private nombre = '';
  private canales: { inst: string; vol: number; eventos: Evento[]; largo: number }[] = [];
  private paso = 0;
  private sig = 0;
  private ultimo: Record<string, number> = {};
  silencio = false;

  /** Hay que llamarlo desde un gesto del jugador: los navegadores no dejan sonar antes. */
  iniciar(): void {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AC) return;
    const c = (this.ctx = new AC());
    this.salida = c.createGain(); this.salida.gain.value = 0.55; this.salida.connect(c.destination);
    this.gMusica = c.createGain(); this.gMusica.gain.value = 0.5; this.gMusica.connect(this.salida);
    this.gEfectos = c.createGain(); this.gEfectos.gain.value = 0.8; this.gEfectos.connect(this.salida);
    // eco con realimentación y filtro, como el de la SNES
    this.eco = c.createDelay(0.5); this.eco.delayTime.value = 0.19;
    const realim = c.createGain(); realim.gain.value = 0.32;
    const filtro = c.createBiquadFilter(); filtro.type = 'lowpass'; filtro.frequency.value = 2200;
    const vuelta = c.createGain(); vuelta.gain.value = 0.3;
    this.eco.connect(filtro); filtro.connect(realim); realim.connect(this.eco); filtro.connect(vuelta); vuelta.connect(this.gMusica);
    this.ruido = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = this.ruido.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const pendiente = this.nombre;
    this.nombre = '';
    this.musica(pendiente);
  }

  musica(nombre: string): void {
    if (nombre === this.nombre) return;
    this.nombre = nombre;
    const p = PISTAS[nombre] ?? null;
    this.pista = p;
    if (!this.ctx) return;
    this.canales = p ? p.canales.map((c) => ({ inst: c.inst, vol: c.vol, ...leer(c.notas) })) : [];
    this.paso = 0;
    this.sig = this.ctx.currentTime + 0.08;
  }

  /** Programa las notas que caen dentro de la próxima décima de segundo. */
  tic(): void {
    const c = this.ctx;
    if (!c || !this.pista || c.state !== 'running') return;
    const dur = 60 / this.pista.bpm / 4;
    const largo = Math.max(...this.canales.map((k) => k.largo));
    if (this.sig < c.currentTime - 0.3) this.sig = c.currentTime + 0.05;
    while (this.sig < c.currentTime + 0.12) {
      if (this.paso >= largo) { if (!this.pista.bucle) { this.pista = null; return; } this.paso = 0; }
      for (const k of this.canales) {
        const en = this.paso % k.largo;
        for (const e of k.eventos) if (e.paso === en) this.tocar(k.inst, e.nota, this.sig, e.dur * dur, k.vol);
      }
      this.paso++;
      this.sig += dur;
    }
  }

  private env(vol: number, t: number, ataque: number, caida: number, sosten = 0): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + ataque);
    if (sosten > 0) g.gain.setValueAtTime(vol, t + ataque + sosten);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ataque + sosten + caida);
    return g;
  }

  private osc(tipo: OscillatorType, f: number, t: number, fin: number, destino: AudioNode, desafina = 0): OscillatorNode {
    const o = this.ctx!.createOscillator();
    o.type = tipo; o.frequency.setValueAtTime(f, t); o.detune.value = desafina;
    o.connect(destino); o.start(t); o.stop(fin + 0.05);
    return o;
  }

  private golpeRuido(t: number, dur: number, vol: number, tipo: BiquadFilterType, f0: number, f1: number, destino: AudioNode): void {
    const c = this.ctx!;
    const s = c.createBufferSource(); s.buffer = this.ruido; s.loop = true;
    const f = c.createBiquadFilter(); f.type = tipo; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.env(vol, t, 0.004, dur);
    s.connect(f); f.connect(g); g.connect(destino);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  private tocar(inst: string, nota: string, t: number, dur: number, vol: number): void {
    const c = this.ctx!;
    const m = this.gMusica;
    if (inst === 'bateria') {
      if (nota === 'b') { const g = this.env(vol, t, 0.002, 0.16); const o = this.osc('sine', 130, t, t + 0.2, g); o.frequency.exponentialRampToValueAtTime(40, t + 0.14); g.connect(m); }
      else if (nota === 'c') this.golpeRuido(t, 0.13, vol * 0.8, 'bandpass', 1800, 900, m);
      else if (nota === 'p') { this.golpeRuido(t, 0.03, vol * 0.7, 'bandpass', 1500, 1300, m); this.golpeRuido(t + 0.018, 0.06, vol * 0.7, 'bandpass', 1400, 1100, m); }
      else if (nota === 'h') this.golpeRuido(t, 0.05, vol * 0.4, 'highpass', 6000, 6000, m);
      return;
    }
    const f = frec(nota);
    if (!f) return;
    const filtro = c.createBiquadFilter(); filtro.type = 'lowpass';
    let g: GainNode;
    switch (inst) {
      case 'guitarra':
        g = this.env(vol * 0.5, t, 0.004, Math.max(0.35, dur * 1.6));
        filtro.frequency.setValueAtTime(3200, t); filtro.frequency.exponentialRampToValueAtTime(500, t + 0.35);
        this.osc('sawtooth', f, t, t + dur * 1.6 + 0.4, filtro); this.osc('triangle', f * 2, t, t + dur * 1.6 + 0.4, filtro, 6);
        break;
      case 'koto':
        g = this.env(vol * 0.5, t, 0.002, Math.max(0.5, dur * 1.5));
        filtro.frequency.setValueAtTime(5200, t); filtro.frequency.exponentialRampToValueAtTime(700, t + 0.25); filtro.Q.value = 4;
        this.osc('square', f, t, t + dur * 1.5 + 0.5, filtro); this.osc('triangle', f, t, t + dur * 1.5 + 0.5, filtro, -8);
        break;
      case 'bajo':
        g = this.env(vol * 0.7, t, 0.006, Math.max(0.2, dur * 0.9));
        filtro.frequency.value = 700;
        this.osc('triangle', f, t, t + dur + 0.3, filtro); this.osc('sine', f / 2, t, t + dur + 0.3, filtro);
        break;
      case 'flauta': {
        g = this.env(vol * 0.42, t, 0.05, 0.14, Math.max(0.02, dur - 0.1));
        filtro.frequency.value = 2400;
        const o = this.osc('triangle', f, t, t + dur + 0.2, filtro);
        this.osc('sine', f * 2, t, t + dur + 0.2, filtro, 4);
        const lfo = c.createOscillator(); lfo.frequency.value = 5.5;
        const prof = c.createGain(); prof.gain.setValueAtTime(0, t); prof.gain.linearRampToValueAtTime(f * 0.012, t + 0.3);
        lfo.connect(prof); prof.connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.25);
        break;
      }
      default: // cuerdas
        g = this.env(vol * 0.35, t, 0.25, 0.4, Math.max(0.05, dur - 0.3));
        filtro.frequency.value = 1100;
        this.osc('sawtooth', f, t, t + dur + 0.5, filtro, -7); this.osc('sawtooth', f, t, t + dur + 0.5, filtro, 7);
    }
    filtro.connect(g); g.connect(m);
    if (inst !== 'bajo') g.connect(this.eco);
  }

  sfx(nombre: string): void {
    const c = this.ctx;
    const ops = EFECTOS[nombre];
    if (!c || !ops || c.state !== 'running') return;
    const ahora = c.currentTime;
    if (ahora - (this.ultimo[nombre] ?? -1) < 0.03) return;
    this.ultimo[nombre] = ahora;
    for (const op of ops) {
      if (op[0] === 't') {
        const [, tipo, f0, f1, dur, vol, ret = 0] = op;
        const t = ahora + ret;
        const g = this.env(vol * 0.6, t, 0.004, dur);
        const o = this.osc(tipo, f0, t, t + dur, g);
        if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
        g.connect(this.gEfectos);
      } else {
        const [, dur, vol, tipo, f0, f1, ret = 0] = op;
        this.golpeRuido(ahora + ret, dur, vol * 0.7, tipo, f0, f1, this.gEfectos);
      }
    }
  }
}
