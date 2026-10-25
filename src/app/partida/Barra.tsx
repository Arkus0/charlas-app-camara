// Barra superior (semana, Clima, Ventaja y «Camino a 176») y tira de la Agenda.
import { memo } from 'react';
import { duenoTema, enAgenda, NOMBRE_TEMA, TEMAS } from '../../motor/agenda';
import type { Resultado } from '../../motor/electoral';
import { FECHAS } from '../../motor/reglas';
import type { Vista } from '../../motor/vista';
import { Icono, ICONO, IconoTema } from '../comun/Iconos';
import { CORTO_TEMA, fmtVentaja, LIDER, NOMBRE_CLIMA } from '../textos';

interface PropsBarra {
  v: Vista;
  proy: Resultado;
  onCongreso: () => void;
  onMenu: () => void;
}

export const Barra = memo(function Barra({ v, proy, onCongreso, onMenu }: PropsBarra) {
  const ap = proy.apoyos;
  const pct = (n: number) => `${Math.min(100, (n / 350) * 100)}%`;
  return (
    <header className="barra">
      <div className="barra-fila">
        <button className="boton-icono" type="button" onClick={onMenu} aria-label="Menú" data-testid="menu">
          <Icono d={ICONO.menu} />
        </button>
        <div className="semana">
          <b>Semana {Math.max(1, v.semana)}</b>
          <span className="tenue">{FECHAS[Math.max(1, v.semana)]}</span>
        </div>
        <div className={`clima clima-${v.clima}`} title={`Clima: ${NOMBRE_CLIMA[v.clima]}`} aria-label={`Clima ${v.clima}: ${NOMBRE_CLIMA[v.clima]}`}>
          {[5, 4, 3, 2, 1].map((n) => <i key={n} className={n >= v.clima ? 'on' : ''} />)}
          <span>{NOMBRE_CLIMA[v.clima]}</span>
        </div>
      </div>
      <button className="camino" type="button" onClick={onCongreso} aria-label="Ver el Congreso" data-testid="congreso">
        <div className="camino-nums">
          <span className="p"><b className="dato">{ap.P}</b> {LIDER.P}</span>
          <span className="ventaja dato">V {fmtVentaja(v.ventaja)}</span>
          <span className="c">{LIDER.C} <b className="dato">{ap.C}</b></span>
        </div>
        <div className="camino-barra" aria-hidden="true">
          <i className="p" style={{ width: pct(ap.P) }} />
          <i className="c" style={{ width: pct(ap.C) }} />
          <span className="marca-176" />
        </div>
      </button>
    </header>
  );
});

export const TiraAgenda = memo(function TiraAgenda({ v, onAbrir }: { v: Vista; onAbrir: () => void }) {
  const top = enAgenda(v);
  return (
    <button className="tira-agenda" type="button" onClick={onAbrir} aria-label="Ver la Agenda" data-testid="agenda">
      {TEMAS.map((t) => {
        const dueno = duenoTema(v, t);
        const pos = top.indexOf(t);
        return (
          <span key={t} className={`tema tema-${t} dueno-${dueno ?? 'n'} ${pos === 0 ? 'primero' : pos === 1 ? 'segundo' : ''} ${dueno === v.yo ? 'mio' : dueno ? 'suyo' : ''}`} title={NOMBRE_TEMA[t]}>
            <IconoTema tema={t} size={16} />
            <span className="calor" aria-hidden="true">{[1, 2, 3, 4, 5].map((n) => <i key={n} className={v.agenda.calor[t] >= n ? 'on' : ''} />)}</span>
            <small>{CORTO_TEMA[t].slice(0, 8)}</small>
            {pos === 0 && <em className="pv-tema">2 PV</em>}
            {pos === 1 && <em className="pv-tema">1 PV</em>}
          </span>
        );
      })}
    </button>
  );
});
