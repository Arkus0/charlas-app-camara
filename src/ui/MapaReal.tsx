// El mapa real de España: cada circunscripción con su forma, coloreada según quién la controla,
// y encima la presencia de cada bloque. Si existen las ilustraciones del mapa (src/assets/mapa/mar.* y tierra.*),
// el mar va de fondo y el relieve se recorta con la silueta real de las provincias, así que nunca se desalinea con la costa.
import { memo } from 'react';
import mapa from '../data/mapa.json';
import { PROVINCIAS } from '../data/provincias';
import { controlDe } from '../engine/electoral';
import type { Estado } from '../engine/tipos';

export const ANCHO_REAL = mapa.ancho;
export const ALTO_REAL = mapa.alto;
export const CENTROS: Record<string, [number, number]> = mapa.centros as unknown as Record<string, [number, number]>;

// pequeños ajustes para que los marcadores no se pisen donde las provincias son diminutas
const DESPLAZA: Record<string, [number, number]> = { '20': [10, -10], '01': [-6, 10], '48': [-14, -8], '51': [-8, 4], '52': [10, 4], '28': [0, 4] };
export const posReal = (id: string): [number, number] => {
  const [x, y] = CENTROS[id];
  const [dx, dy] = DESPLAZA[id] ?? [0, 0];
  return [x + dx, y + dy];
};

