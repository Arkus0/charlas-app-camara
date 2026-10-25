// La hoja de jugada: carta → cómo se juega → dónde → cuánto (reparto) → previsión → «Jugar».
// Todo se calcula con la vista del jugador, así que funciona igual contra la IA y online.
import { useMemo, useState } from 'react';
import { CARTAS } from '../../data/mazos';
import { PARTIDOS } from '../../data/partidos';
import { PROV, PROVINCIAS, ZONAS } from '../../data/provincias';
import { duenoTema, NOMBRE_TEMA, TEMAS } from '../../motor/agenda';
import { RIVAL } from '../../motor/base';
import type { Resultado } from '../../motor/electoral';
import { HUMOR_PODEMOS } from '../../motor/cambios';
import { nivel, NOMBRE_RAMA, VENTAJAS, fuerzaParaSubir } from '../../motor/maquinaria';
import { datosReparto, distribucionAtaque, previsualizar, type Resumen } from '../../motor/prevision';
import { controlador, fidelidadEf, ZONA_IDS } from '../../motor/reglas';
import type { IdCarta, Modo, OpcionAccion, Rama, Respuesta, Tema } from '../../motor/tipos';
import type { Vista } from '../../motor/vista';
import { CartaGrande } from '../comun/Carta';
import { Hoja } from '../comun/Hoja';
import { Icono, ICONO, IconoRama, IconoTema } from '../comun/Iconos';
import { AYUDA_MODO, nombreDestino, nombreProv, NOMBRE_MODO, signo, SIGLAS_BLOQUE, ZONA_CORTA } from '../textos';

export interface Borrador {
  carta: IdCarta;
  modo?: Modo;
  destino?: string;
  sentido?: 'sube' | 'baja';
  reparto?: Record<string, number>;
}

const ORDEN_MODOS: Modo[] = ['evento', 'implantar', 'atacar', 'agenda', 'negociar', 'maquinaria'];

/** Qué tipo de destino pide un modo para esta carta. */
export function tipoDestino(b: Borrador): 'zona' | 'provincia' | 'partido' | 'tema' | 'rama' | null {
  switch (b.modo) {
    case 'implantar': return 'zona';
    case 'atacar': return 'provincia';
    case 'negociar': return 'partido';
    case 'agenda': return 'tema';
    case 'maquinaria': return 'rama';
    case 'evento': {
      if (typeof b.carta !== 'number') return null;
      const d = CARTAS[b.carta].destino;
      return d ? (d.d === 'zona' ? 'zona' : d.d === 'provincia' ? 'provincia' : d.d === 'partido' ? 'partido' : 'tema') : null;
    }
    default: return null;
  }
}

export function respuestaDe(b: Borrador): Extract<Respuesta, { tipo: 'accion' }> | null {
  if (!b.modo) return null;
  const tipo = tipoDestino(b);
  if (tipo && !b.destino) return null;
  return { tipo: 'accion', carta: b.carta, modo: b.modo, destino: b.destino ?? '-', sentido: b.modo === 'agenda' ? b.sentido ?? 'sube' : undefined, reparto: b.reparto };
}

interface Props {
  v: Vista;
  opcion: OpcionAccion;
  borrador: Borrador;
  proy: Resultado;
  onCambiar: (b: Borrador) => void;
  onJugar: (r: Respuesta) => void;
  onCerrar: () => void;
}

