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
import { Afinidades, EnVigor, Escrutinio, Registro } from './Lateral';
import { Mapa } from './Mapa';
import { Marcadores } from './Marcadores';
import { Noche } from './Noche';
import { Plato } from './Plato';
import { cronicaSemana } from '../narrativa/plato';
import { ENCUADRE_COMPLETO, GEO_REAL, MapaTactil, PartidaMovil } from './Movil';
import { useMovil } from './useMovil';

interface Props {
  config: Config;
  estado: Estado;
  onEstado: (e: Estado) => void;
  onMenu: () => void;
  onNueva: () => void;
}

const USO_TXT: Record<string, string> = { evento: 'como evento', ops: 'por sus PC', carrera: 'en la Carrera' };

/** Última semana cerrada con crónica de plató (la 8 se cuenta en el especial de la noche electoral). */
function semanaCerrada(e: Estado): number {
  const t = e.historia.length ? e.historia[e.historia.length - 1].turno : 0;
  return t >= 1 && t <= 7 ? t : 0;
}

export function Partida({ config, estado, onEstado, onMenu, onNueva }: Props) {
  const [sel, setSel] = useState<number | null>(null);
  const [vista, setVista] = useState<Bando>(config.modo === 'ia' ? config.humano : 'P');
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [cartaHover, setCartaHover] = useState<number | null>(null);
  const [ayuda, setAyuda] = useState(false);
  const [verTablero, setVerTablero] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const movil = useMovil();
  // el plató: se conecta solo al cerrar cada semana, y se puede volver a ver
  const [platoVisto, setPlatoVisto] = useState(() => semanaCerrada(estado));
  const [plato, setPlato] = useState<number | null>(null);
  useEffect(() => {
    const t = semanaCerrada(estado);
    if (!estado.ganador && t > platoVisto) {
      setPlatoVisto(t);
      setPlato(t);
    }
  }, [estado, platoVisto]);
  const segmento = useMemo(() => (plato !== null ? cronicaSemana(estado, plato) : null), [estado, plato]);
  const semanasConPlato = estado.historia.filter((h) => h.turno >= 1 && h.turno <= 7 && (h.turno < estado.turno || semanaCerrada(estado) === h.turno)).map((h) => h.turno);

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
    if (!d || estado.ganador || humano(d.bando) || plato !== null) return;
    const rapido = typeof location !== 'undefined' && location.hash === '#rapido';
    const espera = rapido ? 0 : d.tipo === 'carta' ? 850 : d.tipo === 'provincia' ? 360 : 550;
    const t = setTimeout(() => aplicar(decidirIA(estado, config.nivel)), espera);
    return () => clearTimeout(t);
  }, [estado, humano, aplicar, config.nivel, plato]);

  const d = estado.pendiente;
  const cortina = config.modo === 'dos' && !!d && !estado.ganador && d.bando !== vista && plato === null;
  const decideYo = !!d && humano(d.bando) && d.bando === vista && !cortina;
  const opcionesMapa = decideYo && d!.tipo === 'provincia' ? new Set(d!.opciones) : null;
  const cartasElegibles = decideYo && d!.tipo === 'carta' ? new Set(d!.opciones) : null;

  const [vistaMapa, setVistaMapa] = useState<'real' | 'tablero'>(() => { try { return localStorage.getItem('176-mapa-pc') === 'tablero' ? 'tablero' : 'real'; } catch { return 'real'; } });
  const cambiarVista = (v: 'real' | 'tablero') => { setVistaMapa(v); try { localStorage.setItem('176-mapa-pc', v); } catch { /* sin almacenamiento */ } };
  const onHoverProv = useCallback((id: string | null, x: number, y: number) => setHover(id ? { id, x, y } : null), []);
  const onElegirProv = useCallback((id: string) => aplicar({ tipo: 'provincia', id }), [aplicar]);

  if (estado.ganador && !verTablero) {
    return <Noche e={estado} humano={config.modo === 'ia' ? config.humano : null} onNueva={onNueva} onTablero={() => setVerTablero(true)} />;
  }

  const mano = [...estado.manos[vista]];
  const tieneVotoUtil = estado.votoUtil.duenio === vista;
  const rival = RIVAL[vista];
  const humanoDecide = (b: Bando) => humano(b) && (config.modo === 'ia' || b === vista);
  const onPlato = semanasConPlato.length ? () => setPlato(semanasConPlato[semanasConPlato.length - 1]) : undefined;

  // capas comunes a las dos interfaces: errores, cortina del modo a dos, ayuda y plató
  const capas = (
    <>
      {error && <div className="velo" onClick={() => setError(null)}><div className="caja dialogo"><h2>Jugada no válida</h2><p>{error}</p><button className="boton" type="button">Seguir</button></div></div>}
      {cortina && d && (
        <div className="velo" role="dialog" aria-modal="true">
          <div className="caja dialogo" style={{ textAlign: 'center', justifyItems: 'center' }}>
            <span className="etiqueta">{movil ? 'Pasa el móvil' : 'Pasa el ordenador'}</span>
            <h2 className={d.bando === 'P' ? 'p' : 'c'}>Turno del {NOMBRE_BANDO[d.bando]}</h2>
            <p>{d.texto}</p>
            <button className="boton principal" type="button" onClick={() => { setVista(d.bando); setSel(null); }}>Soy el {CORTO_BANDO[d.bando]}: ver mi mano</button>
          </div>
        </div>
      )}
      {ayuda && <Ayuda onCerrar={() => setAyuda(false)} />}
      {segmento && plato !== null && (
        <Plato
          segmento={segmento}
          directo={plato === semanaCerrada(estado)}
          onCerrar={() => setPlato(null)}
          onAnterior={semanasConPlato.includes(plato - 1) ? () => setPlato(plato - 1) : undefined}
          onSiguiente={semanasConPlato.includes(plato + 1) ? () => setPlato(plato + 1) : undefined}
        />
      )}
    </>
  );

  if (movil) {
    return (
      <PartidaMovil
        estado={estado}
        vista={vista}
        proy={proy}
        sel={sel}
        onSeleccion={setSel}
        decideYo={decideYo}
        cortina={cortina}
        opcionesMapa={opcionesMapa}
        cartasElegibles={cartasElegibles}
        humanoDecide={humanoDecide}
        onResponder={aplicar}
        onElegirProv={onElegirProv}
        onAyuda={() => setAyuda(true)}
        onMenu={onMenu}
        onPlato={onPlato}
        onVolverResultados={estado.ganador && verTablero ? () => setVerTablero(false) : undefined}
      >
        {capas}
      </PartidaMovil>
    );
  }

  return (
    <div className="partida">
      <Marcadores e={estado} onAyuda={() => setAyuda(true)} onMenu={onMenu} onPlato={onPlato} />
      <div className="centro">
        <section className="caja zona-mapa" aria-label="Tablero">
          {vistaMapa === 'real'
            ? <MapaTactil geo={GEO_REAL} real e={estado} opciones={opcionesMapa} onElegir={onElegirProv} onHover={onHoverProv} encuadre={ENCUADRE_COMPLETO} pista="Elige una provincia resaltada · rueda o +/− para el zoom" />
            : <Mapa estado={estado} opciones={opcionesMapa} onElegir={onElegirProv} onHover={onHoverProv} />}
          <div className="conmutador conmutador-mapa" role="group" aria-label="Vista del mapa">
            <button type="button" aria-pressed={vistaMapa === 'real'} onClick={() => cambiarVista('real')}>Mapa</button>
            <button type="button" aria-pressed={vistaMapa === 'tablero'} onClick={() => cambiarVista('tablero')}>Tablero</button>
          </div>
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
          <EnVigor e={estado} onHover={setCartaHover} />
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
        <Decision e={estado} humano={humanoDecide} seleccion={sel} onResponder={aplicar} onSeleccion={setSel} onHover={setCartaHover} />
      </div>
      {capas}
      {hover && <FichaProvincia id={hover.id} x={hover.x} y={hover.y} e={estado} escanos={proy.porProvincia[hover.id]} />}
    </div>
  );
}

