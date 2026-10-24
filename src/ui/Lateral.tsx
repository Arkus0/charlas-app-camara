import { memo } from 'react';
import { PARTIDOS, ORDEN_HEMICICLO, LIDER } from '../data/partidos';
import { REGIONALES, VETADOS_POR_VOX, type Resultado } from '../engine/electoral';
import type { EntradaLog, Estado, PartidoId } from '../engine/tipos';
import { Hemiciclo } from './Hemiciclo';
import { fmtAfin } from '../engine/motor';

export function veredicto(r: Resultado): string {
  const inv = r.investiduras.find((i) => i.exito);
  if (inv) {
    const quien = LIDER[inv.candidato];
    return `${quien} sería investido en ${inv.votacion === 1 ? 'primera' : 'segunda'} votación (${inv.si} síes, ${inv.no} noes).`;
  }
  return `Nadie lograría la investidura: habría bloqueo y decidiría la Ventaja.`;
}

export const Escrutinio = memo(function Escrutinio({ r }: { r: Resultado }) {
  return (
    <section className="caja escrutinio" aria-label="Proyección de escaños">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h3 className="etiqueta">Proyección si se votara hoy</h3>
        <span className="etiqueta">350 escaños</span>
      </div>
      <Hemiciclo escanos={r.escanos} />
      <div className="bloques">
        <div className="bloque-n p"><b>{r.bloque.P}</b><small>PSOE + FA + Podemos · {r.apoyos.P} apoyos</small></div>
        <div className="bloque-n c"><b>{r.bloque.C}</b><small>PP + Vox · {r.apoyos.C} apoyos</small></div>
      </div>
      <div className="veredicto">{veredicto(r)}{r.vetoVox ? ' Veto de Vox activo: PNV, Junts y CC no darán el sí al PP.' : ''}</div>
      <div className="escanos-lista">
        {ORDEN_HEMICICLO.filter((k) => (r.escanos[k] ?? 0) > 0).map((k) => (
          <span key={k}><i style={{ background: PARTIDOS[k].color }} />{PARTIDOS[k].siglas} <b className="dato">{r.escanos[k]}</b></span>
        ))}
      </div>
    </section>
  );
});

export const Afinidades = memo(function Afinidades({ e, r }: { e: Estado; r: Resultado }) {
  return (
    <section className="caja afinidades" aria-label="Afinidad de las fuerzas regionales">
      <h3 className="etiqueta">Fuerzas regionales · afinidad para la investidura</h3>
      {REGIONALES.map((k) => {
        const a = e.afinidad[k];
        const esc = r.escanos[k as PartidoId] ?? 0;
        const color = a < 0 ? 'var(--prog)' : a > 0 ? 'var(--cons)' : 'var(--neutro)';
        return (
          <div className="afin-fila" key={k} title={`${PARTIDOS[k].nombre}: ${a <= -2 ? 'sí a Sánchez' : a === -1 ? 'abstención con Sánchez' : a === 0 ? 'no a ambos' : a === 1 ? 'abstención con Feijóo' : 'sí a Feijóo'}${r.vetoVox && VETADOS_POR_VOX.includes(k) && a >= 2 ? ' (vetado por Vox: se abstiene)' : ''}`}>
            <span>{PARTIDOS[k].siglas} <span className="dato" style={{ color: 'var(--tenue)' }}>{esc}</span></span>
            <span className="afin-escala"><b style={{ left: `${((a + 3) / 6) * 100}%`, background: color }} /></span>
            <span className="dato" style={{ fontSize: 11, color: 'var(--tenue)' }}>{fmtAfin(a)}</span>
          </div>
        );
      })}
    </section>
  );
});

export const Registro = memo(function Registro({ log }: { log: EntradaLog[] }) {
  const ultimos = log.slice(-160).reverse();
  return (
    <section className="caja registro" aria-label="Crónica de la campaña">
      <h3 className="etiqueta">Crónica de campaña</h3>
      <ol>
        {ultimos.map((l, i) => (
          <li key={log.length - i} className={`${l.bando ?? ''} ${l.tipo ?? ''}`}>{l.texto}</li>
        ))}
      </ol>
    </section>
  );
});
