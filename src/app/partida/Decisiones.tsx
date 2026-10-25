// Decisiones que no son una jugada: elegir entre opciones de una carta y preparar un debate televisado.
import { useState } from 'react';
import { CARTAS } from '../../data/mazos';
import { NOMBRE_TEMA, TEMAS, temaPropio } from '../../motor/agenda';
import { bonoTemaDebate } from '../../motor/semana';
import { tiene } from '../../motor/maquinaria';
import type { Decision, Estado, Respuesta, Tema } from '../../motor/tipos';
import type { Vista } from '../../motor/vista';
import { CartaGrande, CartaMano } from '../comun/Carta';
import { IconoTema } from '../comun/Iconos';
import { LIDER } from '../textos';

export function DecisionOpcion({ d, onResponder }: { d: Extract<Decision, { tipo: 'opcion' }>; onResponder: (r: Respuesta) => void }) {
  return (
    <div className="velo-momento" role="dialog" aria-modal="true">
      <section className="momento">
        <div className="momento-cuerpo">
          <p className="etiqueta">Te toca elegir</p>
          {d.carta !== undefined && CARTAS[d.carta] && <CartaGrande id={d.carta} />}
          <div className="opciones">
            {d.opciones.map((o, i) => (
              <button key={i} type="button" className="boton grande" onClick={() => onResponder({ tipo: 'opcion', i })} data-testid={`opcion-${i}`}>{o}</button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export function DecisionDebate({ v, d, onResponder }: { v: Vista; d: Extract<Decision, { tipo: 'debate' }>; onResponder: (r: Respuesta) => void }) {
  const mejor = [...d.cartas].sort((a, b) => CARTAS[b].fuerza - CARTAS[a].fuerza)[0] ?? null;
  const [carta, setCarta] = useState<number | null>(mejor);
  const temaInicial = [...TEMAS].sort((a, b) => bonoTemaDebate(v as unknown as Estado, v.yo, b) - bonoTemaDebate(v as unknown as Estado, v.yo, a) || Number(temaPropio(v, b, v.yo)) - Number(temaPropio(v, a, v.yo)))[0];
  const [tema, setTema] = useState<Tema>(temaInicial);
  const bono = bonoTemaDebate(v as unknown as Estado, v.yo, tema) + (tiene(v, v.yo, 'medios', 3) ? 2 : 0);
  const total = (carta !== null ? CARTAS[carta].fuerza : 0) + bono;
  return (
    <div className="velo-momento" role="dialog" aria-modal="true">
      <section className="momento">
        <div className="momento-cuerpo">
          <p className="etiqueta">{d.debate === 'cara' ? 'Cara a cara' : 'Debate a cuatro'} · {LIDER[v.yo]} se prepara</p>
          <h3>Elige una carta (cuenta su fuerza) y el tema que vas a llevar</h3>
          <div className="mano-cartas debate-cartas">
            {d.cartas.map((id) => <CartaMano key={id} id={id} de={v.yo} seleccionada={carta === id} onClick={() => setCarta(id)} />)}
          </div>
          <div className="temas-debate">
            {TEMAS.map((t) => {
              const b = bonoTemaDebate(v as unknown as Estado, v.yo, t);
              return (
                <button key={t} type="button" className={`chip-tema ${tema === t ? 'on' : ''} ${temaPropio(v, t, v.yo) ? 'mio' : ''}`} onClick={() => setTema(t)}>
                  <IconoTema tema={t} size={14} /> {NOMBRE_TEMA[t]} {b > 0 && <b>+{b}</b>}
                </button>
              );
            })}
          </div>
          <p className="pista">Llevas {total} + un dado. Gana quien más saque: la diferencia son PV (máx. {d.debate === 'cara' ? 3 : 2}) y su tema sube 2 de calor. La carta se descarta.</p>
        </div>
        <footer className="momento-pie">
          <button type="button" className="boton principal grande" onClick={() => onResponder({ tipo: 'debate', carta, tema })} data-testid="debatir">Al plató</button>
        </footer>
      </section>
    </div>
  );
}
