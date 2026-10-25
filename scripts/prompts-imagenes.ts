// Genera docs/PROMPTS_IMAGENES.md con un prompt por carta: npx tsx scripts/prompts-imagenes.ts
import { writeFileSync } from 'node:fs';
import { CARTAS_LISTA, idArte } from '../src/data/mazos';
import type { MazoId } from '../src/motor/tipos';
import { ESTILO_ARTE, promptImagen, rutaImagen } from '../src/data/arte';

const MAZO: Record<MazoId, string> = { P: 'Mazo progresista', C: 'Mazo conservador', actualidad: 'Actualidad', podemos: 'Agenda de Podemos' };

const l: string[] = [];
l.push('# Prompts de imagen de las cartas');
l.push('');
l.push('Un prompt por carta para generar su ilustración con un modelo de imagen (por ejemplo, ChatGPT). Todas comparten el mismo estilo, así que la baraja sale coherente.');
l.push('');
l.push('## Cómo usarlos');
l.push('');
l.push('1. Pega en el chat el **estilo común** una sola vez y pide que lo mantenga en todas las imágenes.');
l.push('2. Después pega el prompt de cada carta (ya incluye el estilo, por si lo usas suelto).');
l.push('3. Guarda cada imagen en formato 4:3 (por ejemplo 1200 × 900) como `src/assets/cartas/<id>.webp` (también vale .png o .jpg). Al compilar, el juego la muestra sola; si falta, enseña el marcador con la descripción de la escena.');
l.push('4. Revisa que no salga texto, logotipos ni caras reconocibles: el juego es neutral y no retrata a personas reales.');
l.push('');
l.push('## Estilo común');
l.push('');
l.push('```');
l.push(ESTILO_ARTE);
l.push('```');
// las copias de una carta común (en los dos mazos) comparten ilustración: un solo prompt
const conArte = CARTAS_LISTA.filter((c) => idArte(c) === c.id);
for (const m of ['P', 'C', 'actualidad', 'podemos'] as MazoId[]) {
  const cs = conArte.filter((c) => c.mazo === m);
  l.push('');
  l.push(`## ${MAZO[m]} (${cs.length} ilustraciones)`);
  for (const c of cs) {
    const copias = CARTAS_LISTA.filter((x) => x.arte === c.id).map((x) => x.id);
    l.push('');
    l.push(`### ${c.id} · ${c.nombre}`);
    l.push('');
    l.push(`${MAZO[m]}${c.pareja !== undefined ? ` · pareja de la ${c.pareja}` : ''}${copias.length ? ` · también la usa la ${copias.join(', ')}` : ''} · archivo \`${rutaImagen(c.id)}\``);
    l.push('');
    l.push('```');
    l.push(promptImagen(c));
    l.push('```');
  }
}
writeFileSync(new URL('../docs/PROMPTS_IMAGENES.md', import.meta.url), l.join('\n') + '\n');
console.log(`docs/PROMPTS_IMAGENES.md: ${conArte.length} prompts`);
