// La mano: un carrusel abajo, al alcance del pulgar. Incluye la acción básica (sin carta).
import { memo } from 'react';
import type { IdCarta } from '../../motor/tipos';
import type { Vista } from '../../motor/vista';
import { CartaMano } from '../comun/Carta';
import { PARTIDO_BLOQUE } from '../textos';
import { RIVAL } from '../../motor/base';

interface Props {
  v: Vista;
  /** se puede jugar ahora (es mi acción y no hay nada pendiente de contar) */
  activa: boolean;
  pensando: boolean;
  sel: IdCarta | null;
  onCarta: (id: IdCarta) => void;
}

export const Mano = memo(function Mano({ v, activa, pensando, sel, onCarta }: Props) {
  const d = v.pendiente?.tipo === 'accion' ? v.pendiente : null;
  const pc = (id: IdCarta) => d?.opciones.find((o) => o.carta === id)?.pc;
  const pegada = d?.opciones.some((o) => o.carta === 'pegada');
  const rival = RIVAL[v.yo];
  const estado = d
    ? pegada ? 'Pegada de carteles: 2 PC gratis para implantarte' : `Tu jugada · te quedan ${d.quedan}`
    : v.esperando === rival ? `${pensando ? 'El' : 'Turno del'} ${PARTIDO_BLOQUE[rival]}${pensando ? ' piensa…' : ''}` : v.ganador ? 'Fin de la campaña' : '';
  return (
    <section className={`mano ${activa ? 'activa' : ''}`} aria-label="Tu mano">
      <div className="mano-estado">
        <span className={pensando ? 'pensando' : ''}>{estado}</span>
        <span className="tenue dato">{v.manoRival} cartas rival</span>
      </div>
      <div className="mano-cartas" data-testid="mano">
        {pegada ? (
          <button type="button" className={`carta-mano carta-especial ${sel === 'pegada' ? 'sel' : ''}`} onClick={() => onCarta('pegada')} data-testid="carta-pegada">
            <span className="carta-cab"><span className="fuerza dato">2</span></span>
            <span className="carta-nombre">Pegada de carteles</span>
            <span className="carta-pie">Implantar gratis</span>
          </button>
        ) : (
          <>
            {v.mano.map((id) => (
              <CartaMano key={id} id={id} de={v.yo} pc={pc(id)} seleccionada={sel === id} apagada={!activa} onClick={() => onCarta(id)} />
            ))}
            <button type="button" className={`carta-mano carta-especial ${sel === 'basica' ? 'sel' : ''} ${!activa ? 'apagada' : ''}`} onClick={() => onCarta('basica')} data-testid="carta-basica">
              <span className="carta-cab"><span className="fuerza dato">{pc('basica') ?? 1}</span></span>
              <span className="carta-nombre">Acción básica</span>
              <span className="carta-pie">Sin carta: implantar o agenda</span>
            </button>
          </>
        )}
      </div>
    </section>
  );
});
