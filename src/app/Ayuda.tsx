// Cómo se juega: lo esencial en seis pantallas cortas.
import { useState } from 'react';
import { Hoja } from './comun/Hoja';

const PAGINAS: { titulo: string; texto: string[] }[] = [
  {
    titulo: 'El objetivo',
    texto: [
      'Ocho semanas de campaña hasta el 29N. Gana quien consigue investir a su candidato: 176 síes, o más síes que noes en la segunda votación.',
      'Los escaños se reparten con D\'Hondt en las 52 circunscripciones, con datos reales de las encuestas. Arriba ves en todo momento cuántos apoyos tendría cada candidato si se votara hoy.',
    ],
  },
  {
    titulo: 'Tu turno',
    texto: [
      'Cada semana tienes 3 jugadas (4 desde la semana 4) y alternas con el rival. Empieza quien va por delante: el que va detrás cierra la semana.',
      'Toca una carta y elige cómo jugarla: su evento, sus PC para implantarte en una zona, atacar una provincia, negociar con una fuerza regional o con Podemos, marcar la agenda o subir tu Maquinaria. Antes de jugar verás siempre la previsión de escaños.',
    ],
  },
  {
    titulo: 'El mapa',
    texto: [
      'Controlas una provincia si tu presencia supera a la del rival en su Fidelidad. La presencia mueve votos: mucho en las provincias pequeñas, poco en Madrid.',
      'Implantar cuesta 1 PC por punto (2 donde controla el rival, y como mucho 2 por provincia). Atacar suma PC + vecinas tuyas + 1 − Fidelidad ± un dado suave; en una provincia clave baja el Clima.',
    ],
  },
  {
    titulo: 'La Agenda',
    texto: [
      'Siete temas con calor. Vivienda, Servicios públicos y Derechos favorecen al Progresista; Economía, Inmigración y Unidad de España, al Conservador. La Corrupción castiga al último salpicado.',
      'Jugar una carta calienta su tema. Los dos temas más calientes dan +1 PC a sus cartas y, al cerrar la semana, 2 PV al dueño del primero y 1 al del segundo. Tu mejor carta puede ser de un tema del rival: si la juegas, le haces la campaña.',
    ],
  },
  {
    titulo: 'Encuestas, Clima y pactos',
    texto: [
      'Cada semana se publica la encuesta de una zona (ves las próximas en el mapa): da PV a quien la domine. La Ventaja en PV mueve el voto en toda España; a 25, vuelco y la campaña termina.',
      'El Clima baja con los ataques y los escándalos. Si llega a 1 durante tu jugada, pierdes. Negocia con las fuerzas regionales y con Podemos: sus votos deciden la investidura.',
    ],
  },
  {
    titulo: 'La semana',
    texto: [
      'Cada semana empieza con una noticia real y una carta de la Agenda de Podemos, que suele castigar al que va primero. Al cerrar, encuesta, tema dominante y el plató lo cuenta.',
      'Hitos: cierre de listas (semana 3), pegada de carteles (6), cara a cara (7) y debate a cuatro (8). En los debates eliges una carta y un tema: tus temas en agenda suman.',
    ],
  },
];

export function Ayuda({ onCerrar }: { onCerrar: () => void }) {
  const [i, setI] = useState(0);
  const p = PAGINAS[i];
  return (
    <Hoja
      titulo={`Cómo se juega · ${i + 1}/${PAGINAS.length}`}
      onCerrar={onCerrar}
      pie={
        <div className="pie-ayuda">
          <button type="button" className="boton grande" disabled={i === 0} onClick={() => setI(i - 1)}>Atrás</button>
          {i < PAGINAS.length - 1
            ? <button type="button" className="boton principal grande" onClick={() => setI(i + 1)}>Siguiente</button>
            : <button type="button" className="boton principal grande" onClick={onCerrar}>A jugar</button>}
        </div>
      }
    >
      <div className="ayuda">
        <h3>{p.titulo}</h3>
        {p.texto.map((t, k) => <p key={k}>{t}</p>)}
      </div>
    </Hoja>
  );
}
