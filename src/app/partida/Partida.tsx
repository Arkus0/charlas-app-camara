// La pantalla de partida en vertical: barra arriba, Agenda, mapa y la mano abajo (al alcance del pulgar).
// Recibe solo la vista del jugador: sirve igual contra la IA y online.
import { useEffect, useMemo, useState } from 'react';
import { PROV, PROVINCIAS } from '../../data/provincias';
import type { ZonaId } from '../../motor/base';
import { proyectar } from '../../motor/electoral';
import type { IdCarta, Respuesta, Suceso } from '../../motor/tipos';
import type { Vista } from '../../motor/vista';
import { Ayuda } from '../Ayuda';
import { haptica } from '../comun/haptica';
import { momentosDesde } from '../momentos';
import { Mapa } from '../tablero/Mapa';
import { Barra, TiraAgenda } from './Barra';
import { DecisionDebate, DecisionOpcion } from './Decisiones';
import { HojaJugada, tipoDestino, type Borrador } from './HojaJugada';
import { HojaAgenda, HojaCongreso, HojaMaquinaria, HojaMenu, HojaZona } from './Hojas';
import { Mano } from './Mano';
import { Momento } from './Momento';
import { Noche } from './Noche';

type HojaAbierta = { tipo: 'zona'; z: ZonaId } | { tipo: 'congreso' } | { tipo: 'agenda' } | { tipo: 'menu' } | { tipo: 'maquinaria' };

interface Props {
  v: Vista;
  responder: (r: Respuesta) => void;
  pensando: boolean;
  error: string | null;
  limpiarError: () => void;
  visto: number;
  marcarVisto: (seq: number) => void;
  onSalir: () => void;
  onRevancha?: () => void;
}

export function Partida({ v, responder, pensando, error, limpiarError, visto, marcarVisto, onSalir, onRevancha }: Props) {
  const proy = useMemo(() => proyectar(PROVINCIAS, v), [v]);
  const momentos = useMemo(() => momentosDesde(v.cronica, v.yo, visto), [v.cronica, v.yo, visto]);
  const momento = momentos[0] ?? null;
  const [hoja, setHoja] = useState<HojaAbierta | null>(null);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [ayuda, setAyuda] = useState(false);
  const [mapaFinal, setMapaFinal] = useState(false);

  const d = v.pendiente;
  const accion = d?.tipo === 'accion' ? d : null;
  const libre = !momento;
  const activa = !!accion && libre;
  // cada respuesta aplicada cierra la jugada en curso
  useEffect(() => { setBorrador(null); }, [v.n]);
  // si ya no hay nada que contar y no hay nada pendiente, se marca todo como visto
  useEffect(() => {
    if (!momento && v.cronica.seq > visto) marcarVisto(v.cronica.seq);
  }, [momento, v.cronica.seq, visto, marcarVisto]);

  // las provincias que acaban de cambiar laten en el mapa
  const pulso = useMemo(() => new Set((momento?.efectos ?? []).filter((s): s is Extract<Suceso, { s: 'presencia' }> => s.s === 'presencia').map((s) => s.prov)), [momento]);

  const opcion = borrador && accion ? accion.opciones.find((o) => o.carta === borrador.carta) ?? null : null;
  const tipo = borrador ? tipoDestino(borrador) : null;
  const eligiendo = !!borrador?.modo && !borrador.destino && !!opcion;
  const destinos = eligiendo ? opcion!.modos[borrador!.modo!] ?? [] : [];

  // el mapa acompaña: resalta los destinos posibles y se acerca a la zona en juego
  let zonaMapa: ZonaId | null = hoja?.tipo === 'zona' ? hoja.z : null;
  let seleccion: string | null = null;
  if (borrador?.destino && PROV[borrador.destino]) { zonaMapa = PROV[borrador.destino].zona; seleccion = borrador.destino; }
  else if (borrador?.destino && tipo === 'zona') { zonaMapa = borrador.destino as ZonaId; }

  const elegirCarta = (id: IdCarta) => {
    if (!activa) return;
    haptica(8);
    setHoja(null);
    setBorrador({ carta: id });
  };

  const jugar = (r: Respuesta) => {
    haptica(15);
    setBorrador(null);
    responder(r);
  };

  if (v.ganador && !mapaFinal && !momento) {
    return <Noche v={v} onRevancha={onRevancha} onMenu={onSalir} onTablero={() => setMapaFinal(true)} />;
  }

  return (
    <div className="pantalla">
      <Barra v={v} proy={proy} onCongreso={() => setHoja({ tipo: 'congreso' })} onMenu={() => setHoja({ tipo: 'menu' })} />
      <TiraAgenda v={v} onAbrir={() => setHoja({ tipo: 'agenda' })} />
      <div className="tablero">
        <Mapa
          v={v}
          zona={zonaMapa}
          provincias={eligiendo && tipo === 'provincia' ? new Set(destinos) : null}
          zonas={eligiendo && tipo === 'zona' ? new Set(destinos) : null}
          seleccion={seleccion}
          pulso={pulso}
          onZona={(z) => {
            if (eligiendo && tipo === 'zona') { if (destinos.includes(z)) setBorrador({ ...borrador!, destino: z }); return; }
            if (!borrador) setHoja({ tipo: 'zona', z });
          }}
          onProvincia={(id) => {
            if (eligiendo && tipo === 'provincia') { if (destinos.includes(id)) setBorrador({ ...borrador!, destino: id }); return; }
            if (!borrador) setHoja({ tipo: 'zona', z: PROV[id].zona });
          }}
        />
        <button type="button" className="chip chip-maquinaria" onClick={() => setHoja({ tipo: 'maquinaria' })} data-testid="maquinaria">
          Maquinaria {v.maquinaria[v.yo].calle}·{v.maquinaria[v.yo].medios}·{v.maquinaria[v.yo].datos}
        </button>
        {mapaFinal && <button type="button" className="boton principal volver-noche" onClick={() => setMapaFinal(false)}>Volver a los resultados</button>}
      </div>
      <Mano v={v} activa={activa} pensando={pensando} sel={borrador?.carta ?? null} onCarta={elegirCarta} />

      {borrador && opcion && <HojaJugada v={v} opcion={opcion} borrador={borrador} proy={proy} onCambiar={setBorrador} onJugar={jugar} onCerrar={() => setBorrador(null)} />}
      {hoja?.tipo === 'zona' && <HojaZona v={v} z={hoja.z} proy={proy} onCerrar={() => setHoja(null)} />}
      {hoja?.tipo === 'congreso' && <HojaCongreso v={v} proy={proy} onCerrar={() => setHoja(null)} />}
      {hoja?.tipo === 'agenda' && <HojaAgenda v={v} onCerrar={() => setHoja(null)} />}
      {hoja?.tipo === 'maquinaria' && <HojaMaquinaria v={v} onCerrar={() => setHoja(null)} />}
      {hoja?.tipo === 'menu' && <HojaMenu v={v} onCerrar={() => setHoja(null)} onSalir={onSalir} onAyuda={() => { setHoja(null); setAyuda(true); }} />}

      {momento && <Momento key={momento.seq} v={v} m={momento} onSeguir={() => marcarVisto(momento.fin)} />}
      {libre && d?.tipo === 'opcion' && <DecisionOpcion d={d} onResponder={responder} />}
      {libre && d?.tipo === 'debate' && <DecisionDebate key={v.n} v={v} d={d} onResponder={responder} />}
      {error && <button type="button" className="aviso-flotante" onClick={limpiarError}>{error}</button>}
      {ayuda && <Ayuda onCerrar={() => setAyuda(false)} />}
    </div>
  );
}
