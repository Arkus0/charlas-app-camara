// Interfaz táctil para móvil: barra de estado compacta, pestañas abajo, mapa con zoom y lista de provincias,
// mano en lista y la decisión siempre anclada sobre las pestañas.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CARTAS } from '../data/cartas';
import { CORTO_BANDO } from '../data/partidos';
import { PROV, PROVINCIAS, ZONAS } from '../data/provincias';
import { controlDe, posturaPodemos, votoPodemos, type Resultado } from '../engine/electoral';
import { fmtVentaja, NOMBRES_CLIMA } from '../engine/motor';
import { FECHAS, puntuarZona, rondasDe, ZONA_IDS } from '../engine/reglas';
import type { Bando, Estado, Respuesta, ZonaId } from '../engine/tipos';
import { RIVAL } from '../engine/tipos';
import { Carta } from './Carta';
import { Decision } from './Decision';
import { Afinidades, EnVigor, Escrutinio, Registro } from './Lateral';
import { ALTO_MAPA, ANCHO_MAPA, Mapa } from './Mapa';
import { ALTO_REAL, ANCHO_REAL, MapaReal, posReal } from './MapaReal';
import { COLOR_CLIMA, Marcadores } from './Marcadores';
import { FichaProvincia } from './Partida';

type Pestana = 'mapa' | 'mano' | 'congreso' | 'campana';

const LADO_CORTO: Record<string, string> = { P: 'Progresista', C: 'Conservador', N: 'Neutral', E: 'Encuesta', W: 'Podemos', A: 'Agenda' };
const USO_TXT: Record<string, string> = { evento: 'como evento', ops: 'por sus PC', carrera: 'en la Carrera' };
const VOTO_CORTO = { si: 'sí', no: 'no', abst: 'abst.' } as const;

interface Props {
  estado: Estado;
  vista: Bando;
  proy: Resultado;
  sel: number | null;
  onSeleccion: (id: number | null) => void;
  decideYo: boolean;
  cortina: boolean;
  opcionesMapa: Set<string> | null;
  cartasElegibles: Set<number> | null;
  humanoDecide: (b: Bando) => boolean;
  onResponder: (r: Respuesta) => void;
  onElegirProv: (id: string) => void;
  onAyuda: () => void;
  onMenu: () => void;
  onPlato?: () => void;
  onVolverResultados?: () => void;
  children?: ReactNode; // capas comunes: plató, cortina, errores, ayuda
}

