// La noche electoral: el reparto final, las votaciones de investidura y el especial del plató.
import { PARTIDOS, ORDEN_HEMICICLO } from '../../data/partidos';
import { PROVINCIAS } from '../../data/provincias';
import type { Bando } from '../../motor/base';
import { proyectar } from '../../motor/electoral';
import type { Vista } from '../../motor/vista';
import { especialFinal } from '../../narrativa/cronica';
import { Hemiciclo } from '../comun/Hemiciclo';
import { Plato } from './Momento';
import { LIDER, SIGLAS_BLOQUE } from '../textos';

export function Noche({ v, onRevancha, onMenu, onTablero }: { v: Vista; onRevancha?: () => void; onMenu: () => void; onTablero: () => void }) {
  const r = proyectar(PROVINCIAS, v);
  const g = v.ganador!;
  const yoGano = g.bando === v.yo;
  const partidos = ORDEN_HEMICICLO.filter((k) => (r.escanos[k] ?? 0) > 0).sort((a, b) => (r.escanos[b] ?? 0) - (r.escanos[a] ?? 0));
  return (
    <main className="noche" data-testid="noche">
      <p className="etiqueta">{/Vuelco|Ruptura/.test(g.motivo) ? `Fin anticipado · semana ${v.semana}` : 'Domingo 29 de noviembre · noche electoral'}</p>
      <h1 className={g.bando === 'P' ? 'p' : g.bando === 'C' ? 'c' : ''}>{yoGano ? '¡Has ganado!' : g.bando ? `Gana ${LIDER[g.bando as Bando]}` : 'Bloqueo'}</h1>
      <p className="motivo">{g.motivo}</p>
      <Hemiciclo escanos={r.escanos} className="hemiciclo" />
      <div className="bloques">
        <div className="bloque p"><b className="dato">{r.bloque.P}</b><span>{SIGLAS_BLOQUE.P}</span></div>
        <div className="bloque c"><b className="dato">{r.bloque.C}</b><span>{SIGLAS_BLOQUE.C}</span></div>
      </div>
      <div className="votaciones">
        {r.investiduras.map((x) => (
          <div key={x.candidato} className={`votacion ${x.exito ? 'exito' : ''}`}>
            <b>{LIDER[x.candidato]}</b>
            <span className="dato">sí {x.si} · no {x.no} · abst. {x.abst}</span>
            <span>{x.exito ? (x.votacion === 1 ? 'investido en primera votación' : 'investido en segunda votación') : 'no logra la investidura'}</span>
          </div>
        ))}
      </div>
      <ul className="partidos-final">
        {partidos.map((k) => <li key={k}><i style={{ background: PARTIDOS[k].color }} />{PARTIDOS[k].siglas} <b className="dato">{r.escanos[k]}</b></li>)}
      </ul>
      <Plato segmento={especialFinal(v.cronica, g)} />
      <div className="acciones-noche">
        {onRevancha && <button type="button" className="boton principal grande" onClick={onRevancha}>Otra campaña</button>}
        <button type="button" className="boton grande" onClick={onTablero}>Ver el mapa final</button>
        <button type="button" className="boton grande" onClick={onMenu}>Menú</button>
      </div>
    </main>
  );
}
