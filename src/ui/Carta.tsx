import { CARTAS } from '../data/cartas';
import { ZONAS } from '../data/provincias';

const LADO_TXT: Record<string, string> = { P: 'Progresista', C: 'Conservador', N: 'Neutral', E: 'Encuesta' };
const MAZO_TXT: Record<number, string> = { 0: 'Especial', 1: 'Precampaña', 2: 'Campaña', 3: 'Recta final' };

interface Props {
  id: number;
  seleccionada?: boolean;
  inactiva?: boolean;
  grande?: boolean;
  onClick?: () => void;
  onHover?: (id: number | null) => void;
}

export function Carta({ id, seleccionada, inactiva, grande, onClick, onHover }: Props) {
  const c = CARTAS[id];
  const clases = ['carta', `lado-${c.lado}`, seleccionada ? 'sel' : '', inactiva ? 'inactiva' : '', grande ? 'grande' : ''].join(' ');
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={clases}
      onClick={inactiva ? undefined : onClick}
      onMouseEnter={onHover ? () => onHover(id) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      aria-pressed={onClick ? !!seleccionada : undefined}
      aria-label={`${c.nombre}, ${c.lado === 'E' ? 'encuesta' : `${c.ops} PC, evento ${LADO_TXT[c.lado].toLowerCase()}`}`}
      type={onClick ? 'button' : undefined}
    >
      <div className="banda">
        {c.lado !== 'E' && <span className="ops dato">{c.ops}</span>}
        <span className="lado-txt">{c.lado === 'E' ? (c.zona ? `Encuesta · ${ZONAS[c.zona].nombre}` : 'Encuesta nacional') : LADO_TXT[c.lado]}</span>
      </div>
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

export function Dorso({ n }: { n?: number }) {
  return <div className="carta dorso" aria-label="Carta boca abajo">{n !== undefined ? n : '176'}</div>;
}
