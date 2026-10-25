// El tablero: el mapa real de las 52 circunscripciones con una insignia grande por zona, pensada para el pulgar.
// Al elegir una zona, el mapa se acerca a ella y muestra la presencia de cada provincia.
import { memo, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import mapa from '../../data/mapa.json';
import { PROVINCIAS, ZONAS } from '../../data/provincias';
import { controlDe } from '../../motor/electoral';
import type { ZonaId } from '../../motor/base';
import { ZONA_IDS } from '../../motor/reglas';
import { ZONA_CORTA } from '../textos';

const ANCHO = mapa.ancho;
const ALTO = mapa.alto;
const CENTROS = mapa.centros as unknown as Record<string, [number, number]>;
const RUTAS = mapa.provincias as Record<string, string>;
// pequeños ajustes para que los marcadores no se pisen donde las provincias son diminutas
const DESPLAZA: Record<string, [number, number]> = { '20': [10, -10], '01': [-6, 10], '48': [-14, -8], '51': [-8, 4], '52': [10, 4], '28': [0, 4] };
const pos = (id: string): [number, number] => {
  const [x, y] = CENTROS[id];
  const [dx, dy] = DESPLAZA[id] ?? [0, 0];
  return [x + dx, y + dy];
};

const CAPAS = import.meta.glob('../../assets/web/mapa/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const capa = (nombre: string) => Object.entries(CAPAS).find(([ruta]) => ruta.endsWith(`/${nombre}.webp`))?.[1];
const MAR = capa('mar');
const TIERRA = capa('tierra');

/** Dónde va la insignia de cada zona (coordenadas del lienzo), colocadas a mano para que no se pisen. */
const CENTRO_ZONA: Record<ZonaId, [number, number]> = {
  NOR: [430, 95], INT: [610, 225], CAT: [850, 158], MAD: [450, 355], LEV: [795, 375], AND: [525, 512], CAN: [255, 655],
};

interface Caja { x: number; y: number; w: number; h: number }
// la vista completa recorta el mar sobrante (misma proporción que el lienzo)
const COMPLETA: Caja = { x: 60, y: 30, w: ANCHO - 100, h: (ALTO * (ANCHO - 100)) / ANCHO };

function cajaZona(z: ZonaId): Caja {
  const ps = PROVINCIAS.filter((p) => p.zona === z).map((p) => pos(p.id));
  const xs = ps.map((p) => p[0]);
  const ys = ps.map((p) => p[1]);
  let x0 = Math.min(...xs) - 70, x1 = Math.max(...xs) + 70, y0 = Math.min(...ys) - 55, y1 = Math.max(...ys) + 55;
  // misma proporción que la vista completa
  const asp = COMPLETA.h / COMPLETA.w;
  let w = x1 - x0, h = y1 - y0;
  if (h / w > asp) { const w2 = h / asp; x0 -= (w2 - w) / 2; w = w2; } else { const h2 = w * asp; y0 -= (h2 - h) / 2; h = h2; }
  if (w < 260) { const f = 260 / w; x0 -= (w * f - w) / 2; y0 -= (h * f - h) / 2; w *= f; h *= f; }
  x1 = x0 + w; y1 = y0 + h;
  return { x: x0, y: y0, w, h };
}

/** Anima la caja visible del SVG. */
function useCaja(objetivo: Caja): Caja {
  const [caja, setCaja] = useState(objetivo);
  const actual = useRef(objetivo);
  useEffect(() => {
    const desde = actual.current;
    const reducido = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducido) { actual.current = objetivo; setCaja(objetivo); return; }
    const t0 = performance.now();
    let raf = 0;
    const paso = (t: number) => {
      const k = Math.min(1, (t - t0) / 320);
      const s = 1 - (1 - k) ** 3;
      const c = { x: desde.x + (objetivo.x - desde.x) * s, y: desde.y + (objetivo.y - desde.y) * s, w: desde.w + (objetivo.w - desde.w) * s, h: desde.h + (objetivo.h - desde.h) * s };
      actual.current = c;
      setCaja(c);
      if (k < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [objetivo.x, objetivo.y, objetivo.w, objetivo.h]);
  return caja;
}

export interface DatosMapa {
  presencia: Record<string, { P: number; C: number }>;
  morado: Record<string, number>;
  calendario: Record<number, ZonaId | null>;
  semana: number;
}

interface Props {
  v: DatosMapa;
  zona: ZonaId | null;
  /** provincias que se pueden elegir ahora (resaltadas) */
  provincias?: Set<string> | null;
  /** zonas que se pueden elegir ahora */
  zonas?: Set<string> | null;
  seleccion?: string | null;
  /** provincias que acaban de cambiar (laten) */
  pulso?: Set<string>;
  onZona?: (z: ZonaId) => void;
  onProvincia?: (id: string) => void;
}

/** Tamaño del mapa: el mayor que cabe en el hueco conservando la proporción del lienzo. */
function useTamano(): [RefObject<HTMLDivElement>, { w: number; h: number } | null] {
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = ref.current?.parentElement;
    if (!el) return;
    const medir = () => {
      const r = el.getBoundingClientRect();
      const asp = COMPLETA.h / COMPLETA.w;
      const w = Math.min(r.width, r.height / asp);
      if (w > 0) setT({ w: Math.floor(w), h: Math.floor(w * asp) });
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, t];
}

export const Mapa = memo(function Mapa({ v, zona, provincias, zonas, seleccion, pulso, onZona, onProvincia }: Props) {
  const [marco, tamano] = useTamano();
  const objetivo = useMemo(() => (zona ? cajaZona(zona) : COMPLETA), [zona]);
  const caja = useCaja(objetivo);
  const escala = caja.w / ANCHO;
  const cerca = escala < 0.6;
  const k = Math.max(0.35, Math.min(1.3, escala * 1.1));
  const encuestaEn = (z: ZonaId) => {
    for (let s = Math.max(1, v.semana); s <= 7; s++) if (v.calendario[s] === z) return s;
    return null;
  };
  return (
    <div className="mapa-marco" ref={marco} style={tamano ? { width: tamano.w, height: tamano.h } : undefined} data-testid="mapa">
      <svg className="mapa" viewBox={`${caja.x} ${caja.y} ${caja.w} ${caja.h}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Mapa de España por circunscripciones">
        <defs>
          <radialGradient id="mar" cx="50%" cy="40%" r="75%">
            <stop offset="0%" stopColor="#13213a" />
            <stop offset="100%" stopColor="#0a1220" />
          </radialGradient>
          {TIERRA && <clipPath id="silueta">{Object.keys(RUTAS).map((id) => <path key={id} d={RUTAS[id]} />)}</clipPath>}
        </defs>
        <rect x={-2000} y={-2000} width={5000} height={5000} fill="url(#mar)" />
        {MAR && <image href={MAR} x={-ANCHO * 0.25} y={-ALTO * 0.25} width={ANCHO * 1.5} height={ALTO * 1.5} preserveAspectRatio="xMidYMid slice" />}
        {TIERRA && <image href={TIERRA} x={0} y={0} width={ANCHO} height={ALTO} preserveAspectRatio="none" clipPath="url(#silueta)" />}
        <path d={mapa.recuadro} fill="none" stroke="var(--linea)" strokeWidth={1.2} strokeDasharray="5 5" />
        <path d={mapa.gibraltar} fill="#2a3550" />
        <g>
          {PROVINCIAS.map((p) => {
            const pr = v.presencia[p.id];
            const ctrl = controlDe(p, pr, v.morado[p.id] ?? 0);
            const dif = pr.P - pr.C;
            const elegible = !!provincias?.has(p.id) || (!!zonas?.has(p.zona) && !provincias);
            const atenuada = (provincias || zonas) && !elegible;
            const fuera = zona && p.zona !== zona;
            const relleno = ctrl === -1 ? 'var(--prog)' : ctrl === 1 ? 'var(--cons)' : dif > 0 ? '#7a3a43' : dif < 0 ? '#2e4c78' : '#34405a';
            const op = TIERRA ? (ctrl !== 0 ? 0.62 : 0.45) : ctrl !== 0 ? 0.88 : 0.8;
            return (
              <path
                key={p.id}
                d={RUTAS[p.id]}
                className={`prov ${elegible ? 'elegible' : ''} ${seleccion === p.id ? 'sel' : ''} ${pulso?.has(p.id) ? 'pulso' : ''}`}
                fill={relleno}
                fillOpacity={atenuada || fuera ? op * 0.45 : op}
                onClick={() => (provincias ? provincias.has(p.id) && onProvincia?.(p.id) : zona ? onProvincia?.(p.id) : onZona?.(p.zona))}
              />
            );
          })}
        </g>
        {cerca && (
          <g className="fichas" pointerEvents="none">
            {PROVINCIAS.filter((p) => !zona || p.zona === zona).map((p) => {
              const pr = v.presencia[p.id];
              const ctrl = controlDe(p, pr, v.morado[p.id] ?? 0);
              const [x, y] = pos(p.id);
              const morado = v.morado[p.id] ?? 0;
              return (
                <g key={p.id} transform={`translate(${x} ${y}) scale(${k})`}>
                  <text y={-15} textAnchor="middle" className="nombre-prov">{p.corto} · {p.escanos}</text>
                  <rect x={-17} y={-8} width={16} height={16} rx={3} fill={ctrl === -1 ? 'var(--prog)' : '#0d1524'} stroke="var(--prog)" strokeWidth={1.4} />
                  <text x={-9} y={4.5} textAnchor="middle" className="num" fill={ctrl === -1 ? '#fff' : 'var(--prog)'}>{pr.P}</text>
                  <rect x={1} y={-8} width={16} height={16} rx={3} fill={ctrl === 1 ? 'var(--cons)' : '#0d1524'} stroke="var(--cons)" strokeWidth={1.4} />
                  <text x={9} y={4.5} textAnchor="middle" className="num" fill={ctrl === 1 ? '#fff' : 'var(--cons)'}>{pr.C}</text>
                  {p.clave && <path d="M0 -29 l4 4 l-4 4 l-4 -4 z" fill="var(--oro)" stroke="#0a1220" strokeWidth={1} />}
                  {Array.from({ length: morado }, (_, i) => <circle key={i} cx={-4 + i * 8} cy={14} r={3} fill="var(--morado-claro)" stroke="#0a1220" strokeWidth={1} />)}
                </g>
              );
            })}
          </g>
        )}
      </svg>
      {!zona && (
        <div className="insignias">
          {ZONA_IDS.map((z) => {
            const ps = PROVINCIAS.filter((p) => p.zona === z);
            const esc = ps.reduce((a, p) => a + p.escanos, 0);
            let nP = 0, nC = 0;
            for (const p of ps) {
              const c = controlDe(p, v.presencia[p.id], v.morado[p.id] ?? 0);
              if (c === -1) nP++;
              else if (c === 1) nC++;
            }
            const [x, y] = CENTRO_ZONA[z];
            const s = encuestaEn(z);
            const elegible = !!zonas?.has(z);
            return (
              <button
                key={z}
                type="button"
                className={`insignia ${elegible ? 'elegible' : ''} ${zonas && !elegible ? 'atenuada' : ''} ${seleccion === z ? 'sel' : ''}`}
                // en pantallas bajas, que la etiqueta de la encuesta no se salga por arriba
                style={{ left: `${((x - COMPLETA.x) / COMPLETA.w) * 100}%`, top: `max(26px, ${((y - COMPLETA.y) / COMPLETA.h) * 100}%)`, borderColor: ZONAS[z].color }}
                onClick={() => onZona?.(z)}
                data-testid={`zona-${z}`}
              >
                <b>{ZONA_CORTA[z]}</b>
                <span className="dato"><i className="p">{nP}</i>·<i className="c">{nC}</i> <small>{esc}</small></span>
                {s && <span className={`encuesta-prox ${s === v.semana ? 'ya' : ''}`}>{s === v.semana ? 'encuesta' : `S${s}`}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});

