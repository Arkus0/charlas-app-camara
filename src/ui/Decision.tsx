import { CARTAS } from '../data/cartas';
import { CORTO_BANDO, PARTIDOS } from '../data/partidos';
import { bajaClima } from '../ai/evaluar';
import { fmtAfin } from '../engine/motor';
import { CARRERA, eventoJugable } from '../engine/reglas';
import type { Bando, Estado, Operacion, Respuesta, Uso } from '../engine/tipos';
import { RIVAL } from '../engine/tipos';

const OPS: Record<Operacion, { t: string; d: string }> = {
  presencia: { t: 'Presencia', d: '1 PC por punto (2 donde manda el rival). Solo en provincias con tu presencia, vecinas o Madrid.' },
  ofensiva: { t: 'Ofensiva', d: 'Dado + PC − 2 × Fidelidad: quitas presencia rival. Cuenta para la Exigencia; en una clave baja el Clima.' },
  debate: { t: 'Debate local', d: 'Un duelo de dados por cada PC; ganan las vecinas controladas, tener más presencia y el feudo.' },
  negociacion: { t: 'Negociar', d: '2 PC por paso de afinidad de una fuerza regional en cuyo territorio tengas presencia.' },
};

interface Props {
  e: Estado;
  humano: (b: Bando) => boolean;
  seleccion: number | null;
  onResponder: (r: Respuesta) => void;
  onSeleccion: (id: number | null) => void;
}

