import { memo } from 'react';
import { ORDEN_HEMICICLO, PARTIDOS } from '../data/partidos';
import type { PartidoId, Votos } from '../engine/tipos';

const FILAS = 10;
const R0 = 0.36;

const ASIENTOS = (() => {
  const radios = Array.from({ length: FILAS }, (_, i) => R0 + ((1 - R0) * i) / (FILAS - 1));
  const suma = radios.reduce((a, r) => a + r, 0);
  const por = radios.map((r) => Math.round((350 * r) / suma));
  por[FILAS - 1] += 350 - por.reduce((a, b) => a + b, 0);
  const pts: { x: number; y: number; ang: number }[] = [];
  radios.forEach((r, i) => {
    const k = por[i];
    for (let j = 0; j < k; j++) {
      const ang = Math.PI - (Math.PI * j) / (k - 1);
      pts.push({ x: r * Math.cos(ang), y: -r * Math.sin(ang), ang });
    }
  });
  pts.sort((a, b) => b.ang - a.ang || a.y - b.y);
  return pts;
})();

export const Hemiciclo = memo(function Hemiciclo({ escanos, className }: { escanos: Votos; className?: string }) {
  const colores: string[] = [];
  for (const k of ORDEN_HEMICICLO) for (let i = 0; i < (escanos[k] ?? 0); i++) colores.push(PARTIDOS[k as PartidoId].color);
  while (colores.length < 350) colores.push('#3a4560');
  return (
    <svg className={className} viewBox="-1.06 -1.08 2.12 1.16" role="img" aria-label="Hemiciclo con la proyección de escaños">
      {ASIENTOS.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={0.026} fill={colores[i]} />
      ))}
      <line x1="0" y1="-1.06" x2="0" y2="-0.3" stroke="var(--oro)" strokeWidth="0.008" strokeDasharray="0.03 0.02" />
      <text x="0" y="0.05" textAnchor="middle" fontSize="0.13" fontWeight="900" fill="var(--tinta)" fontFamily="var(--f-display)">176</text>
    </svg>
  );
});
