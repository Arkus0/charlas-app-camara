import { useCallback, useEffect, useMemo, useState } from 'react';
import { decidirIA } from '../ai/bot';
import { CARTAS } from '../data/cartas';
import { CORTO_BANDO, NOMBRE_BANDO, PARTIDOS } from '../data/partidos';
import { PROV, PROVINCIAS, ZONAS } from '../data/provincias';
import { controlDe, proyectar, votosProvincia } from '../engine/electoral';
import { clonar, responder } from '../engine/motor';
import type { Bando, Estado, PartidoId, Respuesta } from '../engine/tipos';
import { RIVAL } from '../engine/tipos';
import type { Config } from './App';
import { Ayuda } from './Ayuda';
import { Carta, Dorso } from './Carta';
import { Decision } from './Decision';
import { Afinidades, Escrutinio, Registro } from './Lateral';
import { Mapa } from './Mapa';
import { Marcadores } from './Marcadores';
import { Noche } from './Noche';

interface Props {
  config: Config;
  estado: Estado;
  onEstado: (e: Estado) => void;
  onMenu: () => void;
  onNueva: () => void;
}

const USO_TXT: Record<string, string> = { evento: 'como evento', ops: 'por sus PC', carrera: 'en la Carrera' };

export function Partida({ config, estado, onEstado, onMenu, onNueva }: Props) {
  const [sel, setSel] = useState<number | null>(null);
  const [vista, setVista] = useState<Bando>(config.modo === 'ia' ? config.humano : 'P');
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [cartaHover, setCartaHover] = useState<number | null>(null);
  const [ayuda, setAyuda] = useState(false);
  const [verTablero, setVerTablero] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const humano = useCallback((b: Bando) => config.modo === 'dos' || b === config.humano, [config]);
  const proy = useMemo(() => proyectar(PROVINCIAS, estado), [estado]);

  const aplicar = useCallback((r: Respuesta) => {
    try {
      const n = clonar(estado);
      responder(n, r);
      onEstado(n);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [estado, onEstado]);

  // turno de la IA
  useEffect(() => {
    const d = estado.pendiente;
    if (!d || estado.ganador || humano(d.bando)) return;
    const rapido = typeof location !== 'undefined' && location.hash === '#rapido';
    const espera = rapido ? 0 : d.tipo === 'carta' ? 850 : d.tipo === 'provincia' ? 360 : 550;
    const t = setTimeout(() => aplicar(decidirIA(estado, config.nivel)), espera);
    return () => clearTimeout(t);
  }, [estado, humano, aplicar, config.nivel]);

  const d = estado.pendiente;
  const cortina = config.modo === 'dos' && !!d && !estado.ganador && d.bando !== vista;
  const decideYo = !!d && humano(d.bando) && d.bando === vista && !cortina;
  const opcionesMapa = decideYo && d!.tipo === 'provincia' ? new Set(d!.opciones) : null;
  const cartasElegibles = decideYo && d!.tipo === 'carta' ? new Set(d!.opciones) : null;

  const onHoverProv = useCallback((id: string | null, x: number, y: number) => setHover(id ? { id, x, y } : null), []);
  const onElegirProv = useCallback((id: string) => aplicar({ tipo: 'provincia', id }), [aplicar]);

  if (estado.ganador && !verTablero) {
    return <Noche e={estado} humano={config.modo === 'ia' ? config.humano : null} onNueva={onNueva} onTablero={() => setVerTablero(true)} />;
  }

  const mano = [...estado.manos[vista]];
  const tieneVotoUtil = estado.votoUtil.duenio === vista;
  const rival = RIVAL[vista];

  return (
    <div className="partida">
      <Marcadores e={estado} onAyuda={() => setAyuda(true)} onMenu={onMenu} />
      <div className="centro">
        <section className="caja zona-mapa" aria-label="Tablero">
          <Mapa estado={estado} opciones={opcionesMapa} onElegir={onElegirProv} onHover={onHoverProv} />
          <div className="jugada-flotante">
            {cartaHover !== null ? (
              <Carta id={cartaHover} grande />
            ) : estado.ultimaJugada ? (
              <>
                <span className="quien"><b className={estado.ultimaJugada.bando === 'P' ? 'p' : 'c'}>{CORTO_BANDO[estado.ultimaJugada.bando]}</b> ha jugado {USO_TXT[estado.ultimaJugada.uso]}</span>
                <Carta id={estado.ultimaJugada.carta} />
              </>
            ) : null}
          </div>
          {estado.ganador && verTablero && (
            <div style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 4 }}>
              <button className="boton principal" type="button" onClick={() => setVerTablero(false)}>Volver a los resultados</button>
            </div>
          )}
        </section>
        <aside className="lateral">
          <Escrutinio r={proy} />
          <Afinidades e={estado} r={proy} />
          <Registro log={estado.log} />
        </aside>
      </div>
      <div className="inferior">
        <section className="caja mano" aria-label={`Mano del Bloque ${CORTO_BANDO[vista]}`}>
          {cortina ? (
            <div className="mano-vacia">Mano oculta.</div>
          ) : (
            <>
              {mano.length === 0 && !tieneVotoUtil && <div className="mano-vacia">Sin cartas en la mano.</div>}
              {mano.map((id) => (
                <Carta
                  key={id}
                  id={id}
                  seleccionada={sel === id}
                  inactiva={!cartasElegibles?.has(id)}
                  onClick={() => setSel(sel === id ? null : id)}
                  onHover={setCartaHover}
                />
              ))}
              {tieneVotoUtil && (
                <Carta
                  id={0}
                  seleccionada={sel === 0}
                  inactiva={!cartasElegibles?.has(0)}
                  onClick={() => setSel(sel === 0 ? null : 0)}
                  onHover={setCartaHover}
                />
              )}
              <div style={{ display: 'grid', gap: 6, alignContent: 'start', minWidth: 120 }}>
                <span className="etiqueta">Mano rival</span>
                {estado.manoVista[vista] ? (
                  <div style={{ display: 'grid', gap: 3, fontSize: 12 }}>
                    {estado.manos[rival].map((id) => <span key={id}>{CARTAS[id].nombre} <span className="dato" style={{ color: 'var(--tenue)' }}>{CARTAS[id].ops}</span></span>)}
                  </div>
                ) : (
                  <Dorso n={estado.manos[rival].length} />
                )}
              </div>
            </>
          )}
        </section>
        <Decision e={estado} humano={(b) => humano(b) && (config.modo === 'ia' || b === vista)} seleccion={sel} onResponder={aplicar} onSeleccion={setSel} />
      </div>
      {error && <div className="velo" onClick={() => setError(null)}><div className="caja dialogo"><h2>Jugada no válida</h2><p>{error}</p><button className="boton" type="button">Seguir</button></div></div>}
      {cortina && d && (
        <div className="velo" role="dialog" aria-modal="true">
          <div className="caja dialogo" style={{ textAlign: 'center', justifyItems: 'center' }}>
            <span className="etiqueta">Pasa el ordenador</span>
            <h2 className={d.bando === 'P' ? 'p' : 'c'}>Turno del {NOMBRE_BANDO[d.bando]}</h2>
            <p>{d.texto}</p>
            <button className="boton principal" type="button" onClick={() => { setVista(d.bando); setSel(null); }}>Soy el {CORTO_BANDO[d.bando]}: ver mi mano</button>
          </div>
        </div>
      )}
      {ayuda && <Ayuda onCerrar={() => setAyuda(false)} />}
      {hover && <FichaProvincia id={hover.id} x={hover.x} y={hover.y} e={estado} escanos={proy.porProvincia[hover.id]} />}
    </div>
  );
}

