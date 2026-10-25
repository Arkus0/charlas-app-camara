import { CARRERA } from '../engine/reglas';
import { FUENTE_DATOS } from '../data/provincias';
import { PLATO } from '../data/plato';

export function Ayuda({ onCerrar }: { onCerrar: () => void }) {
  return (
    <div className="velo" role="dialog" aria-modal="true" aria-labelledby="titulo-ayuda" onClick={onCerrar}>
      <div className="caja dialogo" onClick={(ev) => ev.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
          <h2 id="titulo-ayuda">Cómo se juega</h2>
          <button className="boton pequeno" type="button" onClick={onCerrar}>Cerrar</button>
        </div>
        <div className="ayuda">
          <p>Dos bloques se disputan el Congreso durante las ocho semanas que van de la disolución de las Cortes (6 de octubre) a la noche electoral del 29 de noviembre. Gana quien consiga investir a su candidato: <b>176 síes</b> en primera votación o <b>más síes que noes</b> en la segunda.</p>
          <h3>Cada semana</h3>
          <ul>
            <li><b>Portada:</b> los dos eligen a la vez una carta cuyo evento abre la semana. Va primero la de más PC.</li>
            <li><b>Rondas de acción</b> (6 en precampaña, 7 después): cada carta se juega como <b>evento</b>, por sus <b>PC</b> o en la <b>Carrera Programática</b>.</li>
            <li>Si usas por sus PC una carta del rival, <b>su evento se activa igualmente</b>. Es la regla clave: decide cuándo y cómo quitarte las cartas del rival.</li>
            <li><b>Encuestas:</b> puntúan una zona (presencia, dominio o control, +1 por clave y por feudo rival controlados; máx. 5 PV). Hay que publicarlas antes de que acabe la semana.</li>
            <li><b>Exigencia de las bases:</b> al final de la semana debes haber gastado en ofensivas tantos PC como marque el Clima. Lo que falte son PV para el rival.</li>
          </ul>
          <h3>Las operaciones</h3>
          <ul>
            <li><b>Presencia:</b> 1 PC por punto (2 si el rival controla la provincia), en provincias con tu presencia, vecinas o en Madrid.</li>
            <li><b>Control:</b> controlas una provincia si tu presencia supera a la rival en su Fidelidad (el número del círculo).</li>
            <li><b>Ofensiva:</b> dado + PC − 2 × Fidelidad. Si sale positivo, quitas esa presencia al rival y el sobrante es tuyo. En una provincia clave (◆) baja el Clima.</li>
            <li><b>Debate local:</b> por cada PC, un duelo de dados; suman las vecinas que controlas, tener más presencia y que sea tu feudo.</li>
            <li><b>Negociar:</b> 2 PC por paso de afinidad de una fuerza regional (PNV, Junts, ERC, Bildu, BNG, CC…). Las cesiones a ERC, Junts o Bildu dan 1 PV al Conservador.</li>
          </ul>
          <h3>Como en Twilight Struggle</h3>
          <ul>
            <li><b>Efectos en vigor:</b> algunas cartas dejan reglas activas (más PC, zonas blindadas, bastiones, atascos, manifiestos, denuncias…). Las ves en el panel «En vigor».</li>
            <li><b>Batallas:</b> dado menos las provincias vecinas que controle el rival; con 4 o más, su presencia allí pasa a ser tuya y ganas 2 PV.</li>
            <li><b>Atasco:</b> si el rival te mete en una guerra interna, cada ronda descartas una carta de 2 o más PC y sales con 1-4.</li>
            <li><b>Crisis institucional:</b> el Clima cae a 2 y quien lance una ofensiva esa semana pierde, salvo que la desactive retirando presencia en Madrid o Barcelona.</li>
            <li><b>Junta Electoral Central:</b> usas los PC de una carta del rival o de Podemos sin su evento, y anula las denuncias.</li>
            <li><b>Asalto a la Moncloa:</b> quien controle a la vez Madrid y Centro y Cataluña al publicarse cualquiera de sus Encuestas gana la partida.</li>
            <li><b>Cartas con noticia:</b> las marcadas «Noticia» se basan en hechos reales verificados. Cada bloque tiene las suyas, con los mismos PC y efectos equivalentes.</li>
          </ul>
          <h3>Clima, Ventaja y Voto Útil</h3>
          <ul>
            <li><b>Clima de campaña</b> (5 Sereno → 1 Ruptura): sube 1 cada semana. Quien lo lleve a 1 en su jugada pierde. Con Clima 4 no hay ofensivas en Cataluña; con 3, tampoco en la Cornisa Norte; con 2, tampoco en Madrid y Centro.</li>
            <li><b>Ventaja demoscópica:</b> cada PV desplaza 0,4 puntos de voto en toda España. Llegar a 20 es victoria inmediata.</li>
            <li><b>El Voto Útil:</b> 4 PC (+1 en circunscripciones de 5 escaños o menos). Empieza en manos del Gobierno y, tras usarla, pasa boca abajo al rival. Quien la tenga al final suma 1 PV.</li>
            <li><b>Socios:</b> los medidores de Vox y de Frente Amplio reparten el voto dentro de cada bloque. Más socio moviliza algo más, pero D'Hondt castiga la división. Con el <b>veto de Vox</b> activo (medidor en 0 o más), PNV, Junts y CC no darán el sí al PP.</li>
          </ul>
          <h3>Podemos, el comodín</h3>
          <ul>
            <li>Podemos va por libre: no pertenece a ningún bloque. Su <b>fuerza</b> (−3…+3) le quita voto sobre todo a PSOE y Frente Amplio, y algo de voto protesta a la derecha.</li>
            <li>Su <b>humor</b> (−3…+3) decide su voto en la investidura de Sánchez: sí con +1 o más, abstención con 0, no con −1 o menos. A Feijóo no le vota nunca.</li>
            <li>Las <b>cartas moradas</b> son sus comodines: su evento se activa siempre, aunque las uses por sus PC (solo la Carrera lo evita). Siembran el caos en los dos bloques: elige bien cuándo soltarlas.</li>
            <li>Solo el Progresista puede negociar con Podemos (2 PC por punto de humor), y cada cesión da 1 PV al Conservador.</li>
            <li><b>Agenda de Podemos:</b> cada semana, tras las Portadas, Podemos destapa una carta propia. Casi siempre golpea a quien lidera la Ventaja.</li>
            <li><b>Marcadores morados:</b> donde Podemos desembarca, la provincia gana +1 de Fidelidad y Podemos sube allí. Puede dejar sin control a quien la tenía.</li>
          </ul>
          <h3>Carrera Programática</h3>
          <ul>
            {CARRERA.map((c, i) => <li key={i}><b>{i + 1}. {c.nombre}</b> ({c.pc} PC, éxito con {c.tirada} o menos): {c.texto}</li>)}
          </ul>
          <h3>El calendario real</h3>
          <ul>
            <li>Fin de la semana 3: <b>cierre de listas</b> (26 oct). Podemos va en solitario y un dado decide su estrategia: ir a por todas (+1 fuerza, −1 humor), seguir igual o guiñar al PSOE (+1 humor).</li>
            <li>Semana 6: arranca la campaña el 13N, con pegada de carteles (2 de presencia cada uno).</li>
            <li>Semana 7: <b>cara a cara</b> el 16N. Cada uno sacrifica una carta; ganan sus PC + dado + preparación.</li>
            <li>Semana 8: <b>debate a cuatro</b> el 26N y <b>veda demoscópica</b>: las Encuestas no dan PV, salvo «El Periódico de Andorra».</li>
          </ul>
          <h3>El plató</h3>
          <p>Al cerrar cada semana conectamos con el plató de {PLATO.programa}: el presentador y cuatro tertulianos cuentan la campaña como una historia, con sus rachas, sus vuelcos y la noticia de la semana. La noche electoral tiene su especial. Los nombres son ficticios y se cambian en <code>src/data/plato.ts</code>.</p>
          <h3>La noche electoral</h3>
          <p>El voto de partida es la media de encuestas de octubre de 2026 repartida por provincias. La presencia neta en cada circunscripción, la Ventaja y los medidores desplazan votos. Se reparten los escaños con D'Hondt (umbral del 3%) y se vota la investidura. Si nadie la logra, hay repetición electoral y gana quien lidera la Ventaja.</p>
          <p className="fuente">Datos: {FUENTE_DATOS}. Resultados oficiales de 2023 del Ministerio del Interior. Escaños de 2026 según el RD 806/2026.</p>
        </div>
      </div>
    </div>
  );
}
