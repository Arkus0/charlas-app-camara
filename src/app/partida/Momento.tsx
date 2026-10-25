// Lo que ha pasado, contado pantalla a pantalla: la jugada del rival, la noticia de la semana,
// el cierre con la encuesta y el plató, y los debates televisados.
import { useEffect, useState } from 'react';
import { CARTAS } from '../../data/mazos';
import { citar } from '../../motor/acciones';
import { PLATO } from '../../data/plato';
import { ZONAS } from '../../data/provincias';
import { NOMBRE_TEMA } from '../../motor/agenda';
import { HITOS, FECHAS } from '../../motor/reglas';
import type { Suceso } from '../../motor/tipos';
import type { Vista } from '../../motor/vista';
import { cronicaSemana, type Segmento } from '../../narrativa/cronica';
import { CartaGrande } from '../comun/Carta';
import { haptica } from '../comun/haptica';
import type { Momento as M } from '../momentos';
import { LIDER, NOMBRE_MODO, nombreDestino, PARTIDO_BLOQUE } from '../textos';

const rapido = () => typeof location !== 'undefined' && location.hash.includes('rapido');

export function Plato({ segmento }: { segmento: Segmento }) {
  return (
    <section className="plato">
      <div className="plato-cab"><span className="en-directo">En directo</span><span className="tenue">{PLATO.programa} · {PLATO.cadena}</span></div>
      <div className="rotulo"><small>{segmento.rotulo}</small><b>{segmento.titulo}</b></div>
      <ul className="tertulia">
        {segmento.intervenciones.map((x, i) => {
          const p = PLATO.personajes[x.quien];
          return (
            <li key={i} className={`voz voz-${x.quien}`} style={{ animationDelay: `${i * 0.25}s` }}>
              <span className="avatar" aria-hidden="true">{p.nombre.split(' ').map((s) => s[0]).join('').slice(0, 2)}</span>
              <div><small className="tenue">{p.nombre} · {p.rol}</small><p>{x.texto}</p></div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Lineas({ m, saltar = 0 }: { m: M; saltar?: number }) {
  const lineas = m.log.slice(saltar).filter((l) => l.tipo !== 'fase').slice(0, 7);
  if (!lineas.length) return null;
  return <ul className="lineas">{lineas.map((l) => <li key={l.seq} className={l.bando === 'P' ? 'p' : l.bando === 'C' ? 'c' : ''}>{l.texto}</li>)}</ul>;
}

interface Props {
  v: Vista;
  m: M;
  onSeguir: () => void;
}

export function Momento({ v, m, onSeguir }: Props) {
  // las jugadas del rival pasan solas; el resto, con un toque
  const auto = m.tipo === 'rival' && !rapido();
  const [prog, setProg] = useState(0);
  useEffect(() => {
    if (m.efectos.some((s) => s.s === 'control' || s.s === 'ataque')) haptica([10, 40, 10]);
    if (!auto) return;
    const t0 = performance.now();
    let raf = 0;
    const paso = (t: number) => {
      const k = (t - t0) / 3200;
      setProg(Math.min(1, k));
      if (k >= 1) onSeguir();
      else raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [m.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  let cuerpo: JSX.Element;
  let boton = 'Seguir';
  switch (m.tipo) {
    case 'rival':
    case 'propia': {
      const j = m.jugada;
      const c = typeof j.carta === 'number' ? CARTAS[j.carta] : null;
      const quien = m.tipo === 'rival' ? `${PARTIDO_BLOQUE[j.bando]} juega` : 'Resultado de tu jugada';
      cuerpo = (
        <>
          <p className={`etiqueta ${j.bando === 'P' ? 'p' : 'c'}`}>{quien}</p>
          <h3>{c ? citar(c.nombre) : j.carta === 'pegada' ? 'Pegada de carteles' : 'Acción básica'} · {NOMBRE_MODO[j.modo]}{j.destino && j.destino !== '-' ? `: ${nombreDestino(j.destino, j.modo)}` : ''}</h3>
          {c && j.modo === 'evento' && <p className="carta-texto">{c.texto}</p>}
          <Lineas m={m} saltar={1} />
        </>
      );
      break;
    }
    case 'semana':
      boton = 'Empezar la semana';
      cuerpo = (
        <>
          <p className="etiqueta">Semana {m.semana} · {FECHAS[m.semana]}</p>
          <h3>{HITOS[m.semana]}</h3>
          {m.noticia !== undefined && (
            <div className="noticia">
              <p className="etiqueta">Noticia de la semana · calienta {NOMBRE_TEMA[CARTAS[m.noticia].tema]}</p>
              <CartaGrande id={m.noticia} />
            </div>
          )}
          {m.agenda && (
            <div className="noticia">
              <p className="etiqueta morado">Agenda de Podemos · la sufre el {m.agenda.lider === 'P' ? 'Progresista' : 'Conservador'}</p>
              <CartaGrande id={m.agenda.carta} />
            </div>
          )}
          <Lineas m={m} />
        </>
      );
      break;
    case 'cierre': {
      const enc = m.efectos.find((s): s is Extract<Suceso, { s: 'encuesta' }> => s.s === 'encuesta' && s.zona !== 'CIS');
      const dom = m.efectos.find((s): s is Extract<Suceso, { s: 'dominante' }> => s.s === 'dominante');
      const seg = cronicaSemana(v.cronica, m.semana);
      cuerpo = (
        <>
          <p className="etiqueta">Cierre de la semana {m.semana}</p>
          {enc && <h3>Encuesta de {ZONAS[enc.zona as keyof typeof ZONAS].nombre}: {enc.neto === 0 ? 'empate' : `+${Math.abs(enc.neto)} PV para el ${enc.neto > 0 ? 'Conservador' : 'Progresista'}`}</h3>}
          {dom && <p>Tema de la semana: <b>{NOMBRE_TEMA[dom.tema]}</b>{dom.dueno ? ` (2 PV para el ${dom.dueno === 'P' ? 'Progresista' : 'Conservador'})` : ''}</p>}
          <Lineas m={m} />
          {seg && <Plato segmento={seg} />}
        </>
      );
      break;
    }
    case 'debate': {
      const d = m.debate;
      const fila = (b: 'P' | 'C') => (
        <div className={`debatiente ${b === 'P' ? 'p' : 'c'} ${d.ganador === b ? 'gana' : ''}`}>
          <b>{LIDER[b]}</b>
          <span>{d[b].carta !== null ? citar(CARTAS[d[b].carta!].nombre) : 'sin carta'}</span>
          <span>habla de {NOMBRE_TEMA[d[b].tema]}</span>
          <b className="dato total">{d[b].total}</b>
        </div>
      );
      cuerpo = (
        <>
          <p className="etiqueta">{d.debate === 'cara' ? 'Cara a cara · 16N' : 'Debate a cuatro · 26N'}</p>
          <h3>{d.ganador ? `Gana ${LIDER[d.ganador]}` : 'Empate técnico'}</h3>
          <div className="debate">{fila('P')}{fila('C')}</div>
          <Lineas m={m} />
        </>
      );
      break;
    }
  }
  return (
    <div className="velo-momento" role="dialog" aria-modal="true" onClick={auto ? onSeguir : undefined}>
      <section className={`momento momento-${m.tipo}`} onClick={(ev) => ev.stopPropagation()}>
        <div className="momento-cuerpo">{cuerpo}</div>
        <footer className="momento-pie">
          {auto && <span className="progreso" style={{ transform: `scaleX(${prog})` }} />}
          <button type="button" className="boton principal grande" onClick={onSeguir} data-testid="seguir">{boton}</button>
        </footer>
      </section>
    </div>
  );
}