function FichaProvincia({ id, x, y, e, escanos }: { id: string; x: number; y: number; e: Estado; escanos: Partial<Record<PartidoId, number>> }) {
  const p = PROV[id];
  const pr = e.presencia[id];
  const ctrl = controlDe(p, pr);
  const v = votosProvincia(p, e);
  const tot = Object.values(v).reduce((a, b) => a + (b ?? 0), 0);
  const filas = (Object.entries(v) as [PartidoId, number][]).filter(([k, n]) => k !== 'BLANCO' && k !== 'OTROS' && n / tot >= 0.02).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const izq = Math.min(x + 18, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 270);
  const arr = Math.min(y + 12, (typeof window !== 'undefined' ? window.innerHeight : 800) - 300);
  return (
    <div className="ficha-prov" style={{ position: 'fixed', left: izq, top: Math.max(8, arr) }}>
      <h4>{p.nombre}</h4>
      <div className="fila"><span className="etiqueta">{ZONAS[p.zona].nombre}</span><span className="dato">{p.escanos} escaños</span></div>
      <div className="fila"><span>Fidelidad {p.fidelidad}{p.clave ? ' · clave' : ''}{p.feudo ? ` · feudo ${CORTO_BANDO[p.feudo].toLowerCase()}` : ''}</span><span>{ctrl === -1 ? <b className="p">Control progresista</b> : ctrl === 1 ? <b className="c">Control conservador</b> : 'Sin control'}</span></div>
      <div className="fila"><span>Presencia <b className="p">{pr.P}</b> · <b className="c">{pr.C}</b></span></div>
      <div className="barras-voto">
        {filas.map(([k, n]) => (
          <div key={k}>
            <span>{PARTIDOS[k].siglas} <b className="dato" style={{ display: 'inline', background: 'none' }}>{escanos[k] ?? 0}</b></span>
            <b style={{ width: `${Math.min(100, (n / tot) * 250)}%`, background: PARTIDOS[k].color }} />
            <span className="dato">{((n / tot) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
      <span className="etiqueta" style={{ fontSize: 10 }}>Voto estimado y escaños si se votara hoy</span>
    </div>
  );
}
