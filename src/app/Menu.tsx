// Menú principal: partida contra la IA (bando y dificultad) y, más adelante, partidas online.
import { useState } from 'react';
import type { Nivel } from '../ia/bot';
import type { Bando } from '../motor/base';
import { Ayuda } from './Ayuda';
import type { ConfigLocal } from './local';

interface Props {
  inicial: ConfigLocal;
  hayGuardada: boolean;
  onEmpezar: (c: ConfigLocal) => void;
  onContinuar: () => void;
  /** online disponible (si hay servidor configurado) */
  online?: () => void;
}

const NIVELES: { id: Nivel; nombre: string; texto: string }[] = [
  { id: 'facil', nombre: 'Fácil', texto: 'Comete errores' },
  { id: 'normal', nombre: 'Normal', texto: 'Juega con criterio' },
  { id: 'dificil', nombre: 'Difícil', texto: 'Piensa tu respuesta' },
];

export function Menu({ inicial, hayGuardada, onEmpezar, onContinuar, online }: Props) {
  const [humano, setHumano] = useState<Bando>(inicial.humano);
  const [nivel, setNivel] = useState<Nivel>(inicial.nivel);
  const [ayuda, setAyuda] = useState(false);
  return (
    <main className="menu">
      <h1 className="logo" aria-label="176"><span className="p">17</span><span className="c">6</span></h1>
      <p className="subtitulo">La Batalla del 29N</p>
      <p className="lema">Ocho semanas de campaña en tu móvil. Marca la agenda, gana provincias y suma los 176 apoyos que hacen falta en el Congreso.</p>
      {hayGuardada && <button type="button" className="boton principal grande" onClick={onContinuar} data-testid="continuar">Continuar la campaña</button>}
      <section className="grupo">
        <h2 className="etiqueta">Tu bando</h2>
        <div className="selector dos">
          <button type="button" className={`opcion-menu p ${humano === 'P' ? 'on' : ''}`} onClick={() => setHumano('P')}>
            <b>Progresista</b><span>Sánchez · PSOE y Frente Amplio. Gobierna.</span>
          </button>
          <button type="button" className={`opcion-menu c ${humano === 'C' ? 'on' : ''}`} onClick={() => setHumano('C')}>
            <b>Conservador</b><span>Feijóo · PP y Vox. Quiere el cambio.</span>
          </button>
        </div>
      </section>
      <section className="grupo">
        <h2 className="etiqueta">Dificultad</h2>
        <div className="selector tres">
          {NIVELES.map((n) => (
            <button key={n.id} type="button" className={`opcion-menu ${nivel === n.id ? 'on' : ''}`} onClick={() => setNivel(n.id)}>
              <b>{n.nombre}</b><span>{n.texto}</span>
            </button>
          ))}
        </div>
      </section>
      <button type="button" className="boton principal grande" onClick={() => onEmpezar({ humano, nivel })} data-testid="empezar">Contra la IA: disolver las Cortes</button>
      {online && <button type="button" className="boton grande" onClick={online} data-testid="online">Online con un amigo</button>}
      <button type="button" className="boton grande" onClick={() => setAyuda(true)}>Cómo se juega</button>
      <p className="fuente">Datos: media de 16 encuestas de octubre de 2026 repartida por provincias (ElectoPanel) y resultados de 2023 del Ministerio del Interior. Las cartas con noticia describen hechos públicos.</p>
      {ayuda && <Ayuda onCerrar={() => setAyuda(false)} />}
    </main>
  );
}
