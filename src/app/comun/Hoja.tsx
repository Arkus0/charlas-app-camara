// Hoja inferior: sube desde abajo, se cierra tocando fuera o arrastrando hacia abajo desde la cabecera.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icono, ICONO } from './Iconos';

interface Props {
  titulo: ReactNode;
  onCerrar?: () => void;
  /** media: deja ver el mapa encima; alta: casi toda la pantalla */
  alto?: 'media' | 'alta';
  pie?: ReactNode;
  children: ReactNode;
  etiqueta?: string;
}

export function Hoja({ titulo, onCerrar, alto = 'alta', pie, children, etiqueta }: Props) {
  const [arrastre, setArrastre] = useState(0);
  const inicio = useRef<number | null>(null);
  useEffect(() => {
    if (!onCerrar) return;
    const tecla = (ev: KeyboardEvent) => { if (ev.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCerrar]);
  return (
    <div className={`velo-hoja ${alto}`} onClick={onCerrar} role="presentation">
      <section
        className="hoja"
        role="dialog"
        aria-modal="true"
        aria-label={etiqueta ?? (typeof titulo === 'string' ? titulo : undefined)}
        onClick={(ev) => ev.stopPropagation()}
        style={arrastre ? { transform: `translateY(${arrastre}px)`, transition: 'none' } : undefined}
      >
        <header
          className="hoja-cab"
          onPointerDown={(ev) => { if (onCerrar) { inicio.current = ev.clientY; (ev.target as Element).setPointerCapture?.(ev.pointerId); } }}
          onPointerMove={(ev) => { if (inicio.current !== null) setArrastre(Math.max(0, ev.clientY - inicio.current)); }}
          onPointerUp={() => { if (inicio.current !== null && arrastre > 90) onCerrar?.(); inicio.current = null; setArrastre(0); }}
          onPointerCancel={() => { inicio.current = null; setArrastre(0); }}
        >
          <span className="asa" aria-hidden="true" />
          <div className="hoja-titulo">{titulo}</div>
          {onCerrar && (
            <button className="boton-icono" type="button" onClick={onCerrar} aria-label="Cerrar">
              <Icono d={ICONO.cerrar} />
            </button>
          )}
        </header>
        <div className="hoja-cuerpo">{children}</div>
        {pie && <footer className="hoja-pie">{pie}</footer>}
      </section>
    </div>
  );
}