export function FichaProvincia({ id, x, y, e, escanos }: { id: string; x?: number; y?: number; e: Estado; escanos: Partial<Record<PartidoId, number>> }) {
  const p = PROV[id];
  const pr = e.presencia[id];
  const morado = e.morado[id] ?? 0;
  const ctrl = controlDe(p, pr, morado);
  const v = votosProvincia(p, e);
  const tot = Object.values(v).reduce((a, b) => a + (b ?? 0), 0);
  const filas = (Object.entries(v) as [PartidoId, number][]).filter(([k, n]) => k !== 'BLANCO' && k !== 'OTROS' && n / tot >= 0.02).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const flotante = x !== undefined && y !== undefined;
  const izq = flotante ? Math.min(x + 18, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 270) : 0;
  const arr = flotante ? Math.min(y + 12, (typeof window !== 'undefined' ? window.innerHeight : 800) - 300) : 0;
  return (
    <div className={`ficha-prov ${flotante ? '' : 'fija'}`} style={flotante ? { position: 'fixed', left: izq, top: Math.max(8, arr) } : undefined}>
      <h4>{p.nombre}</h4>
      <div className="fila"><span className="etiqueta">{ZONAS[p.zona].nombre}</span><span className="dato">{p.escanos} escaños</span></div>
      <div className="fila"><span>Fidelidad {p.fidelidad + morado}{morado ? ` (${morado} morado${morado > 1 ? 's' : ''})` : ''}{p.clave ? ' · clave' : ''}{p.feudo ? ` · feudo ${CORTO_BANDO[p.feudo].toLowerCase()}` : ''}</span><span>{ctrl === -1 ? <b className="p">Control progresista</b> : ctrl === 1 ? <b className="c">Control conservador</b> : 'Sin control'}</span></div>
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