const CAPAS = import.meta.glob('../assets/web/mapa/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const capa = (nombre: string) => Object.entries(CAPAS).find(([ruta]) => ruta.endsWith(`/${nombre}.webp`))?.[1];
const MAR = capa('mar');
const TIERRA = capa('tierra');
const IDS_PROVINCIAS = Object.keys(mapa.provincias) as (keyof typeof mapa.provincias)[];

interface Props {
  estado: Estado;
  opciones: Set<string> | null;
  onElegir: (id: string) => void;
  onHover?: (id: string | null, x: number, y: number) => void;
  onTocar?: (id: string) => void;
  viewBox?: string;
  /** factor para que los marcadores mantengan su tamaño en pantalla al hacer zoom (1 = vista completa) */
  escala?: number;
}

export const MapaReal = memo(function MapaReal({ estado, opciones, onElegir, onHover, onTocar, viewBox, escala = 1 }: Props) {
  const k = Math.max(0.28, Math.min(1.4, escala));
  const nombres = escala < 0.45; // con zoom, los nombres caben
  return (
    <svg className="mapa mapa-real" viewBox={viewBox ?? `0 0 ${ANCHO_REAL} ${ALTO_REAL}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Mapa de España por circunscripciones">
      <defs>
        <radialGradient id="mar" cx="50%" cy="40%" r="75%">
          <stop offset="0%" stopColor="#13213a" />
          <stop offset="100%" stopColor="#0a1220" />
        </radialGradient>
        {TIERRA && (
          <clipPath id="silueta">
            {IDS_PROVINCIAS.map((id) => <path key={id} d={mapa.provincias[id]} />)}
          </clipPath>
        )}
      </defs>
      <rect x={-2000} y={-2000} width={5000} height={5000} fill="url(#mar)" />
      {MAR && <image href={MAR} x={-ANCHO_REAL * 0.25} y={-ALTO_REAL * 0.25} width={ANCHO_REAL * 1.5} height={ALTO_REAL * 1.5} preserveAspectRatio="xMidYMid slice" />}
      {TIERRA && <image href={TIERRA} x={0} y={0} width={ANCHO_REAL} height={ALTO_REAL} preserveAspectRatio="none" clipPath="url(#silueta)" />}
      <path d={mapa.recuadro} fill="none" stroke="var(--linea)" strokeWidth={1.2} strokeDasharray="5 5" />
      <path d={mapa.gibraltar} fill="#2a3550" />
      <g className="provincias-reales">
        {/* las elegibles al final, para que su borde no quede tapado por las vecinas */}
        {(opciones ? [...PROVINCIAS].sort((a, b) => Number(opciones.has(a.id)) - Number(opciones.has(b.id))) : PROVINCIAS).map((p) => {
          const pr = estado.presencia[p.id];
          const morado = estado.morado[p.id] ?? 0;
          const ctrl = controlDe(p, pr, morado);
          const ventaja = pr.P - pr.C;
          const esOpcion = !!opciones?.has(p.id);
          const atenuada = opciones !== null && !esOpcion;
          const relleno = ctrl === -1 ? 'var(--prog)' : ctrl === 1 ? 'var(--cons)' : ventaja > 0 ? '#7a3a43' : ventaja < 0 ? '#2e4c78' : '#34405a';
          // con relieve ilustrado, las provincias se vuelven translúcidas para que se vea debajo
          const opacidad = TIERRA ? (ctrl !== 0 ? 0.62 : ventaja !== 0 ? 0.5 : 0.42) : ctrl !== 0 ? 0.88 : ventaja !== 0 ? 0.75 : 0.9;
          return (
            <path
              key={p.id}
              d={mapa.provincias[p.id as keyof typeof mapa.provincias]}
              className={`prov-real ${esOpcion ? 'opcion' : ''} ${atenuada ? 'atenuada' : ''} ${p.clave ? 'clave' : ''}`}
              fill={relleno}
              fillOpacity={opacidad}
              onClick={esOpcion ? () => onElegir(p.id) : onTocar ? () => onTocar(p.id) : undefined}
              onMouseEnter={onHover ? (ev) => onHover(p.id, ev.clientX, ev.clientY) : undefined}
              onMouseMove={onHover ? (ev) => onHover(p.id, ev.clientX, ev.clientY) : undefined}
              onMouseLeave={onHover ? () => onHover(null, 0, 0) : undefined}
              role={esOpcion ? 'button' : undefined}
              tabIndex={esOpcion ? 0 : undefined}
              aria-label={`${p.nombre}: ${p.escanos} escaños, presencia progresista ${pr.P}, conservadora ${pr.C}`}
              onKeyDown={esOpcion ? (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onElegir(p.id); } } : undefined}
            />
          );
        })}
      </g>
      {/* marcadores de presencia: tamaño constante en pantalla */}
      <g className="fichas-reales" pointerEvents="none">
        {PROVINCIAS.map((p) => {
          const pr = estado.presencia[p.id];
          const morado = estado.morado[p.id] ?? 0;
          const ctrl = controlDe(p, pr, morado);
          const atenuada = opciones !== null && !opciones.has(p.id);
          const [x, y] = posReal(p.id);
          const w = 15;
          const h = 15;
          return (
            <g key={p.id} transform={`translate(${x} ${y}) scale(${k})`} opacity={atenuada ? 0.45 : pr.P + pr.C === 0 && !nombres ? 0.6 : 1}>
              {nombres && <text y={-14} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff" stroke="#0a1220" strokeWidth={3} paintOrder="stroke" fontFamily="var(--f-display)">{p.corto} · {p.escanos}</text>}
              <rect x={-w - 1} y={-h / 2} width={w} height={h} rx={3} fill={ctrl === -1 ? 'var(--prog)' : '#0d1524'} stroke="var(--prog)" strokeWidth={1.4} />
              <text x={-w / 2 - 1} y={4.5} textAnchor="middle" fontSize={12} fontWeight={800} fill={ctrl === -1 ? '#fff' : 'var(--prog)'} fontFamily="var(--f-dato)">{pr.P}</text>
              <rect x={1} y={-h / 2} width={w} height={h} rx={3} fill={ctrl === 1 ? 'var(--cons)' : '#0d1524'} stroke="var(--cons)" strokeWidth={1.4} />
              <text x={w / 2 + 1} y={4.5} textAnchor="middle" fontSize={12} fontWeight={800} fill={ctrl === 1 ? '#fff' : 'var(--cons)'} fontFamily="var(--f-dato)">{pr.C}</text>
              {p.clave && <path d={`M0 ${-h / 2 - 7} l4 4 l-4 4 l-4 -4 z`} fill="var(--oro)" stroke="#0a1220" strokeWidth={1} />}
              {Array.from({ length: morado }, (_, i) => <circle key={i} cx={-4 + i * 8} cy={h / 2 + 5} r={3} fill="var(--morado-claro)" stroke="#0a1220" strokeWidth={1} />)}
            </g>
          );
        })}
      </g>
    </svg>
  );
});

/** Posición de cada provincia en el mapa real (para encuadres y zoom). */
export const POSICIONES_REALES: Record<string, [number, number]> = Object.fromEntries(PROVINCIAS.map((p) => [p.id, posReal(p.id)]));