export function HojaJugada({ v, opcion, borrador, proy, onCambiar, onJugar, onCerrar }: Props) {
  const c = typeof borrador.carta === 'number' ? CARTAS[borrador.carta] : null;
  const titulo = c ? c.nombre : borrador.carta === 'pegada' ? 'Pegada de carteles' : 'Acción básica';
  const tipo = tipoDestino(borrador);
  const destinos = borrador.modo ? opcion.modos[borrador.modo] ?? [] : [];
  const respuesta = respuestaDe(borrador);
  const reparto = useMemo(() => (respuesta ? datosReparto(v, { ...respuesta, reparto: undefined }) : null), [v, respuesta?.modo, respuesta?.destino, respuesta?.carta]); // eslint-disable-line react-hooks/exhaustive-deps
  const prevision = useMemo(() => (respuesta ? previsualizar(v, respuesta, proy) : null), [v, proy, JSON.stringify(respuesta)]); // eslint-disable-line react-hooks/exhaustive-deps
  const eligiendoEnMapa = !!borrador.modo && !borrador.destino && (tipo === 'zona' || tipo === 'provincia');
  const ruptura = prevision && 'ganador' in prevision && prevision.ganador && prevision.ganador.bando !== v.yo;
  // una jugada que hace perder la partida pide un segundo toque
  const clave = JSON.stringify(respuesta);
  const [aviso, setAviso] = useState<string | null>(null);
  const avisado = ruptura && aviso === clave;

  const volver = () => {
    if (borrador.destino) onCambiar({ carta: borrador.carta, modo: borrador.modo });
    else if (borrador.modo) onCambiar({ carta: borrador.carta });
    else onCerrar();
  };

  const pie = respuesta ? (
    <button
      type="button"
      className={`boton principal grande ${ruptura ? 'peligro' : ''}`}
      disabled={!prevision || 'error' in prevision}
      onClick={() => (ruptura && !avisado ? setAviso(clave) : onJugar(respuesta))}
      data-testid="jugar"
    >
      {ruptura ? (avisado ? 'Toca otra vez: pierdes la partida' : 'Jugar (pierdes la partida)') : `Jugar: ${NOMBRE_MODO[borrador.modo!]}${borrador.destino && borrador.destino !== '-' ? ` · ${nombreDestino(borrador.destino, borrador.modo)}` : ''}`}
    </button>
  ) : undefined;

  return (
    <Hoja
      titulo={
        <span className="titulo-jugada">
          {(borrador.modo || borrador.destino) && (
            <button className="boton-icono" type="button" onClick={(ev) => { ev.stopPropagation(); volver(); }} aria-label="Atrás"><Icono d={ICONO.atras} /></button>
          )}
          <span>{titulo}</span>
          <span className="pc dato">{opcion.pc} PC</span>
        </span>
      }
      etiqueta={titulo}
      onCerrar={onCerrar}
      alto={eligiendoEnMapa ? 'media' : 'alta'}
      pie={pie}
    >
      {!borrador.modo && (
        <>
          {c && <CartaGrande id={c.id} de={v.yo} />}
          <div className="modos" role="list">
            {ORDEN_MODOS.filter((m) => borrador.carta !== 'pegada' || m === 'implantar').map((m) => {
              const disponible = !!opcion.modos[m];
              if (!disponible && (m === 'evento' ? !c : borrador.carta === 'basica' && m !== 'implantar' && m !== 'agenda')) return null;
              return (
                <button key={m} type="button" className={`modo modo-${m}`} disabled={!disponible} onClick={() => onCambiar({ carta: borrador.carta, modo: m })} data-testid={`modo-${m}`}>
                  <b>{NOMBRE_MODO[m]}</b>
                  <span>{m === 'evento' && c ? c.texto : AYUDA_MODO[m]}</span>
                  {!disponible && <em>{razonNoDisponible(m)}</em>}
                </button>
              );
            })}
          </div>
        </>
      )}

      {borrador.modo && !borrador.destino && tipo && (
        <ListaDestinos v={v} tipo={tipo} destinos={destinos} borrador={borrador} onElegir={(destino, sentido) => onCambiar({ ...borrador, destino, sentido })} />
      )}

      {respuesta && (
        <>
          {reparto && (
            <EditorReparto
              v={v}
              datos={reparto}
              valor={borrador.reparto ?? reparto.sugerido}
              onCambiar={(r) => onCambiar({ ...borrador, reparto: r })}
              onSugerido={() => onCambiar({ ...borrador, reparto: undefined })}
            />
          )}
          {borrador.modo === 'atacar' && borrador.destino && <Ataque v={v} carta={borrador.carta} prov={borrador.destino} />}
          {prevision && ('error' in prevision ? <p className="aviso">{prevision.error}</p> : <Prevision v={v} r={prevision} />)}
        </>
      )}
    </Hoja>
  );
}

function razonNoDisponible(m: Modo): string {
  switch (m) {
    case 'evento': return 'Ahora no se cumplen sus condiciones';
    case 'atacar': return 'No hay dónde atacar (el Clima lo impide o no hay presencia rival)';
    case 'negociar': return 'Hacen falta 2 PC y presencia en su territorio';
    case 'maquinaria': return 'Ya la usaste esta semana o falta fuerza';
    default: return '';
  }
}

