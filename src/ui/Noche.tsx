import { useMemo } from 'react';
import { LIDER, ORDEN_HEMICICLO, PARTIDOS, NOMBRE_BANDO } from '../data/partidos';
import { PROVINCIAS } from '../data/provincias';
import { proyectar } from '../engine/electoral';
import type { Bando, Estado, PartidoId } from '../engine/tipos';
import { Hemiciclo } from './Hemiciclo';

export function Noche({ e, humano, onNueva, onTablero }: { e: Estado; humano: Bando | null; onNueva: () => void; onTablero: () => void }) {
  const r = useMemo(() => proyectar(PROVINCIAS, e), [e]);
  const g = e.ganador!;
  const votosTot = Object.entries(r.votos).reduce((a, [k, v]) => a + (k === 'BLANCO' ? 0 : v ?? 0), 0);
  const titular = g.bando === 'C' ? 'Feijóo, a la Moncloa' : g.bando === 'P' ? 'Sánchez sigue en la Moncloa' : 'Empate';
  const resultado = humano ? (g.bando === humano ? 'Has ganado' : 'Has perdido') : g.bando ? `Gana el ${NOMBRE_BANDO[g.bando]}` : '';
  const porVotos = ORDEN_HEMICICLO.filter((k) => (r.escanos[k] ?? 0) > 0).sort((a, b) => (r.votos[b] ?? 0) - (r.votos[a] ?? 0));
  return (
    <div className="noche">
      <span className="etiqueta">Domingo 29 de noviembre de 2026 · escrutinio al 100%</span>
      <h1 className="titular" style={{ color: g.bando === 'P' ? 'var(--prog)' : g.bando === 'C' ? 'var(--cons)' : 'var(--tinta)' }}>{titular}</h1>
      <p className="motivo"><b>{resultado}.</b> {g.motivo}.</p>
      <Hemiciclo escanos={r.escanos} className="hemiciclo-grande" />
      <div className="votaciones">
        {r.investiduras.map((inv, i) => (
          <div key={i} className="caja votacion">
            <div><b>Investidura de {LIDER[inv.candidato]}</b><div className="etiqueta">{inv.exito ? (inv.votacion === 1 ? 'Aprobada en primera votación' : 'Aprobada en segunda votación') : 'Rechazada'}</div></div>
            <div className="dato"><span className="si">{inv.si} sí</span> · <span className="no">{inv.no} no</span> · {inv.abst} abst.</div>
          </div>
        ))}
      </div>
      <div className="tabla-final caja">
        <table>
          <thead><tr><th>Candidatura</th><th>Votos</th><th>%</th><th>Escaños</th></tr></thead>
          <tbody>
            {porVotos.map((k) => (
              <tr key={k}>
                <td><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 5, background: PARTIDOS[k as PartidoId].color, marginRight: 8 }} />{PARTIDOS[k as PartidoId].nombre}</td>
                <td className="dato">{Math.round(r.votos[k] ?? 0).toLocaleString('es-ES')}</td>
                <td className="dato">{(((r.votos[k] ?? 0) / votosTot) * 100).toFixed(1)}</td>
                <td className="dato"><b>{r.escanos[k]}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="acciones-menu">
        <button className="boton principal" type="button" onClick={onNueva}>Nueva partida</button>
        <button className="boton" type="button" onClick={onTablero}>Ver el tablero final</button>
      </div>
    </div>
  );
}
