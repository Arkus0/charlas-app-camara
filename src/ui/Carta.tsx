import { useState } from 'react';
import { CARTAS } from '../data/cartas';
import { ZONAS } from '../data/provincias';

// Las ilustraciones de src/assets/cartas/<id>.png|jpg|webp, ya convertidas a WebP ligero en src/assets/web/cartas
// (scripts/preparar-ilustraciones.mjs), se empaquetan al compilar
const ARCHIVOS = import.meta.glob('../assets/web/cartas/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const IMAGEN: Record<number, string> = {};
for (const [ruta, url] of Object.entries(ARCHIVOS)) {
  const m = ruta.match(/(\d+)\.webp$/);
  if (m) IMAGEN[Number(m[1])] = url;
}

const LADO_TXT: Record<string, string> = { P: 'Progresista', C: 'Conservador', N: 'Neutral', E: 'Encuesta', W: 'Comodín · Podemos', A: 'Agenda de Podemos' };
const MAZO_TXT: Record<number, string> = { 0: 'Especial', 1: 'Precampaña', 2: 'Campaña', 3: 'Recta final', 4: 'Agenda de Podemos' };


interface Props {
  id: number;
  seleccionada?: boolean;
  inactiva?: boolean;
  grande?: boolean;
  onClick?: () => void;
  onHover?: (id: number | null) => void;
}

/** Ilustración de la carta o, si aún no existe, un marcador con la escena que hay que dibujar. */
function Ilustracion({ id, grande }: { id: number; grande?: boolean }) {
  const c = CARTAS[id];
  const [rota, setRota] = useState(false);
  const url = IMAGEN[id];
  if (!url || rota) {
    return (
      <div className={`arte marcador-arte lado-${c.lado}`} aria-hidden={!grande}>
        {grande ? <span className="escena">{c.escena}</span> : null}
      </div>
    );
  }
  return (
    <div className="arte">
      <img src={url} alt={grande ? c.escena : ''} loading="lazy" onError={() => setRota(true)} />
    </div>
  );
}

export function Carta({ id, seleccionada, inactiva, grande, onClick, onHover }: Props) {
  const c = CARTAS[id];
  const clases = ['carta', `lado-${c.lado}`, seleccionada ? 'sel' : '', inactiva ? 'inactiva' : '', grande ? 'grande' : '', c.noticia ? 'noticia' : ''].join(' ');
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={clases}
      onClick={inactiva ? undefined : onClick}
      onMouseEnter={onHover ? () => onHover(id) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      aria-pressed={onClick ? !!seleccionada : undefined}
      aria-label={`${c.nombre}, ${c.lado === 'E' ? 'encuesta' : c.lado === 'A' ? 'agenda de Podemos' : `${c.ops} PC, evento ${LADO_TXT[c.lado].toLowerCase()}`}`}
      type={onClick ? 'button' : undefined}
    >
      <div className="banda">
        {c.lado !== 'E' && c.lado !== 'A' && <span className="ops dato">{c.ops}</span>}
        <span className="lado-txt">{c.lado === 'E' ? (c.zona ? `Encuesta · ${ZONAS[c.zona].nombre}` : 'Encuesta nacional') : LADO_TXT[c.lado]}</span>
        {c.noticia && <span className="sello-noticia">Noticia</span>}
      </div>
      <Ilustracion id={id} grande={grande} />
      <h5>{c.nombre}{c.retirar ? ' *' : ''}</h5>
      <div>
        <div className="ev">{c.texto}</div>
        {grande && <div className="ctx">{c.contexto}</div>}
      </div>
      <div className="pie">
        <span>{MAZO_TXT[c.mazo]}</span>
        <span>{c.retirar ? '* Se retira tras el evento' : id === 0 ? 'Pasa al rival' : ''}</span>
      </div>
    </Tag>
  );
}

/** Fila compacta para elegir cartas que no están en tu mano (descarte, mano rival, carta fichada). */
export function CartaFila({ id, seleccionada, onClick, onHover }: { id: number; seleccionada: boolean; onClick: () => void; onHover?: (id: number | null) => void }) {
  const c = CARTAS[id];
  return (
    <button
      type="button"
      className={`carta-fila lado-${c.lado} ${seleccionada ? 'sel' : ''}`}
      onClick={onClick}
      onMouseEnter={onHover ? () => onHover(id) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      aria-pressed={seleccionada}
    >
      <span className="ops dato">{c.lado === 'E' ? 'E' : c.ops}</span>
      <span className="nombre">{c.nombre}</span>
      <span className="lado">{LADO_TXT[c.lado]}</span>
    </button>
  );
}

export function Dorso({ n }: { n?: number }) {
  return <div className="carta dorso" aria-label="Carta boca abajo">{n !== undefined ? n : '176'}</div>;
}
