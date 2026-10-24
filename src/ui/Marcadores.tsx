import { CARRERA, FECHAS, HITOS, rondasDe, zonaVetada } from '../engine/reglas';
import { fmtVentaja, NOMBRES_CLIMA } from '../engine/motor';
import { ZONAS } from '../data/provincias';
import { CORTO_BANDO } from '../data/partidos';
import type { Estado, ZonaId } from '../engine/tipos';

const COLOR_CLIMA: Record<number, string> = { 5: '#52c08a', 4: '#c8c24a', 3: '#e8a33c', 2: '#e5603f', 1: '#9e1f2b' };

function Medidor({ valor, min, max }: { valor: number; min: number; max: number }) {
  const puntos = [];
  for (let i = min; i <= max; i++) puntos.push(<i key={i} className={`${i === valor ? 'on' : ''} ${i === 0 ? 'cero' : ''}`} />);
  return <span className="medidor" aria-label={`${valor > 0 ? '+' : ''}${valor}`}>{puntos}</span>;
}

export function Marcadores({ e, onAyuda, onMenu }: { e: Estado; onAyuda: () => void; onMenu: () => void }) {
  const vetadas = (['CAT', 'NOR', 'MAD'] as ZonaId[]).filter((z) => zonaVetada(e, z));
  const pctVentaja = 50 + (e.ventaja / 20) * 50;
  const ronda = e.fase === 'portada' ? 'Portada' : e.fase === 'preparacion' ? 'Preparación' : `Ronda ${e.ronda} de ${e.enJuego ? rondasDe(e, e.enJuego) : rondasDe(e, 'P')}`;
  return (
    <header className="marcadores">
      <div className="marcador caja semana">
        <span className="etiqueta">Semana {Math.max(1, e.turno)} de 8</span>
        <span className="valor">{e.turno ? FECHAS[e.turno] : '5 oct'}</span>
        <span className="hito">{e.turno ? HITOS[e.turno] : 'Disolución de las Cortes'}</span>
        <span style={{ display: 'flex', gap: 4 }}>
          <button className="boton pequeno" onClick={onAyuda} type="button">Reglas</button>
          <button className="boton pequeno" onClick={onMenu} type="button">Menú</button>
        </span>
      </div>
      <div className="marcador caja">
        <span className="etiqueta">{ronda}</span>
        <span className="valor">{e.enJuego ? <span className={e.enJuego === 'P' ? 'p' : 'c'}>Juega {CORTO_BANDO[e.enJuego]}</span> : '—'}</span>
        <span className="hito">Mazo {e.mazo.length} · descarte {e.descarte.length}</span>
      </div>
      <div className="marcador caja">
        <span className="etiqueta">Ventaja demoscópica</span>
        <div className="barra-ventaja" title="−20 Progresista … +20 Conservador: llegar a 20 gana la partida">
          <span className="eje" />
          <span className="ficha" style={{ left: `${pctVentaja}%` }} />
        </div>
        <span className="valor dato" style={{ fontSize: 14 }}>{fmtVentaja(e.ventaja)}</span>
      </div>
      <div className="marcador caja">
        <span className="etiqueta">Clima de campaña</span>
        <div className="clima">
          {[5, 4, 3, 2, 1].map((n) => (
            <span key={n} className={n === e.clima ? 'activo' : ''} style={n === e.clima ? { background: COLOR_CLIMA[n] } : undefined} title={NOMBRES_CLIMA[n]}>{n}</span>
          ))}
        </div>
        <span className="hito">{NOMBRES_CLIMA[e.clima]}{vetadas.length ? ` · sin ofensivas en ${vetadas.map((z) => ZONAS[z].nombre).join(', ')}` : ''}</span>
      </div>
      <div className="marcador caja">
        <span className="etiqueta">Exigencia de las bases</span>
        <span className="valor dato" style={{ fontSize: 14 }}>
          <span className="p">{e.exigencia.P}</span>/{e.clima} · <span className="c">{e.exigencia.C}</span>/{e.clima}
        </span>
        <span className="hito">PC de ofensiva / exigidos</span>
      </div>
      <div className="marcador caja">
        <span className="etiqueta">Carrera Programática</span>
        {(['P', 'C'] as const).map((b) => (
          <span key={b} className="pista" title={`${CORTO_BANDO[b]}: ${e.carrera[b] ? CARRERA[e.carrera[b] - 1].nombre : 'sin empezar'}`}>
            {CARRERA.map((_, i) => <i key={i} className={i < e.carrera[b] ? `lleno-${b.toLowerCase()}` : ''} />)}
          </span>
        ))}
      </div>
      <div className="marcador caja">
        <span className="etiqueta">Socios del bloque</span>
        <span className="hito fila-medidor"><b className="c">Vox</b><Medidor valor={e.socio.C} min={-3} max={3} /></span>
        <span className="hito fila-medidor"><b className="p">FA + Podemos</b><Medidor valor={e.socio.P} min={-3} max={3} /></span>
      </div>
      <div className="marcador caja">
        <span className="etiqueta">Izquierda · Voto Útil</span>
        <span className="hito" style={{ color: 'var(--tinta)' }}>{e.listaConjunta === null ? `Unidad ${e.unidad}/3 (con 3, lista conjunta)` : e.listaConjunta ? 'FA y Podemos, lista conjunta' : 'FA y Podemos, por separado'}</span>
        <span className="hito">Voto Útil: <b className={e.votoUtil.duenio === 'P' ? 'p' : 'c'}>{CORTO_BANDO[e.votoUtil.duenio]}</b>{e.votoUtil.disponible ? '' : ' (boca abajo)'}</span>
      </div>
    </header>
  );
}
