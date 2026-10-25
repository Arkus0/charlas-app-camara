import { memo } from 'react';
import { PROV, PROVINCIAS, ZONAS } from '../data/provincias';
import { controlDe } from '../engine/electoral';
import type { Estado } from '../engine/tipos';

const W = 100;
const H = 54;
const MARITIMOS = new Set(['07-08', '07-46', '35-38', '11-35', '21-38', '11-51', '29-51', '29-52', '04-52']);

const LINEAS = (() => {
  const vistas = new Set<string>();
  const res: { a: string; b: string; mar: boolean }[] = [];
  for (const p of PROVINCIAS) {
    for (const v of p.vecinos) {
      const k = [p.id, v].sort().join('-');
      if (vistas.has(k) || !PROV[v]) continue;
      vistas.add(k);
      res.push({ a: p.id, b: v, mar: MARITIMOS.has(k) });
    }
  }
  return res;
})();

export const ANCHO_MAPA = 1340;
export const ALTO_MAPA = 1110;

interface Props {
  estado: Estado;
  opciones: Set<string> | null;
  onElegir: (id: string) => void;
  onHover?: (id: string | null, x: number, y: number) => void;
  /** toque en una provincia que no es opción (en móvil abre su ficha) */
  onTocar?: (id: string) => void;
  viewBox?: string;
  sinLeyenda?: boolean;
}

