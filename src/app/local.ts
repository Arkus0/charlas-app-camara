// Partida contra la IA en el propio móvil: el estado se guarda en el navegador y la IA piensa en un Web Worker.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { decidirIA, type Nivel } from '../ia/bot';
import TrabajadorIA from '../ia/trabajador?worker&inline';
import type { Bando } from '../motor/base';
import { clonar, crearPartida, responder as responderMotor } from '../motor/motor';
import type { Estado, Respuesta } from '../motor/tipos';
import { vistaDe, type Vista } from '../motor/vista';

export interface ConfigLocal {
  humano: Bando;
  nivel: Nivel;
}

export interface Guardada {
  version: 5;
  config: ConfigLocal;
  estado: Estado;
  /** último suceso que el jugador ya ha visto contado */
  visto: number;
}

const CLAVE = '176-partida-v5';

export function cargarLocal(): Guardada | null {
  try {
    const s = localStorage.getItem(CLAVE);
    if (!s) return null;
    const g = JSON.parse(s) as Guardada;
    return g?.version === 5 && g.estado?.version === 5 ? g : null;
  } catch {
    return null;
  }
}

export function guardarLocal(g: Guardada | null) {
  try {
    if (g) localStorage.setItem(CLAVE, JSON.stringify(g));
    else localStorage.removeItem(CLAVE);
  } catch {
    /* sin almacenamiento: la partida sigue en memoria */
  }
}

export function nuevaLocal(config: ConfigLocal): Guardada {
  return { version: 5, config, estado: crearPartida((Math.random() * 2 ** 31) | 0), visto: 0 };
}

// —— la IA en segundo plano ——
let trabajador: Worker | null = null;
let siguiente = 1;
const esperando = new Map<number, { ok: (r: Respuesta) => void; ko: (e: Error) => void }>();

function obtenerTrabajador(): Worker | null {
  if (trabajador) return trabajador;
  try {
    trabajador = new TrabajadorIA();
    trabajador.onmessage = (ev: MessageEvent<{ id: number; respuesta?: Respuesta; error?: string }>) => {
      const p = esperando.get(ev.data.id);
      if (!p) return;
      esperando.delete(ev.data.id);
      if (ev.data.respuesta) p.ok(ev.data.respuesta);
      else p.ko(new Error(ev.data.error ?? 'Error de la IA'));
    };
    trabajador.onerror = () => { trabajador = null; };
  } catch {
    trabajador = null;
  }
  return trabajador;
}

/** Pide una jugada a la IA (en el Worker si se puede; si no, en el hilo principal). */
export function pedirIA(e: Estado, nivel: Nivel, semilla: number): Promise<Respuesta> {
  // la crónica no le hace falta y pesa
  const ligero: Estado = { ...e, cronica: { seq: 0, log: [], sucesos: [], historia: [] } };
  const w = obtenerTrabajador();
  if (!w) return new Promise((ok) => setTimeout(() => ok(decidirIA(ligero, nivel, semilla)), 0));
  const id = siguiente++;
  return new Promise((ok, ko) => {
    esperando.set(id, { ok, ko });
    w.postMessage({ id, estado: ligero, nivel, semilla });
  }).catch(() => decidirIA(ligero, nivel, semilla)) as Promise<Respuesta>;
}

const rapido = () => typeof location !== 'undefined' && location.hash.includes('rapido');

export interface PartidaEnCurso {
  vista: Vista;
  responder: (r: Respuesta) => void;
  pensando: boolean;
  error: string | null;
  limpiarError: () => void;
  visto: number;
  marcarVisto: (seq: number) => void;
}

/** La partida local: aplica las jugadas del jugador, hace jugar a la IA y guarda cada cambio. */
export function usePartidaLocal(inicial: Guardada): PartidaEnCurso {
  const [g, setG] = useState(inicial);
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { humano, nivel } = g.config;
  const vista = useMemo(() => vistaDe(g.estado, humano), [g.estado, humano]);
  const turnoIA = useRef(0);

  useEffect(() => { guardarLocal(g); }, [g]);

  const aplicar = useCallback((r: Respuesta) => {
    setG((prev) => {
      try {
        const n = clonar(prev.estado);
        responderMotor(n, r);
        setError(null);
        return { ...prev, estado: n };
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return prev;
      }
    });
  }, []);

  // le toca a la IA
  useEffect(() => {
    const d = g.estado.pendiente;
    if (!d || g.estado.ganador || d.bando === humano) {
      setPensando(false);
      return;
    }
    const turno = ++turnoIA.current;
    setPensando(true);
    const t0 = performance.now();
    const minimo = rapido() ? 0 : d.tipo === 'accion' ? 700 : 450;
    let vivo = true;
    pedirIA(g.estado, nivel, (g.estado.n + 1) * 7919 + (g.estado.rng & 0xffff)).then((r) => {
      const espera = Math.max(0, minimo - (performance.now() - t0));
      setTimeout(() => {
        if (!vivo || turno !== turnoIA.current) return;
        aplicar(r);
      }, espera);
    }, (err) => setError(String(err)));
    return () => { vivo = false; };
  }, [g.estado, humano, nivel, aplicar]);

  const marcarVisto = useCallback((seq: number) => setG((prev) => (seq > prev.visto ? { ...prev, visto: seq } : prev)), []);

  return { vista, responder: aplicar, pensando, error, limpiarError: () => setError(null), visto: g.visto, marcarVisto };
}
