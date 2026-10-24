import { useState } from 'react';
import { ENCUESTADORAS, FUENTE_DATOS, MEDIA_NACIONAL } from '../data/provincias';
import type { Config } from './App';
import { Ayuda } from './Ayuda';

interface Props {
  inicial: Config;
  hayGuardada: boolean;
  onEmpezar: (c: Config) => void;
  onContinuar: () => void;
}

function Opcion<T extends string>({ valor, actual, onElegir, titulo, texto }: { valor: T; actual: T; onElegir: (v: T) => void; titulo: string; texto: string }) {
  return (
    <button type="button" aria-pressed={valor === actual} onClick={() => onElegir(valor)}>
      <b>{titulo}</b>
      <span>{texto}</span>
    </button>
  );
}

export function Menu({ inicial, hayGuardada, onEmpezar, onContinuar }: Props) {
  const [c, setC] = useState<Config>(inicial);
  const [ayuda, setAyuda] = useState(false);
  const m = MEDIA_NACIONAL;
  return (
    <main className="menu">
      <div className="menu-caja">
        <div>
          <h1 className="titulo-176">176</h1>
          <p className="subtitulo">La Batalla del 29N</p>
          <p className="lema">Ocho semanas de campaña, del BOE de la disolución a la noche electoral. Un juego de cartas y presencia territorial al estilo de Twilight Struggle, con D'Hondt de verdad en las 52 circunscripciones.</p>
        </div>
        <div className="opciones-menu">
          <div className="grupo">
            <span className="etiqueta">Modo</span>
            <div className="selector">
              <Opcion valor="ia" actual={c.modo} onElegir={(modo) => setC({ ...c, modo })} titulo="Contra la IA" texto="Un jugador frente al ordenador." />
              <Opcion valor="dos" actual={c.modo} onElegir={(modo) => setC({ ...c, modo })} titulo="Dos jugadores" texto="En el mismo PC; la mano se oculta al pasar el turno." />
            </div>
          </div>
          {c.modo === 'ia' && (
            <>
              <div className="grupo">
                <span className="etiqueta">Tu bando</span>
                <div className="selector">
                  <Opcion valor="P" actual={c.humano} onElegir={(humano) => setC({ ...c, humano })} titulo="Bloque Progresista" texto="PSOE y Frente Amplio. Gobierna, tiene El Voto Útil y necesita a Podemos." />
                  <Opcion valor="C" actual={c.humano} onElegir={(humano) => setC({ ...c, humano })} titulo="Bloque Conservador" texto="PP y Vox. Lideran las encuestas y quieren el cambio." />
                </div>
              </div>
              <div className="grupo">
                <span className="etiqueta">Dificultad</span>
                <div className="selector">
                  <Opcion valor="facil" actual={c.nivel} onElegir={(nivel) => setC({ ...c, nivel })} titulo="Fácil" texto="Comete errores." />
                  <Opcion valor="normal" actual={c.nivel} onElegir={(nivel) => setC({ ...c, nivel })} titulo="Normal" texto="Juega con criterio." />
                  <Opcion valor="dificil" actual={c.nivel} onElegir={(nivel) => setC({ ...c, nivel })} titulo="Difícil" texto="Calcula más cada jugada." />
                </div>
              </div>
            </>
          )}
          <div className="grupo">
            <span className="etiqueta">Escenario</span>
            <div className="selector">
              <Opcion valor="abierto" actual={c.escenario} onElegir={(escenario) => setC({ ...c, escenario })} titulo="Campaña abierta" texto="Las encuestas se desplazan hasta un empate técnico. Partida equilibrada." />
              <Opcion valor="realista" actual={c.escenario} onElegir={(escenario) => setC({ ...c, escenario })} titulo="Encuestas de octubre" texto={`Tal cual: PP ${m.PP} · PSOE ${m.PSOE} · Vox ${m.VOX} · FA ${m.SUMAR} · Podemos ${m.PODEMOS}. El Progresista debe remontar.`} />
            </div>
          </div>
        </div>
        <div className="acciones-menu">
          <button className="boton principal" type="button" onClick={() => onEmpezar(c)}>Disolver las Cortes</button>
          {hayGuardada && <button className="boton" type="button" onClick={onContinuar}>Continuar la partida guardada</button>}
          <button className="boton" type="button" onClick={() => setAyuda(true)}>Cómo se juega</button>
        </div>
        <p className="fuente">{FUENTE_DATOS}: {ENCUESTADORAS.length} encuestadoras. Resultados de 2023 del Ministerio del Interior. Los eventos de las cartas describen temas públicos de forma genérica; no atribuyen hechos a personas.</p>
      </div>
      {ayuda && <Ayuda onCerrar={() => setAyuda(false)} />}
    </main>
  );
}
