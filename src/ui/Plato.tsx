import { useEffect, useRef } from 'react';
import { PLATO } from '../data/plato';
import type { Segmento } from '../narrativa/plato';

const INICIALES = (nombre: string) => nombre.split(' ').map((p) => p[0]).slice(0, 2).join('');

interface Props {
  segmento: Segmento;
  directo?: boolean;
  onCerrar: () => void;
  onAnterior?: () => void;
  onSiguiente?: () => void;
  textoCerrar?: string;
}

/** La conexión con el plató: rótulo, tertulianos y la crónica de la semana. */
export function Plato({ segmento, directo = true, onCerrar, onAnterior, onSiguiente, textoCerrar = 'Volver a la campaña' }: Props) {
  const boton = useRef<HTMLButtonElement>(null);
  useEffect(() => { boton.current?.focus({ preventScroll: true }); }, [segmento]);
  return (
    <div className="velo" role="dialog" aria-modal="true" aria-labelledby="plato-titulo">
      <div className="plato">
        <header className="plato-cabecera">
          <span className="en-directo">{directo ? '● En directo' : 'Diferido'}</span>
          <h2 id="plato-titulo">{segmento.titulo}</h2>
          <span className="cadena">{PLATO.cadena}</span>
        </header>
        <div className="rotulo" aria-label="Rótulo">{segmento.rotulo}</div>
        <ol className="tertulia">
          {segmento.intervenciones.map((x, i) => {
            const p = PLATO.personajes[x.quien];
            return (
              <li key={i} className={`voz voz-${x.quien}`} style={{ animationDelay: `${Math.min(i, 8) * 0.18}s` }}>
                <span className="avatar" aria-hidden="true">{INICIALES(p.nombre)}</span>
                <div>
                  <div className="quien"><b>{p.nombre}</b> <span>{p.rol}</span></div>
                  <p>{x.texto}</p>
                </div>
              </li>
            );
          })}
        </ol>
        <footer className="plato-pie">
          <span className="navegar">
            {onAnterior && <button className="boton pequeno" type="button" onClick={onAnterior}>‹ Semana anterior</button>}
            {onSiguiente && <button className="boton pequeno" type="button" onClick={onSiguiente}>Semana siguiente ›</button>}
          </span>
          <button ref={boton} className="boton principal" type="button" onClick={onCerrar}>{textoCerrar}</button>
        </footer>
      </div>
    </div>
  );
}
