// Hojas de consulta: una zona, el Congreso y los pactos, la Agenda, la Maquinaria y el menú.
import { useState } from 'react';
import { PARTIDOS } from '../../data/partidos';
import { PROVINCIAS, ZONAS } from '../../data/provincias';
import { duenoTema, enAgenda, NOMBRE_TEMA, temasOrdenados } from '../../motor/agenda';
import { RIVAL, type RegionalId, type ZonaId } from '../../motor/base';
import { HUMOR_PODEMOS } from '../../motor/cambios';
import { posturaPodemos, REGIONALES, vetoVoxActivo, votoInvestidura, votoPodemos, VETADOS_POR_VOX, type Resultado } from '../../motor/electoral';
import { RAMAS, NOMBRE_RAMA, VENTAJAS } from '../../motor/maquinaria';
import { controlador, fidelidadEf, puntuarZona, TOPE_VENTAJA } from '../../motor/reglas';
import type { Vista } from '../../motor/vista';
import { cronicaSemana } from '../../narrativa/cronica';
import { Hemiciclo } from '../comun/Hemiciclo';
import { Hoja } from '../comun/Hoja';
import { IconoRama, IconoTema } from '../comun/Iconos';
import { activarVibracion, vibracionActiva } from '../comun/haptica';
import { Afinidad } from './HojaJugada';
import { Plato } from './Momento';
import { LIDER, nombreProv, NOMBRE_CLIMA, SIGLAS_BLOQUE } from '../textos';

export function HojaZona({ v, z, proy, onCerrar }: { v: Vista; z: ZonaId; proy: Resultado; onCerrar: () => void }) {
  const ps = PROVINCIAS.filter((p) => p.zona === z).sort((a, b) => b.escanos - a.escanos);
  const punt = puntuarZona(v, z);
  let semana: number | null = null;
  for (let s = Math.max(1, v.semana); s <= 7; s++) if (v.calendario[s] === z) { semana = s; break; }
  return (
    <Hoja titulo={ZONAS[z].nombre} onCerrar={onCerrar} alto="media">
      <p className="pista">
        {semana ? `Encuesta ${semana === v.semana ? 'al cerrar esta semana' : `en la semana ${semana}`}. ` : 'Su encuesta ya se publicó. '}
        Hoy: {punt.neto === 0 ? 'empate' : `+${Math.abs(punt.neto)} PV para el ${punt.neto > 0 ? 'Conservador' : 'Progresista'}`}.
      </p>
      <div className="lista" role="list">
        {ps.map((p) => {
          const pr = v.presencia[p.id];
          const ctrl = controlador(v, p.id);
          const esc = proy.porProvincia[p.id] ?? {};
          const bP = (esc.PSOE ?? 0) + (esc.SUMAR ?? 0);
          const bC = (esc.PP ?? 0) + (esc.VOX ?? 0);
          return (
            <div key={p.id} className={`fila fila-prov ${ctrl === 'P' ? 'ctrl-p' : ctrl === 'C' ? 'ctrl-c' : ''}`}>
              <span className="fila-nombre">{p.clave ? '◆ ' : ''}{nombreProv(p.id)}<small className="tenue">fid. {fidelidadEf(v, p.id)}{p.feudo ? ` · feudo ${p.feudo === 'P' ? 'rojo' : 'azul'}` : ''}{v.morado[p.id] ? ` · ${v.morado[p.id]} morado` : ''}</small></span>
              <span className="dato pres"><b className="p">{pr.P}</b>·<b className="c">{pr.C}</b></span>
              <span className="dato escanos-prov"><b className="p">{bP}</b>·<b className="c">{bC}</b><small className="tenue">/{p.escanos}</small></span>
            </div>
          );
        })}
      </div>
      <p className="pista tenue">Presencia (rojo·azul) y escaños de cada bloque si se votara hoy. Controlas una provincia si tu presencia supera a la rival en su Fidelidad.</p>
    </Hoja>
  );
}