// —— elegir destino ——
function ListaDestinos({ v, tipo, destinos, borrador, onElegir }: { v: Vista; tipo: NonNullable<ReturnType<typeof tipoDestino>>; destinos: string[]; borrador: Borrador; onElegir: (d: string, sentido?: 'sube' | 'baja') => void }) {
  const disponibles = new Set(destinos);
  if (tipo === 'zona') {
    return (
      <div className="lista" role="list">
        <p className="pista">Elige una zona (también en el mapa).</p>
        {ZONA_IDS.filter((z) => disponibles.has(z)).map((z) => {
          const ps = PROVINCIAS.filter((p) => p.zona === z);
          const esc = ps.reduce((a, p) => a + p.escanos, 0);
          const nP = ps.filter((p) => controlador(v, p.id) === 'P').length;
          const nC = ps.filter((p) => controlador(v, p.id) === 'C').length;
          return (
            <button key={z} type="button" className="fila" onClick={() => onElegir(z)} data-testid={`destino-${z}`}>
              <i className="color-zona" style={{ background: ZONAS[z].color }} />
              <span className="fila-nombre">{ZONAS[z].nombre}</span>
              <span className="dato tenue">{esc} esc.</span>
              <span className="dato"><b className="p">{nP}</b>·<b className="c">{nC}</b></span>
            </button>
          );
        })}
      </div>
    );
  }
  if (tipo === 'provincia') {
    const lista = destinos.filter((id) => PROV[id]).sort((a, b) => PROV[b].escanos - PROV[a].escanos);
    return (
      <div className="lista" role="list">
        <p className="pista">Elige una provincia ({lista.length} posibles).</p>
        {lista.map((id) => {
          const pr = v.presencia[id];
          const ctrl = controlador(v, id);
          const ataque = borrador.modo === 'atacar' ? distribucionAtaque(v, borrador.carta, id) : null;
          return (
            <button key={id} type="button" className="fila" onClick={() => onElegir(id)} data-testid={`destino-${id}`}>
              <span className="fila-nombre">{PROV[id].clave ? '◆ ' : ''}{nombreProv(id)} <small className="tenue">{ZONA_CORTA[PROV[id].zona]}</small></span>
              <span className="dato tenue">{PROV[id].escanos}</span>
              <span className={`dato pres ${ctrl === 'P' ? 'ctrl-p' : ctrl === 'C' ? 'ctrl-c' : ''}`}><b className="p">{pr.P}</b>·<b className="c">{pr.C}</b></span>
              {ataque && <span className="dato prob">{Math.round(ataque.exito * 100)}%</span>}
            </button>
          );
        })}
      </div>
    );
  }
  if (tipo === 'partido') {
    return (
      <div className="lista" role="list">
        {destinos.map((id) => {
          if (id === 'PODEMOS') {
            return (
              <button key={id} type="button" className="fila" onClick={() => onElegir(id)} data-testid={`destino-${id}`}>
                <i className="color-zona" style={{ background: PARTIDOS.PODEMOS.color }} />
                <span className="fila-nombre">Podemos <small className="tenue">{HUMOR_PODEMOS[v.podemos.humor]} · pinza {v.podemos.pinza}</small></span>
                <span className="tenue">{v.yo === 'P' ? 'humor +1' : 'pinza +1'}</span>
              </button>
            );
          }
          const a = v.afinidad[id as keyof typeof v.afinidad];
          return (
            <button key={id} type="button" className="fila" onClick={() => onElegir(id)} data-testid={`destino-${id}`}>
              <i className="color-zona" style={{ background: PARTIDOS[id as keyof typeof PARTIDOS].color }} />
              <span className="fila-nombre">{PARTIDOS[id as keyof typeof PARTIDOS].nombre}</span>
              <Afinidad a={a} />
            </button>
          );
        })}
      </div>
    );
  }
  if (tipo === 'tema') {
    return (
      <div className="lista" role="list">
        {(borrador.modo === 'agenda' ? TEMAS : destinos as Tema[]).map((t) => {
          const dueno = duenoTema(v, t);
          const mio = dueno === v.yo;
          return (
            <div key={t} className={`fila fila-tema ${mio ? 'mio' : dueno ? 'suyo' : ''}`}>
              <span className={`tema-carta tema-${t}`}><IconoTema tema={t} size={16} /></span>
              <span className="fila-nombre">{NOMBRE_TEMA[t]} <small className="tenue">{dueno ? (mio ? 'tuyo' : 'del rival') : 'sin dueño'}</small></span>
              <span className="calor" aria-label={`calor ${v.agenda.calor[t]}`}>{[1, 2, 3, 4, 5].map((n) => <i key={n} className={v.agenda.calor[t] >= n ? 'on' : ''} />)}</span>
              {borrador.modo === 'agenda' ? (
                <span className="botones-tema">
                  <button type="button" className="boton pequeno" onClick={() => onElegir(t, 'sube')} data-testid={`sube-${t}`}>Calentar</button>
                  <button type="button" className="boton pequeno" disabled={v.agenda.calor[t] <= 0} onClick={() => onElegir(t, 'baja')} data-testid={`baja-${t}`}>Enfriar</button>
                </span>
              ) : (
                <button type="button" className="boton pequeno" onClick={() => onElegir(t)} data-testid={`destino-${t}`}>Elegir</button>
              )}
            </div>
          );
        })}
      </div>
    );
  }
  // ramas de la Maquinaria
  return (
    <div className="lista" role="list">
      {(destinos as Rama[]).map((r) => {
        const n = nivel(v, v.yo, r);
        return (
          <button key={r} type="button" className="fila" onClick={() => onElegir(r)} data-testid={`destino-${r}`}>
            <IconoRama rama={r} />
            <span className="fila-nombre">{NOMBRE_RAMA[r]} {n} → {n + 1}<small className="tenue">{VENTAJAS[r][n]}</small></span>
            <span className="tenue dato">fuerza {fuerzaParaSubir(v, v.yo, r)}+</span>
          </button>
        );
      })}
    </div>
  );
}