export function Decision({ e, humano, seleccion, onResponder, onSeleccion }: Props) {
  const d = e.pendiente;
  if (e.ganador) return <div className="caja decision"><div className="texto-d">La noche electoral ha terminado.</div></div>;
  if (!d) return <div className="caja decision"><div className="pensando">Avanzando</div></div>;
  const b = d.bando;
  if (!humano(b)) {
    return (
      <div className="caja decision">
        <span className={`etiqueta ${b === 'P' ? 'p' : 'c'}`}>{CORTO_BANDO[b]} (IA)</span>
        <div className="pensando">Preparando su jugada</div>
      </div>
    );
  }
  const cab = <span className={`etiqueta ${b === 'P' ? 'p' : 'c'}`}>Decide: Bloque {CORTO_BANDO[b]}</span>;

  switch (d.tipo) {
    case 'provincia':
      return (
        <div className="caja decision">
          {cab}
          <div className="texto-d">{d.texto}</div>
          <div className="hito" style={{ fontSize: 12, color: 'var(--tenue)' }}>Pulsa una provincia resaltada en el mapa ({d.opciones.length} posibles).</div>
          {d.opcional && <div className="botones"><button className="boton" type="button" onClick={() => onResponder({ tipo: 'provincia', id: null })}>Terminar aquí</button></div>}
        </div>
      );

    case 'operacion':
      return (
        <div className="caja decision">
          {cab}
          <div className="texto-d">{d.texto}</div>
          <div className="botones" style={{ display: 'grid', gap: 6 }}>
            {d.opciones.map((op) => (
              <button key={op} className="boton" type="button" style={{ textAlign: 'left' }} onClick={() => onResponder({ tipo: 'operacion', op })}>
                <b>{OPS[op].t}</b>
                <div style={{ fontFamily: 'var(--f-texto)', fontWeight: 400, fontSize: 12, color: 'var(--tenue)' }}>{OPS[op].d}</div>
              </button>
            ))}
          </div>
        </div>
      );

    case 'opcion':
      return (
        <div className="caja decision">
          {cab}
          <div className="texto-d">{d.texto}</div>
          <div className="botones" style={{ display: 'grid', gap: 6 }}>
            {d.opciones.map((o, i) => <button key={i} className="boton" type="button" style={{ textAlign: 'left' }} onClick={() => onResponder({ tipo: 'opcion', i })}>{o}</button>)}
          </div>
        </div>
      );

    case 'partido':
      return (
        <div className="caja decision">
          {cab}
          <div className="texto-d">{d.texto}</div>
          <div className="botones">
            {d.opciones.map((k) => (
              <button key={k} className="boton" type="button" onClick={() => onResponder({ tipo: 'partido', id: k })}>
                {PARTIDOS[k].siglas} <span className="dato" style={{ color: 'var(--tenue)' }}>{k === 'PODEMOS' ? `humor ${e.podemos.humor > 0 ? '+' : ''}${e.podemos.humor} · cuesta 1 PV` : fmtAfin(e.afinidad[k])}</span>
              </button>
            ))}
            {d.opcional && <button className="boton" type="button" onClick={() => onResponder({ tipo: 'partido', id: null })}>Terminar</button>}
          </div>
        </div>
      );

    case 'carta': {
      const sel = seleccion !== null && d.opciones.includes(seleccion) ? seleccion : null;
      if (sel === null) {
        return (
          <div className="caja decision">
            {cab}
            <div className="texto-d">{d.texto}</div>
            <div className="hito" style={{ fontSize: 12, color: 'var(--tenue)' }}>Elige una carta de tu mano.</div>
            {d.opcional && <div className="botones"><button className="boton" type="button" onClick={() => onResponder({ tipo: 'carta', carta: null })}>No descartar</button></div>}
          </div>
        );
      }
      const c = CARTAS[sel];
      const esRival = c.lado === RIVAL[b];
      const esComodin = c.lado === 'W';
      const peligro = (uso: Uso) => {
        const disparaEvento = uso === 'evento' ? c.lado !== 'E' : uso === 'ops' && (esRival || esComodin) && eventoJugable(e, sel, b);
        return disparaEvento && bajaClima(sel) && e.clima <= 2;
      };
      const elegir = (uso?: Uso) => { onResponder({ tipo: 'carta', carta: sel, uso }); onSeleccion(null); };
      if (d.proposito === 'accion') {
        const usos = d.usos[sel] ?? [];
        const sig = CARRERA[e.carrera[b]];
        return (
          <div className="caja decision">
            {cab}
            <div className="texto-d"><b>{c.nombre}</b>{c.lado !== 'E' ? ` · ${c.ops} PC` : ''}</div>
            <div className="botones" style={{ display: 'grid', gap: 6 }}>
              {usos.includes('evento') && (
                <button className="boton principal" type="button" onClick={() => elegir('evento')}>{c.lado === 'E' ? 'Publicar la encuesta' : 'Jugar el evento'}</button>
              )}
              {usos.includes('ops') && (
                <button className="boton" type="button" onClick={() => elegir('ops')}>Usar {c.ops} PC{sel === 0 ? ' (+1 en provincias pequeñas)' : ''}</button>
              )}
              {usos.includes('carrera') && sig && (
                <button className="boton" type="button" onClick={() => elegir('carrera')}>Carrera: «{sig.nombre}» (éxito con {sig.tirada} o menos)</button>
              )}
            </div>
            {esRival && usos.includes('ops') && eventoJugable(e, sel, b) && <div className="aviso">Si usas sus PC se activará el evento del rival: {c.texto}</div>}
            {esComodin && usos.includes('ops') && <div className="aviso">Comodín de Podemos: aunque uses sus PC, su evento se activa igualmente.</div>}
            {(esRival || esComodin) && usos.includes('carrera') && <div className="hito" style={{ fontSize: 12, color: 'var(--tenue)' }}>En la Carrera, el evento no se activa.</div>}
            {(peligro('evento') || peligro('ops')) && <div className="aviso"><b>¡Peligro!</b> Este evento baja el Clima a 1 en tu ronda: perderías la partida por Ruptura.</div>}
            <div className="botones"><button className="boton pequeno" type="button" onClick={() => onSeleccion(null)}>Elegir otra carta</button></div>
          </div>
        );
      }
      const textoBoton = d.proposito === 'portada' ? 'Elegir como Portada' : d.proposito === 'debate' ? `Llevar al debate (${c.ops} PC)` : 'Descartar';
      return (
        <div className="caja decision">
          {cab}
          <div className="texto-d">{d.texto}</div>
          <div className="texto-d"><b>{c.nombre}</b></div>
          <div className="botones">
            <button className="boton principal" type="button" onClick={() => elegir(d.proposito === 'portada' ? 'evento' : undefined)}>{textoBoton}</button>
            {d.opcional && <button className="boton" type="button" onClick={() => { onResponder({ tipo: 'carta', carta: null }); onSeleccion(null); }}>No descartar</button>}
          </div>
          {d.proposito === 'portada' && esRival && <div className="aviso">Es una carta del rival: su evento le beneficiará a él.</div>}
          {d.proposito === 'portada' && peligro('evento') && <div className="aviso"><b>¡Peligro!</b> Este evento bajaría el Clima a 1.</div>}
        </div>
      );
    }
  }
}
