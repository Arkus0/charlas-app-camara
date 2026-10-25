// La carta: papeleta con la fuerza, el tema y el evento. Si existe su ilustración (src/assets/cartas/<id>),
// se muestra; si no, un fondo del color del mazo.
import { useState } from 'react';
import { CARTAS, idArte } from '../../data/mazos';
import { DUENO_TEMA, NOMBRE_TEMA } from '../../motor/agenda';
import type { Bando } from '../../motor/base';
import { IconoTema } from './Iconos';

const ARCHIVOS = import.meta.glob('../../assets/web/cartas/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const IMAGEN: Record<number, string> = {};
for (const [ruta, url] of Object.entries(ARCHIVOS)) {
  const m = ruta.match(/(\d+)\.webp$/);
  if (m) IMAGEN[Number(m[1])] = url;
}

export const MAZO_TXT = { P: 'Progresista', C: 'Conservador', actualidad: 'Noticia de la semana', podemos: 'Agenda de Podemos' } as const;
const FASE_TXT = { 1: 'Precampaña', 2: 'Campaña', 3: 'Recta final' } as const;

/** ¿El tema de la carta es del rival de quien la tiene? (jugarla le da calor) */
export function temaAjeno(id: number, b: Bando): boolean {
  const t = CARTAS[id].tema;
  return t !== 'COR' && DUENO_TEMA[t] !== b;
}

export function Ilustracion({ id, className = '' }: { id: number; className?: string }) {
  const c = CARTAS[id];
  const [rota, setRota] = useState(false);
  const url = IMAGEN[idArte(c)];
  if (!url || rota) return <div className={`arte arte-${c.mazo} ${className}`} aria-hidden="true" />;
  return <img className={`arte ${className}`} src={url} alt="" loading="lazy" onError={() => setRota(true)} />;
}

interface Props {
  id: number;
  /** quién la tiene en la mano (para avisar si el tema es del rival) */
  de?: Bando;
  pc?: number;
  seleccionada?: boolean;
  apagada?: boolean;
  onClick?: () => void;
}

/** La carta en la mano: compacta, pensada para el pulgar. */
export function CartaMano({ id, de, pc, seleccionada, apagada, onClick }: Props) {
  const c = CARTAS[id];
  const ajeno = de ? temaAjeno(id, de) : false;
  return (
    <button
      type="button"
      className={`carta-mano mazo-${c.mazo} ${seleccionada ? 'sel' : ''} ${apagada ? 'apagada' : ''}`}
      onClick={onClick}
      data-testid={`carta-${id}`}
      aria-label={`${c.nombre}, fuerza ${c.fuerza}, tema ${NOMBRE_TEMA[c.tema]}`}
    >
      <Ilustracion id={id} />
      <span className="carta-cab">
        <span className="fuerza dato">{pc ?? c.fuerza}</span>
        <span className={`tema-carta tema-${c.tema} ${ajeno ? 'ajeno' : ''}`} title={NOMBRE_TEMA[c.tema]}>
          <IconoTema tema={c.tema} size={15} />
        </span>
      </span>
      <span className="carta-nombre">{c.nombre}</span>
      {ajeno && <span className="aviso-tema">Tema del rival</span>}
    </button>
  );
}

/** La carta entera, para el detalle. */
export function CartaGrande({ id, de }: { id: number; de?: Bando }) {
  const c = CARTAS[id];
  const ajeno = de ? temaAjeno(id, de) : false;
  return (
    <article className={`carta-grande mazo-${c.mazo}`}>
      <Ilustracion id={id} />
      <div className="carta-grande-cuerpo">
        <div className="carta-grande-cab">
          {c.fuerza > 0 && <span className="fuerza dato">{c.fuerza}</span>}
          <span className={`tema-carta tema-${c.tema} ${ajeno ? 'ajeno' : ''}`}><IconoTema tema={c.tema} size={15} /> {NOMBRE_TEMA[c.tema]}</span>
          <span className="etiqueta">{c.mazo === 'P' || c.mazo === 'C' ? FASE_TXT[c.fase] : MAZO_TXT[c.mazo]}{c.noticia ? ' · noticia real' : ''}</span>
        </div>
        <h3>{c.nombre}</h3>
        <p className="carta-texto">{c.texto}</p>
        <p className="carta-contexto">{c.contexto}</p>
        {ajeno && <p className="aviso">Es un tema de tu rival: si la juegas, le das calor a su conversación.</p>}
      </div>
    </article>
  );
}