export const Mapa = memo(function Mapa({ estado, opciones, onElegir, onHover, onTocar, viewBox, sinLeyenda }: Props) {
  return (
    <svg className="mapa" viewBox={viewBox ?? `0 0 ${ANCHO_MAPA} ${ALTO_MAPA}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Mapa esquemático de las 52 circunscripciones">
      <rect x="-2000" y="-2000" width="6000" height="6000" fill="var(--noche)" />
      <g>
        <rect x="22" y="1020" width="282" height="80" rx="8" fill="none" stroke="var(--linea)" strokeDasharray="4 5" />
        <text x="30" y="1013" fontSize="15" fill="var(--tenue)" fontFamily="var(--f-display)">Canarias</text>
      </g>
      {!sinLeyenda && <g fontFamily="var(--f-display)" fontSize="15" fill="var(--tenue)">
        {Object.values(ZONAS).map((z, i) => (
          <g key={z.id} transform={`translate(${1000 + (i % 2) * 170}, ${660 + Math.floor(i / 2) * 26})`}>
            <rect width="14" height="14" rx="3" fill={z.color} />
            <text x="20" y="12">{z.nombre}</text>
          </g>
        ))}
        <text x="1000" y="780">◆ provincia clave · ○ fidelidad</text>
        <text x="1000" y="804">◣ feudo · casilla rellena = control</text>
        <text x="1000" y="828" fill="var(--morado-claro)">● marcador morado de Podemos (+1 fidelidad)</text>
      </g>}
      <g>
        {LINEAS.map(({ a, b, mar }) => (
          <line
            key={a + b}
            x1={PROV[a].x}
            y1={PROV[a].y}
            x2={PROV[b].x}
            y2={PROV[b].y}
            stroke={mar ? '#3d5a8a' : 'var(--linea)'}
            strokeWidth={mar ? 1.5 : 2}
            strokeDasharray={mar ? '5 6' : undefined}
          />
        ))}
      </g>
      {PROVINCIAS.map((p) => {
        const pr = estado.presencia[p.id];
        const morado = estado.morado[p.id] ?? 0;
        const ctrl = controlDe(p, pr, morado);
        const bastion = estado.efectos.find((x) => x.tipo === 'bastion' && x.prov === p.id);
        const plaza = estado.efectos.find((x) => x.tipo === 'plazaFuerte' && x.prov === p.id);
        const esOpcion = !!opciones?.has(p.id);
        const atenuada = opciones !== null && !esOpcion;
        const x0 = p.x - W / 2;
        const y0 = p.y - H / 2;
        const zona = ZONAS[p.zona];
        const fondo = ctrl === -1 ? '#3a1e2a' : ctrl === 1 ? '#18304f' : 'var(--tablero-2)';
        return (
          <g
            key={p.id}
            className={`prov ${esOpcion ? 'opcion' : ''} ${atenuada ? 'atenuada' : ''}`}
            onClick={esOpcion ? () => onElegir(p.id) : onTocar ? () => onTocar(p.id) : undefined}
            onMouseEnter={onHover ? (ev) => onHover(p.id, ev.clientX, ev.clientY) : undefined}
            onMouseMove={onHover ? (ev) => onHover(p.id, ev.clientX, ev.clientY) : undefined}
            onMouseLeave={onHover ? () => onHover(null, 0, 0) : undefined}
            role={esOpcion ? 'button' : undefined}
            tabIndex={esOpcion ? 0 : undefined}
            aria-label={`${p.nombre}: ${p.escanos} escaños, presencia progresista ${pr.P}, conservadora ${pr.C}`}
            onKeyDown={esOpcion ? (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onElegir(p.id); } } : undefined}
          >
            <rect className="marco" x={x0} y={y0} width={W} height={H} rx={5} fill={fondo} stroke={p.clave ? 'var(--oro)' : 'var(--linea)'} strokeWidth={p.clave ? 1.6 : 1} />
            <path d={`M${x0 + 5} ${y0} h${W - 10} a5 5 0 0 1 5 5 v13 h-${W} v-13 a5 5 0 0 1 5 -5 z`} fill={zona.color} opacity={0.9} />
            <text x={x0 + 5} y={y0 + 14} fontSize="14" fontWeight="700" fill="#10151f" fontFamily="var(--f-display)" style={{ fontVariationSettings: "'wdth' 64" }}>
              {p.clave ? '◆ ' : ''}{p.corto}
            </text>
            <text x={x0 + W - 5} y={y0 + 14} fontSize="13" fontWeight="600" fill="#10151f" textAnchor="end" fontFamily="var(--f-dato)">{p.escanos}</text>
            {/* presencia progresista */}
            <rect x={x0 + 7} y={y0 + 23} width={26} height={24} rx={3} fill={ctrl === -1 ? 'var(--prog)' : 'none'} stroke="var(--prog)" strokeWidth={1.5} opacity={pr.P || ctrl === -1 ? 1 : 0.35} />
            <text x={x0 + 20} y={y0 + 41} fontSize="18" fontWeight="800" textAnchor="middle" fill={ctrl === -1 ? '#fff' : 'var(--prog)'} fontFamily="var(--f-dato)" opacity={pr.P ? 1 : 0.35}>{pr.P}</text>
            {/* presencia conservadora */}
            <rect x={x0 + W - 33} y={y0 + 23} width={26} height={24} rx={3} fill={ctrl === 1 ? 'var(--cons)' : 'none'} stroke="var(--cons)" strokeWidth={1.5} opacity={pr.C || ctrl === 1 ? 1 : 0.35} />
            <text x={x0 + W - 20} y={y0 + 41} fontSize="18" fontWeight="800" textAnchor="middle" fill={ctrl === 1 ? '#fff' : 'var(--cons)'} fontFamily="var(--f-dato)" opacity={pr.C ? 1 : 0.35}>{pr.C}</text>
            {/* fidelidad */}
            <circle cx={p.x} cy={y0 + 35} r={9} fill={morado ? 'var(--morado)' : 'none'} stroke={morado ? 'var(--morado-claro)' : 'var(--tenue)'} strokeWidth={morado ? 1.6 : 1} />
            <text x={p.x} y={y0 + 39.5} fontSize="12" textAnchor="middle" fill={morado ? '#fff' : 'var(--tenue)'} fontFamily="var(--f-dato)">{p.fidelidad + morado}</text>
            {/* marcadores morados de Podemos */}
            {Array.from({ length: morado }, (_, i) => <circle key={i} cx={p.x - 4 + i * 8} cy={y0 + 51} r={3} fill="var(--morado-claro)" />)}
            {bastion && <path d={`M${x0 + W - 13} ${y0 + H - 13} h10 v5 q0 6 -5 8 q-5 -2 -5 -8 z`} fill={bastion.dueno === 'P' ? 'var(--prog)' : 'var(--cons)'} stroke="#fff" strokeWidth={0.8}><title>Bastión</title></path>}
            {plaza && <path d={`M${x0 + W - 8} ${y0 + H - 15} l5 5 l-5 5 l-5 -5 z`} fill="none" stroke={plaza.dueno === 'P' ? 'var(--prog)' : 'var(--cons)'} strokeWidth={1.6}><title>Plaza fuerte: cuenta como clave</title></path>}
            {p.feudo && <path d={`M${x0} ${y0 + H - 12} v7 a5 5 0 0 0 5 5 h7 z`} fill={p.feudo === 'P' ? 'var(--prog)' : 'var(--cons)'} />}
          </g>
        );
      })}
    </svg>
  );
});