export function PartidaMovil(props: Props) {
  const { estado, vista, proy, sel, onSeleccion, decideYo, cortina, opcionesMapa, cartasElegibles, onElegirProv } = props;
  const [pestana, setPestana] = useState<Pestana>('mapa');
  const [hoja, setHoja] = useState<null | { tipo: 'marcadores' } | { tipo: 'provincia'; id: string }>(null);
  const [plegada, setPlegada] = useState(false);
  const d = estado.pendiente;

  // cada decisión lleva a la pestaña donde se resuelve
  const claveDecision = d ? `${d.tipo}|${d.bando}|${d.texto}` : '';
  useEffect(() => {
    if (!decideYo || !d) return;
    setPlegada(false);
    if (d.tipo === 'provincia') setPestana('mapa');
    else if (d.tipo === 'carta' && d.opciones.some((id) => estado.manos[vista].includes(id) || id === 0)) setPestana('mano');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveDecision, decideYo]);

  const mano = estado.manos[vista];
  const pendienteEn = (p: Pestana) => !!d && decideYo && ((p === 'mapa' && d.tipo === 'provincia') || (p === 'mano' && d.tipo === 'carta'));

  return (
    <div className="movil">
      <BarraMovil e={estado} proy={proy} onAbrir={() => setHoja({ tipo: 'marcadores' })} />
      <Teletipo e={estado} onClick={() => setPestana('campana')} />
      <main className="movil-contenido">
        {pestana === 'mapa' && <PestanaMapa e={estado} opciones={opcionesMapa} onElegir={onElegirProv} onTocar={(id) => setHoja({ tipo: 'provincia', id })} />}
        {pestana === 'mano' && (
          <ManoMovil e={estado} vista={vista} oculta={cortina} sel={sel} elegibles={cartasElegibles} onSeleccion={onSeleccion} />
        )}
        {pestana === 'congreso' && (
          <div className="pila-movil">
            <Escrutinio r={proy} />
            <Afinidades e={estado} r={proy} />
          </div>
        )}
        {pestana === 'campana' && (
          <div className="pila-movil">
            <UltimaJugada e={estado} />
            <EnVigor e={estado} />
            <Registro log={estado.log} />
          </div>
        )}
      </main>
      <section className={`dock ${plegada ? 'plegada' : ''}`} aria-label="Tu decisión">
        <button className="asa" type="button" onClick={() => setPlegada(!plegada)} aria-expanded={!plegada}>
          <span>{plegada ? 'Mostrar la decisión' : 'Ocultar'}</span>
        </button>
        {!plegada && (
          props.onVolverResultados ? (
            <div className="caja decision"><button className="boton principal" type="button" onClick={props.onVolverResultados}>Volver a los resultados</button></div>
          ) : (
            <Decision e={estado} humano={props.humanoDecide} seleccion={sel} onResponder={props.onResponder} onSeleccion={onSeleccion} />
          )
        )}
      </section>
      <nav className="pestanas" aria-label="Secciones">
        {([
          ['mapa', 'Mapa'],
          ['mano', `Mano · ${mano.length + (estado.votoUtil.duenio === vista ? 1 : 0)}`],
          ['congreso', `${proy.bloque.P}–${proy.bloque.C}`],
          ['campana', 'Campaña'],
        ] as [Pestana, string][]).map(([p, t]) => (
          <button key={p} type="button" className={`${pestana === p ? 'activa' : ''} ${pendienteEn(p) && pestana !== p ? 'aviso' : ''}`} aria-current={pestana === p ? 'page' : undefined} onClick={() => setPestana(p)}>
            <span className={`icono icono-${p}`} aria-hidden="true" />
            {p === 'congreso' ? <span>Congreso <small className="dato">{t}</small></span> : t}
          </button>
        ))}
      </nav>
      {hoja?.tipo === 'marcadores' && (
        <Hoja titulo="Marcadores" onCerrar={() => setHoja(null)}>
          <Marcadores e={estado} onAyuda={() => { setHoja(null); props.onAyuda(); }} onMenu={props.onMenu} onPlato={props.onPlato ? () => { setHoja(null); props.onPlato!(); } : undefined} />
        </Hoja>
      )}
      {hoja?.tipo === 'provincia' && (
        <Hoja titulo={PROV[hoja.id].nombre} onCerrar={() => setHoja(null)}>
          <FichaProvincia id={hoja.id} e={estado} escanos={proy.porProvincia[hoja.id]} />
        </Hoja>
      )}
      {props.children}
    </div>
  );
}

// ————————————————————————————————————— barra de estado
function BarraMovil({ e, proy, onAbrir }: { e: Estado; proy: Resultado; onAbrir: () => void }) {
  const pod = posturaPodemos(e);
  const ronda = e.fase === 'portada' ? 'Portada' : e.fase === 'preparacion' ? 'Preparación' : `R${e.ronda}/${e.enJuego ? rondasDe(e, e.enJuego) : rondasDe(e, 'P')}`;
  return (
    <header className="barra-movil">
      <button className="barra-toque" type="button" onClick={onAbrir} aria-label="Ver todos los marcadores">
        <span className="fila1">
          <b>Semana {Math.max(1, e.turno)}</b>
          <span className="tenue">{e.turno ? FECHAS[e.turno] : '5 oct'} · {ronda}</span>
          {e.enJuego && <span className={e.enJuego === 'P' ? 'p' : 'c'}>Juega {CORTO_BANDO[e.enJuego]}</span>}
        </span>
        <span className="fila2">
          <span className="chip" style={{ background: COLOR_CLIMA[e.clima], color: '#14100a' }} title={NOMBRES_CLIMA[e.clima]}>Clima {e.clima}</span>
          <span className={`chip ${e.ventaja < 0 ? 'p' : e.ventaja > 0 ? 'c' : ''}`} title="Ventaja demoscópica">{e.ventaja === 0 ? 'V 0' : `V ${fmtVentaja(e.ventaja).replace(' Progresista', ' P').replace(' Conservador', ' C')}`}</span>
          <span className="chip escanos" title="Escaños proyectados: PSOE+FA y PP+Vox"><b className="p">{proy.bloque.P}</b><span className="tenue">–</span><b className="c">{proy.bloque.C}</b></span>
          <span className="chip morado" title="Voto de Podemos a Sánchez y a Feijóo">Podemos {VOTO_CORTO[votoPodemos('P', pod)]}/{VOTO_CORTO[votoPodemos('C', pod)]}</span>
        </span>
      </button>
    </header>
  );
}