export function Afinidad({ a }: { a: number }) {
  return (
    <span className="afinidad" aria-label={`afinidad ${a}`}>
      {[-3, -2, -1, 0, 1, 2, 3].map((n) => <i key={n} className={`${n === a ? 'on' : ''} ${n < 0 ? 'p' : n > 0 ? 'c' : ''}`} />)}
    </span>
  );
}

// —— reparto ——
function EditorReparto({ v, datos, valor, onCambiar, onSugerido }: { v: Vista; datos: NonNullable<ReturnType<typeof datosReparto>>; valor: Record<string, number>; onCambiar: (r: Record<string, number>) => void; onSugerido: () => void }) {
  const usado = Object.entries(valor).reduce((a, [id, n]) => a + n * (datos.coste[id] ?? 1), 0);
  const quien = datos.quitar ? RIVAL[v.yo] : v.yo;
  const cambiar = (id: string, d: number) => {
    const n = Math.max(0, Math.min(datos.maxPor, (valor[id] ?? 0) + d));
    const nuevo = { ...valor, [id]: n };
    if (!n) delete nuevo[id];
    const gasto = Object.entries(nuevo).reduce((a, [k, x]) => a + x * (datos.coste[k] ?? 1), 0);
    if (gasto <= datos.total) onCambiar(nuevo);
  };
  return (
    <section className="reparto">
      <header>
        <span>{datos.quitar ? 'Quitas presencia rival' : 'Repartes presencia'}: <b className="dato">{usado}</b> de <b className="dato">{datos.total}</b></span>
        <button type="button" className="boton pequeno" onClick={onSugerido}>Sugerido</button>
      </header>
      {[...datos.candidatas].sort((a, b) => PROV[b].escanos - PROV[a].escanos).map((id) => {
        const n = valor[id] ?? 0;
        const pr = v.presencia[id];
        if (datos.quitar && pr[quien] <= 0) return null;
        return (
          <div key={id} className={`fila-reparto ${n ? 'con' : ''}`}>
            <span className="fila-nombre">{PROV[id].clave ? '◆ ' : ''}{nombreProv(id)} <small className="tenue">{PROV[id].escanos} esc. · fid. {fidelidadEf(v, id)}{(datos.coste[id] ?? 1) > 1 ? ' · cuesta 2' : ''}</small></span>
            <span className="dato pres"><b className="p">{pr.P}</b>·<b className="c">{pr.C}</b></span>
            <span className="paso">
              <button type="button" className="boton-paso" onClick={() => cambiar(id, -1)} disabled={!n} aria-label={`Menos en ${PROV[id].nombre}`}>−</button>
              <b className="dato">{n}</b>
              <button type="button" className="boton-paso" onClick={() => cambiar(id, 1)} aria-label={`Más en ${PROV[id].nombre}`}>+</button>
            </span>
          </div>
        );
      })}
    </section>
  );
}

