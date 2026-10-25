// Ilustraciones de las cartas: ruta de la imagen y prompt para generarla con un modelo de imagen
// (por ejemplo, la generación de imágenes de ChatGPT). Todas comparten el mismo estilo para que la baraja sea coherente.
import type { Carta, LadoCarta } from '../engine/tipos';

/** Carpeta donde van las imágenes: <id>.webp (o .png/.jpg), en formato 4:3. La interfaz las recoge al compilar. */
export const CARPETA_IMAGENES = 'src/assets/cartas';
export const rutaImagen = (id: number) => `${CARPETA_IMAGENES}/${id}.webp`;

export const ESTILO_ARTE = [
  'Ilustración editorial para una carta de un juego de mesa de estrategia política, en estilo serigrafía o risografía:',
  'formas planas y geométricas, grano de impresión visible, sombras de trama, composición simbólica y limpia, encuadre horizontal 4:3.',
  'Paleta limitada: azul noche #0d1524 de fondo, papel crudo #f3f1ea, rojo #e5483f, azul #3a86e8 y dorado #e8b64a;',
  'el morado #8e44c4 solo en las cartas de Podemos.',
  'Sin personas reconocibles ni políticos reales (solo siluetas anónimas o manos), sin logotipos ni símbolos de partidos,',
  'sin banderas oficiales ni escudos, y sin ningún texto, letra o número legible.',
].join(' ');

const COLOR_LADO: Record<LadoCarta, string> = {
  P: 'Color dominante: rojo #e5483f (carta del bloque progresista).',
  C: 'Color dominante: azul #3a86e8 (carta del bloque conservador).',
  N: 'Color dominante: dorado #e8b64a (carta neutral), con toques de rojo y azul equilibrados.',
  E: 'Color dominante: papel crudo #f3f1ea con barras rojas y azules equilibradas (carta de Encuesta).',
  W: 'Color dominante: morado #8e44c4 (comodín de Podemos), con rojo y azul en segundo plano.',
  A: 'Color dominante: morado #8e44c4 sobre azul noche (Agenda de Podemos), con un marco morado más grueso.',
};

export function promptImagen(c: Carta): string {
  return `${ESTILO_ARTE}\n\nEscena: ${c.escena}.\n${COLOR_LADO[c.lado]}`;
}