/** La última línea de la crónica, siempre visible: lo que acaba de pasar. */
function Teletipo({ e, onClick }: { e: Estado; onClick: () => void }) {
  const ultima = [...e.log].reverse().find((l) => l.tipo !== 'dado') ?? e.log[e.log.length - 1];
  if (!ultima) return null;
  return (
    <button className={`teletipo ${ultima.bando ?? ''}`} type="button" onClick={onClick}>
      {ultima.texto}
    </button>
  );
}

function UltimaJugada({ e }: { e: Estado }) {
  const u = e.ultimaJugada;
  if (!u) return null;
  return (
    <section className="caja ultima-jugada">
      <span className="etiqueta"><b className={u.bando === 'P' ? 'p' : 'c'}>{CORTO_BANDO[u.bando]}</b> ha jugado {USO_TXT[u.uso]}</span>
      <Carta id={u.carta} grande />
    </section>
  );
}

// ————————————————————————————————————— mapa táctil y lista de provincias
interface Caja { x: number; y: number; w: number; h: number }

/** Geometría de cada vista del mapa: el mapa real o el tablero esquemático. */
interface Geometria { ancho: number; alto: number; pos: (id: string) => [number, number]; mx: number; my: number; minimo: number }
export const GEO_REAL: Geometria = { ancho: ANCHO_REAL, alto: ALTO_REAL, pos: posReal, mx: 34, my: 30, minimo: 150 };
export const ENCUADRE_COMPLETO = { caja: { x: 0, y: 0, w: ANCHO_REAL, h: ALTO_REAL }, n: 0 };
export const GEO_TABLERO: Geometria = { ancho: ANCHO_MAPA, alto: ALTO_MAPA, pos: (id) => [PROV[id].x, PROV[id].y], mx: 70, my: 45, minimo: 230 };