// —— ataque ——
function Ataque({ v, carta, prov }: { v: Vista; carta: IdCarta; prov: string }) {
  const d = distribucionAtaque(v, carta, prov);
  const max = Math.max(1, ...d.caras.map((c) => Math.abs(c.resultado)));
  return (
    <section className="ataque">
      <p>Base {d.base} ± dado. Le quitas presencia en {Math.round(d.exito * 100)}% de los casos{d.giro ? ` y tomas el control en ${Math.round(d.giro * 100)}%` : ''}.{PROV[prov].clave ? ' Al ser clave, el Clima baja 1.' : ''}</p>
      <div className="histograma" aria-hidden="true">
        {d.caras.map((c, i) => (
          <span key={i} className={c.resultado > 0 ? 'bien' : 'mal'} style={{ height: `${20 + (Math.abs(c.resultado) / max) * 60}%` }}>
            <b className="dato">{c.resultado > 0 ? `−${c.quitado}${c.ganado ? `+${c.ganado}` : ''}` : '0'}</b>
          </span>
        ))}
      </div>
    </section>
  );
}

// —— previsión ——
export function Prevision({ v, r }: { v: Vista; r: Resumen }) {
  const dP = r.bloque.despues.P - r.bloque.antes.P;
  const dC = r.bloque.despues.C - r.bloque.antes.C;
  const aP = r.apoyos.despues.P - r.apoyos.antes.P;
  const aC = r.apoyos.despues.C - r.apoyos.antes.C;
  const favor = v.yo === 'C' ? r.ventaja : -r.ventaja;
  const calor = Object.entries(r.calor) as [Tema, number][];
  return (
    <section className="prevision" data-testid="prevision">
      <h4 className="etiqueta">Si juegas esto, hoy</h4>
      <div className="prev-escanos">
        <span className="p">{SIGLAS_BLOQUE.P} <b className="dato">{r.bloque.despues.P}</b> {dP !== 0 && <em className="dato">{signo(dP)}</em>}</span>
        <span className="c">{SIGLAS_BLOQUE.C} <b className="dato">{r.bloque.despues.C}</b> {dC !== 0 && <em className="dato">{signo(dC)}</em>}</span>
      </div>
      <ul className="prev-lista">
        {(aP !== 0 || aC !== 0) && <li>Apoyos a la investidura: Sánchez {r.apoyos.despues.P} ({signo(aP)}), Feijóo {r.apoyos.despues.C} ({signo(aC)})</li>}
        {r.ventaja !== 0 && <li className={favor > 0 ? 'bien' : 'mal'}>{favor > 0 ? `Ganas ${favor} PV` : `El rival gana ${-favor} PV`}</li>}
        {r.clima !== 0 && <li className={r.clima < 0 ? 'mal' : 'bien'}>Clima {signo(r.clima)}{r.ganador ? ': ¡ruptura!' : ''}</li>}
        {calor.map(([t, n]) => {
          const dueno = duenoTema(v, t);
          return <li key={t} className={n > 0 && dueno && dueno !== v.yo ? 'mal' : ''}>{NOMBRE_TEMA[t]} {signo(n)} de calor{n > 0 && dueno && dueno !== v.yo ? ' (tema del rival)' : ''}</li>;
        })}
        {r.controles.map((x) => <li key={x.prov} className={x.despues === v.yo || (x.antes && x.antes !== v.yo && x.despues === null) ? 'bien' : 'mal'}>{nombreProv(x.prov)} {x.despues ? `pasa a control ${x.despues === 'P' ? 'progresista' : 'conservador'}` : 'queda sin control'}</li>)}
        {r.incierta && <li className="tenue">Depende del dado o de una elección: la previsión es orientativa.</li>}
      </ul>
    </section>
  );
}

