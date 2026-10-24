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

interface Props {
  estado: Estado;
  opciones: Set<string> | null;
  onElegir: (id: string) => void;
  onHover: (id: string | null, x: number, y: number) => void;
}

export const Mapa = memo(function Mapa({ estado, opciones, onElegir, onHover }: Props) {
  return (
    <svg className="mapa" viewBox="0 0 1340 1110" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Mapa esquemático de las 52 circunscripciones">
      <rect x="0" y="0" width="1340" height="1110" fill="var(--noche)" />
      <g>
        <rect x="22" y="1020" width="282" height="80" rx="8" fill="none" stroke="var(--linea)" strokeDasharray="4 5" />
        <text x="30" y="1013" fontSize="15" fill="var(--tenue)" fontFamily="var(--f-display)">Canarias</text>
      </g>
      <g fontFamily="var(--f-display)" fontSize="15" fill="var(--tenue)">
        {Object.values(ZONAS).map((z, i) => (
          <g key={z.id} transform={`translate(${1000 + (i % 2) * 170}, ${660 + Math.floor(i / 2) * 26})`}>
            <rect width="14" height="14" rx="3" fill={z.color} />
            <text x="20" y="12">{z.nombre}</text>
          </g>
        ))}
        <text x="1000" y="780">◆ provincia clave · ○ fidelidad</text>
        <text x="1000" y="804">◣ feudo · casilla rellena = control</text>
      </g>
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
        const ctrl = controlDe(p, pr);
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
            onClick={esOpcion ? () => onElegir(p.id) : undefined}
            onMouseEnter={(ev) => onHover(p.id, ev.clientX, ev.clientY)}
            onMouseMove={(ev) => onHover(p.id, ev.clientX, ev.clientY)}
            onMouseLeave={() => onHover(null, 0, 0)}
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
            <circle cx={p.x} cy={y0 + 35} r={9} fill="none" stroke="var(--tenue)" strokeWidth={1} />
            <text x={p.x} y={y0 + 39.5} fontSize="12" textAnchor="middle" fill="var(--tenue)" fontFamily="var(--f-dato)">{p.fidelidad}</text>
            {p.feudo && <path d={`M${x0} ${y0 + H - 12} v7 a5 5 0 0 0 5 5 h7 z`} fill={p.feudo === 'P' ? 'var(--prog)' : 'var(--cons)'} />}
          </g>
        );
      })}
    </svg>
  );
});