export function HojaCongreso({ v, proy, onCerrar }: { v: Vista; proy: Resultado; onCerrar: () => void }) {
  const pod = posturaPodemos(v);
  const veto = vetoVoxActivo(v);
  const voto = { si: 'sí', no: 'no', abst: 'abst.' } as const;
  return (
    <Hoja titulo="Si se votara hoy" onCerrar={onCerrar}>
      <Hemiciclo escanos={proy.escanos} className="hemiciclo" />
      <div className="bloques">
        <div className="bloque p"><b className="dato">{proy.bloque.P}</b><span>{SIGLAS_BLOQUE.P}</span><small>{proy.apoyos.P} síes posibles a {LIDER.P}</small></div>
        <div className="bloque c"><b className="dato">{proy.bloque.C}</b><span>{SIGLAS_BLOQUE.C}</span><small>{proy.apoyos.C} síes posibles a {LIDER.C}</small></div>
      </div>
      <p className="veredicto">{proy.ganador ? `Hoy gobernaría ${LIDER[proy.ganador]}. ` : ''}{proy.motivo}.</p>
      <h4 className="etiqueta">Ventaja y Clima</h4>
      <p className="pista">Ventaja demoscópica {v.ventaja === 0 ? '0' : `+${Math.abs(v.ventaja)} ${v.ventaja > 0 ? 'Conservador' : 'Progresista'}`}: cada punto mueve 0,4 de voto en toda España (a {TOPE_VENTAJA}, vuelco). Clima {v.clima} ({NOMBRE_CLIMA[v.clima]}): si llega a 1 durante tu jugada, pierdes.</p>
      <h4 className="etiqueta">Pactos para la investidura</h4>
      <div className="lista">
        <div className="fila">
          <i className="color-zona" style={{ background: PARTIDOS.PODEMOS.color }} />
          <span className="fila-nombre">Podemos <small className="tenue">fuerza {v.podemos.fuerza} · {HUMOR_PODEMOS[v.podemos.humor]} · pinza {v.podemos.pinza}/3</small></span>
          <span className="dato">{voto[votoPodemos('P', pod)]} / {voto[votoPodemos('C', pod)]}</span>
        </div>
        {REGIONALES.map((k) => (
          <div key={k} className="fila">
            <i className="color-zona" style={{ background: PARTIDOS[k].color }} />
            <span className="fila-nombre">{PARTIDOS[k].siglas} <small className="tenue">{proy.escanos[k] ?? 0} esc.{veto && VETADOS_POR_VOX.includes(k as RegionalId) ? ' · veto de Vox' : ''}</small></span>
            <Afinidad a={v.afinidad[k]} />
            <span className="dato">{voto[votoInvestidura(k, 'P', v.afinidad, veto, pod)]} / {voto[votoInvestidura(k, 'C', v.afinidad, veto, pod)]}</span>
          </div>
        ))}
      </div>
      <p className="pista tenue">Voto a Sánchez / a Feijóo. Socios: Vox {v.socio.C >= 0 ? '+' : ''}{v.socio.C}, Frente Amplio {v.socio.P >= 0 ? '+' : ''}{v.socio.P}. {veto ? 'Con Vox fuerte, PNV, Junts y CC no votan sí a Feijóo.' : ''}</p>
    </Hoja>
  );
}

export function HojaAgenda({ v, onCerrar }: { v: Vista; onCerrar: () => void }) {
  const top = enAgenda(v);
  return (
    <Hoja titulo="La Agenda" onCerrar={onCerrar} alto="media">
      <p className="pista">Jugar una carta calienta su tema. Los dos temas más calientes dan +1 PC a sus cartas y, al cerrar la semana, <b>2 PV</b> al dueño del primero y <b>1 PV</b> al del segundo. Después, el calor se reduce a la mitad.</p>
      <div className="lista">
        {temasOrdenados(v).map((t) => {
          const dueno = duenoTema(v, t);
          const pos = top.indexOf(t);
          return (
            <div key={t} className={`fila fila-tema ${dueno === v.yo ? 'mio' : dueno ? 'suyo' : ''}`}>
              <span className={`tema-carta tema-${t}`}><IconoTema tema={t} size={16} /></span>
              <span className="fila-nombre">{NOMBRE_TEMA[t]}<small className="tenue">{t === 'COR' ? (v.agenda.corrupcion ? `salpica al ${v.agenda.corrupcion === 'P' ? 'Progresista' : 'Conservador'}` : 'aún no salpica a nadie') : dueno === v.yo ? 'tu tema' : 'tema del rival'}</small></span>
              <span className="calor">{[1, 2, 3, 4, 5].map((n) => <i key={n} className={v.agenda.calor[t] >= n ? 'on' : ''} />)}</span>
              <span className="dato">{pos === 0 ? '2 PV' : pos === 1 ? '1 PV' : ''}</span>
            </div>
          );
        })}
      </div>
    </Hoja>
  );
}