function cajaDe(g: Geometria, ids: string[]): Caja {
  const xs = ids.map((id) => g.pos(id)[0]);
  const ys = ids.map((id) => g.pos(id)[1]);
  const x0 = Math.min(...xs) - g.mx, x1 = Math.max(...xs) + g.mx;
  const y0 = Math.min(...ys) - g.my, y1 = Math.max(...ys) + g.my;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
const todo = (g: Geometria): Caja => ({ x: 0, y: 0, w: g.ancho, h: g.alto });
const cajaZona = (g: Geometria, z: ZonaId) => cajaDe(g, PROVINCIAS.filter((p) => p.zona === z).map((p) => p.id));

type ModoMapa = 'real' | 'tablero' | 'lista';

function PestanaMapa({ e, opciones, onElegir, onTocar }: { e: Estado; opciones: Set<string> | null; onElegir: (id: string) => void; onTocar: (id: string) => void }) {
  const [modo, setModo] = useState<ModoMapa>(() => { try { return (localStorage.getItem('176-mapa') as ModoMapa) || 'real'; } catch { return 'real'; } });
  const cambiar = (m: ModoMapa) => { setModo(m); try { localStorage.setItem('176-mapa', m); } catch { /* sin almacenamiento */ } };
  const geo = modo === 'tablero' ? GEO_TABLERO : GEO_REAL;
  const [encuadre, setEncuadre] = useState<{ caja: Caja | null; zona: ZonaId | null; n: number }>({ caja: null, zona: null, n: 0 });
  return (
    <div className="pestana-mapa">
      <div className="barra-mapa">
        <div className="conmutador" role="group" aria-label="Vista">
          <button type="button" aria-pressed={modo === 'real'} onClick={() => cambiar('real')}>Mapa</button>
          <button type="button" aria-pressed={modo === 'tablero'} onClick={() => cambiar('tablero')}>Tablero</button>
          <button type="button" aria-pressed={modo === 'lista'} onClick={() => cambiar('lista')}>Lista</button>
        </div>
        {modo !== 'lista' && (
          <div className="zonas-rapidas">
            <button type="button" onClick={() => setEncuadre((x) => ({ caja: null, zona: null, n: x.n + 1 }))}>España</button>
            {ZONA_IDS.map((z) => (
              <button key={z} type="button" onClick={() => setEncuadre((x) => ({ caja: null, zona: z, n: x.n + 1 }))}><i style={{ background: ZONAS[z].color }} />{ZONAS[z].nombre.replace(', Ceuta y Melilla', '').replace(' y Baleares', '').replace(' y Centro', '')}</button>
            ))}
          </div>
        )}
      </div>
      {modo === 'lista'
        ? <ListaProvincias e={e} opciones={opciones} onElegir={onElegir} onTocar={onTocar} />
        : <MapaTactil key={modo} geo={geo} real={modo === 'real'} e={e} opciones={opciones} onElegir={onElegir} onTocar={onTocar} encuadre={{ caja: encuadre.zona ? cajaZona(geo, encuadre.zona) : todo(geo), n: encuadre.n }} />}
    </div>
  );
}

/** El mapa con pellizco para el zoom, arrastre para moverse y encuadre automático en las opciones. */
export function MapaTactil({ geo, real, e, opciones, onElegir, onTocar, onHover, encuadre, pista = 'Toca una provincia resaltada · pellizca para acercar' }: { geo: Geometria; real: boolean; e: Estado; opciones: Set<string> | null; onElegir: (id: string) => void; onTocar?: (id: string) => void; onHover?: (id: string | null, x: number, y: number) => void; encuadre: { caja: Caja; n: number }; pista?: string }) {
  const marco = useRef<HTMLDivElement>(null);
  const [vb, setVb] = useState<Caja>(todo(geo));
  const [aspecto, setAspecto] = useState(1);
  // el zoom mínimo deja ver el mapa entero, sea cual sea la forma del hueco
  const maximo = Math.max(geo.ancho, geo.alto / aspecto) * 1.12;
  const punteros = useRef(new Map<number, { x: number; y: number }>());
  const inicio = useRef<{ vb: Caja; pts: Map<number, { x: number; y: number }> } | null>(null);
  const movido = useRef(false);

  // la caja visible conserva siempre la proporción del hueco (alto / ancho)
  const ajustar = useCallback((c: Caja, asp = aspecto): Caja => {
    let { x, y, w, h } = c;
    if (h / w > asp) { const w2 = h / asp; x -= (w2 - w) / 2; w = w2; } else { const h2 = w * asp; y -= (h2 - h) / 2; h = h2; }
    const w0 = w;
    w = Math.max(geo.minimo, Math.min(maximo, w));
    x += (w0 - w) / 2;
    h = w * asp;
    x = Math.max(-w * 0.35, Math.min(geo.ancho - w * 0.65, x));
    y = Math.max(-h * 0.35, Math.min(geo.alto - h * 0.65, y));
    return { x, y, w, h };
  }, [aspecto, geo, maximo]);

  useLayoutEffect(() => {
    const el = marco.current;
    if (!el) return;
    const medir = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setAspecto(r.height / r.width);
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => setVb((v) => ajustar(v)), [ajustar]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setVb(ajustar(encuadre.caja)), [encuadre.n, ajustar]);

  // al pedir una provincia, encuadrar las que se pueden elegir
  const claveOpciones = opciones ? [...opciones].sort().join(',') : '';
  useEffect(() => {
    if (!opciones || opciones.size === 0) return;
    setVb(ajustar(opciones.size > 30 ? todo(geo) : cajaDe(geo, [...opciones])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveOpciones, aspecto]);

  const onPointerDown = (ev: React.PointerEvent) => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    if (punteros.current.size === 0) movido.current = false;
    punteros.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    inicio.current = { vb, pts: new Map(punteros.current) };
  };
  const onPointerMove = (ev: React.PointerEvent) => {
    if (!punteros.current.has(ev.pointerId) || !inicio.current) return;
    punteros.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    const r = marco.current!.getBoundingClientRect();
    const ini = inicio.current;
    const s0 = ini.vb.w / r.width;
    const actuales = [...punteros.current.entries()];
    if (actuales.length === 1) {
      const [id, p] = actuales[0];
      const p0 = ini.pts.get(id);
      if (!p0) return;
      const dx = p.x - p0.x, dy = p.y - p0.y;
      if (Math.hypot(dx, dy) > 6) movido.current = true;
      if (movido.current) setVb(ajustar({ ...ini.vb, x: ini.vb.x - dx * s0, y: ini.vb.y - dy * s0 }));
    } else if (actuales.length >= 2) {
      movido.current = true;
      const [[ida, a], [idb, b]] = actuales;
      const a0 = ini.pts.get(ida), b0 = ini.pts.get(idb);
      if (!a0 || !b0) return;
      const d0 = Math.hypot(a0.x - b0.x, a0.y - b0.y) || 1;
      const d1 = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const m0 = { x: (a0.x + b0.x) / 2 - r.left, y: (a0.y + b0.y) / 2 - r.top };
      const m1 = { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top };
      const w1 = Math.max(geo.minimo, Math.min(maximo, ini.vb.w * (d0 / d1)));
      const s1 = w1 / r.width;
      const ancla = { x: ini.vb.x + m0.x * s0, y: ini.vb.y + m0.y * s0 };
      setVb(ajustar({ x: ancla.x - m1.x * s1, y: ancla.y - m1.y * s1, w: w1, h: w1 * aspecto }));
    }
  };
  const soltar = (ev: React.PointerEvent) => {
    punteros.current.delete(ev.pointerId);
    inicio.current = punteros.current.size ? { vb, pts: new Map(punteros.current) } : null;
  };
  const zoom = (f: number, cx = 0.5, cy = 0.5) => {
    const w = Math.max(geo.minimo, Math.min(maximo, vb.w * f));
    const h = w * aspecto;
    setVb(ajustar({ x: vb.x + (vb.w - w) * cx, y: vb.y + (vb.h - h) * cy, w, h }));
  };
  const onWheel = (ev: React.WheelEvent) => {
    const r = marco.current!.getBoundingClientRect();
    zoom(Math.exp(ev.deltaY * 0.0015), (ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height);
  };
  const viewBox = `${vb.x} ${vb.y} ${vb.w} ${vb.h}`;

  return (
    <div
      ref={marco}
      className="mapa-tactil"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      onPointerLeave={soltar}
      onWheel={onWheel}
      // un arrastre no es un toque: que no elija provincia sin querer
      onClickCapture={(ev) => { if (movido.current) { ev.stopPropagation(); ev.preventDefault(); } }}
    >
      {real
        ? <MapaReal estado={e} opciones={opciones} onElegir={onElegir} onTocar={onTocar} onHover={onHover} viewBox={viewBox} escala={vb.w / geo.ancho} />
        : <Mapa estado={e} opciones={opciones} onElegir={onElegir} onTocar={onTocar} onHover={onHover} viewBox={viewBox} sinLeyenda />}
      <div className="zoom-botones">
        <button type="button" aria-label="Acercar" onClick={() => zoom(0.7)}>+</button>
        <button type="button" aria-label="Alejar" onClick={() => zoom(1.4)}>−</button>
      </div>
      {opciones && <div className="pista-mapa">{pista}</div>}
    </div>
  );
}

function ListaProvincias({ e, opciones, onElegir, onTocar }: { e: Estado; opciones: Set<string> | null; onElegir: (id: string) => void; onTocar: (id: string) => void }) {
  const [soloOpciones, setSoloOpciones] = useState(true);
  const filtrar = !!opciones && soloOpciones;
  const grupos = useMemo(() => ZONA_IDS.map((z) => ({
    z,
    neto: puntuarZona(e, z).neto,
    provs: PROVINCIAS.filter((p) => p.zona === z && (!filtrar || opciones!.has(p.id))).sort((a, b) => b.escanos - a.escanos),
  })).filter((g) => g.provs.length), [e, opciones, filtrar]);
  return (
    <div className="lista-provincias">
      {opciones && (
        <label className="solo-opciones">
          <input type="checkbox" checked={soloOpciones} onChange={(ev) => setSoloOpciones(ev.target.checked)} /> Solo las que puedo elegir ({opciones.size})
        </label>
      )}
      <div className="cabecera-lista" aria-hidden="true"><span>Provincia</span><span>Esc.</span><span className="p">Prog.</span><span className="c">Cons.</span><span>Fid.</span></div>
      {grupos.map((g) => (
        <section key={g.z}>
          <h3 className="zona-lista"><i style={{ background: ZONAS[g.z].color }} />{ZONAS[g.z].nombre}
            <span className={`dato ${g.neto > 0 ? 'c' : g.neto < 0 ? 'p' : ''}`}>{g.neto === 0 ? 'encuesta igualada' : `encuesta ${g.neto > 0 ? '+' : ''}${Math.abs(g.neto)} ${g.neto > 0 ? 'C' : 'P'}`}</span>
          </h3>
          {g.provs.map((p) => {
            const pr = e.presencia[p.id];
            const morado = e.morado[p.id] ?? 0;
            const ctrl = controlDe(p, pr, morado);
            const opcion = !!opciones?.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                className={`fila-prov ${opcion ? 'opcion' : ''} ${opciones && !opcion ? 'atenuada' : ''} ${ctrl === -1 ? 'ctrl-p' : ctrl === 1 ? 'ctrl-c' : ''}`}
                onClick={() => (opcion ? onElegir(p.id) : onTocar(p.id))}
              >
                <span className="nombre">{p.clave ? '◆ ' : ''}{p.nombre.replace('/Alicante', '').replace('Alacant/', 'Alicante').replace('València/', '').replace('Castelló/', '').replace('Araba/', '')}{p.feudo ? <i className={`feudo ${p.feudo}`} title="feudo" /> : null}</span>
                <span className="dato">{p.escanos}</span>
                <span className={`dato pres p ${ctrl === -1 ? 'control' : ''}`}>{pr.P}</span>
                <span className={`dato pres c ${ctrl === 1 ? 'control' : ''}`}>{pr.C}</span>
                <span className={`dato fid ${morado ? 'morado' : ''}`}>{p.fidelidad + morado}</span>
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}

// ————————————————————————————————————— la mano
function ManoMovil({ e, vista, oculta, sel, elegibles, onSeleccion }: { e: Estado; vista: Bando; oculta: boolean; sel: number | null; elegibles: Set<number> | null; onSeleccion: (id: number | null) => void }) {
  if (oculta) return <div className="mano-vacia">Mano oculta: pasa el móvil.</div>;
  const ids = [...e.manos[vista], ...(e.votoUtil.duenio === vista ? [0] : [])];
  const rival = RIVAL[vista];
  return (
    <div className="mano-movil">
      {ids.length === 0 && <div className="mano-vacia">Sin cartas en la mano.</div>}
      {ids.map((id) => {
        const c = CARTAS[id];
        const abierta = sel === id;
        const usable = !!elegibles?.has(id);
        return (
          <div key={id} className={`fila-carta-movil ${abierta ? 'abierta' : ''}`}>
            <button type="button" className={`fila-carta lado-${c.lado} ${elegibles ? (usable ? 'usable' : 'no-usable') : ''}`} onClick={() => onSeleccion(abierta ? null : id)} aria-expanded={abierta}>
              <span className="ops dato">{c.lado === 'E' ? 'E' : c.ops}</span>
              <span className="nombre">{c.nombre}{c.retirar ? ' *' : ''}</span>
              <span className="lado">{id === 0 ? 'Voto Útil' : LADO_CORTO[c.lado]}{c.noticia ? ' · noticia' : ''}</span>
            </button>
            {abierta && <div className="detalle-carta"><Carta id={id} grande /></div>}
          </div>
        );
      })}
      <div className="mano-rival-movil">
        <span className="etiqueta">Mano del {CORTO_BANDO[rival]}: {e.manos[rival].length} cartas</span>
        {e.manoVista[vista] && <ul>{e.manos[rival].map((id) => <li key={id}>{CARTAS[id].nombre} <span className="dato tenue">{CARTAS[id].ops}</span></li>)}</ul>}
      </div>
    </div>
  );
}

// ————————————————————————————————————— hoja inferior
function Hoja({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: ReactNode }) {
  return (
    <div className="velo velo-hoja" onClick={onCerrar}>
      <div className="hoja" role="dialog" aria-modal="true" aria-label={titulo} onClick={(ev) => ev.stopPropagation()}>
        <div className="hoja-cab">
          <b>{titulo}</b>
          <button className="boton pequeno" type="button" onClick={onCerrar}>Cerrar</button>
        </div>
        <div className="hoja-cuerpo">{children}</div>
      </div>
    </div>
  );
}
