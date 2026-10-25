// Imprime el listado de cartas en Markdown (se pega al final de docs/REGLAMENTO.md): npx tsx scripts/listar-cartas.ts
import { CARTAS_LISTA } from '../src/data/mazos';
import { CORTO_TEMA, DUENO_TEMA } from '../src/motor/agenda';
import type { Carta, MazoId } from '../src/motor/tipos';

const MAZO: Record<MazoId, string> = { P: 'Mazo progresista', C: 'Mazo conservador', actualidad: 'Actualidad (una noticia por semana)', podemos: 'Agenda de Podemos (una por semana)' };
const FASE: Record<number, string> = { 1: 'semanas 1-3', 2: 'desde la 4', 3: 'desde la 7' };
const esc = (s: string) => s.replace(/\|/g, '\\|');
const ajena = (c: Carta) => (c.mazo === 'P' || c.mazo === 'C') && DUENO_TEMA[c.tema] !== c.mazo;

for (const m of ['P', 'C', 'actualidad', 'podemos'] as MazoId[]) {
  const cs = CARTAS_LISTA.filter((c) => c.mazo === m).sort((a, b) => a.fase - b.fase || a.id - b.id);
  const bloque = m === 'P' || m === 'C';
  console.log(`\n### ${MAZO[m]} (${cs.length} cartas)\n`);
  console.log(bloque ? '| Carta | Fuerza | Tema | Entra | Efecto |\n|---|---|---|---|---|' : '| Carta | Tema | Efecto |\n|---|---|---|');
  for (const c of cs) {
    const nombre = `${esc(c.nombre)}${c.retirar ? ' *' : ''}${c.noticia ? ' · noticia' : ''}`;
    const tema = `${CORTO_TEMA[c.tema]}${ajena(c) ? ' ⚠' : ''}`;
    console.log(bloque ? `| ${nombre} | ${c.fuerza} | ${tema} | ${FASE[c.fase]} | ${esc(c.texto)} |` : `| ${nombre} | ${tema} | ${esc(c.texto)} |`);
  }
}
const n = (m: MazoId) => CARTAS_LISTA.filter((c) => c.mazo === m).length;
const nAjenas = (m: MazoId) => CARTAS_LISTA.filter((c) => c.mazo === m && ajena(c)).length;
console.log(`\nResumen: ${n('P')} cartas progresistas (${nAjenas('P')} de tema rival o de corrupción), ${n('C')} conservadoras (${nAjenas('C')}), ${n('actualidad')} noticias de Actualidad y ${n('podemos')} cartas de la Agenda de Podemos. ⚠ = tema del rival o corrupción: al jugarla calientas un tema que no es tuyo. * = se retira tras jugar el evento. «noticia» = basada en un hecho real.`);