export function HojaMaquinaria({ v, onCerrar }: { v: Vista; onCerrar: () => void }) {
  const rival = RIVAL[v.yo];
  return (
    <Hoja titulo="Maquinaria de campaña" onCerrar={onCerrar} alto="media">
      <p className="pista">Descarta una carta de fuerza nivel + 1 para subir una rama (una vez por semana). Quien complete primero una rama gana 2 PV.</p>
      {RAMAS.map((r) => (
        <section key={r} className="rama">
          <h4><IconoRama rama={r} /> {NOMBRE_RAMA[r]} <span className="dato">tú {v.maquinaria[v.yo][r]} · rival {v.maquinaria[rival][r]}</span></h4>
          <ol>{VENTAJAS[r].map((t, i) => <li key={i} className={v.maquinaria[v.yo][r] > i ? 'hecho' : ''}>{t}</li>)}</ol>
        </section>
      ))}
    </Hoja>
  );
}

export function HojaMenu({ v, onCerrar, onSalir, onAyuda }: { v: Vista; onCerrar: () => void; onSalir: () => void; onAyuda: () => void }) {
  const [vista, setVista] = useState<'menu' | 'cronica' | 'plato'>('menu');
  const [semana, setSemana] = useState(Math.max(1, Math.min(7, v.semana - 1)));
  const [vibrar, setVibrar] = useState(vibracionActiva());
  if (vista === 'cronica') {
    return (
      <Hoja titulo="Crónica de la campaña" onCerrar={onCerrar}>
        <ol className="cronica">
          {[...v.cronica.log].reverse().slice(0, 200).map((l) => (
            <li key={l.seq} className={`${l.bando === 'P' ? 'p' : l.bando === 'C' ? 'c' : ''} ${l.tipo ?? ''}`}><span className="tenue dato">S{l.semana}</span> {l.texto}</li>
          ))}
        </ol>
      </Hoja>
    );
  }
  if (vista === 'plato') {
    const seg = cronicaSemana(v.cronica, semana);
    const semanas = v.cronica.historia.filter((h) => h.semana >= 1 && h.semana <= 7).map((h) => h.semana);
    return (
      <Hoja titulo="El plató" onCerrar={onCerrar}>
        <div className="selector-semanas">
          {semanas.map((s) => <button key={s} type="button" className={`chip ${s === semana ? 'on' : ''}`} onClick={() => setSemana(s)}>S{s}</button>)}
        </div>
        {seg ? <Plato segmento={seg} /> : <p className="pista">Aún no ha terminado ninguna semana.</p>}
      </Hoja>
    );
  }
  return (
    <Hoja titulo="Menú" onCerrar={onCerrar} alto="media">
      <div className="menu-lista">
        <button type="button" className="boton" onClick={() => setVista('cronica')}>Crónica de la campaña</button>
        <button type="button" className="boton" onClick={() => setVista('plato')}>El plató de cada semana</button>
        <button type="button" className="boton" onClick={onAyuda}>Cómo se juega</button>
        <label className="ajuste"><input type="checkbox" checked={vibrar} onChange={(ev) => { setVibrar(ev.target.checked); activarVibracion(ev.target.checked); }} /> Vibración</label>
        <button type="button" className="boton" onClick={onSalir}>Volver al menú principal</button>
      </div>
    </Hoja>
  );
}

