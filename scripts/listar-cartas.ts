// Imprime el listado de cartas en Markdown (se pega al final de docs/REGLAMENTO.md): npx tsx scripts/listar-cartas.ts
import { CARTAS_LISTA } from '../src/data/cartas';

const LADO: Record<string, string> = { P: 'Progresista', C: 'Conservador', N: 'Neutral', E: 'Encuesta' };
const MAZO: Record<number, string> = { 0: 'Especial', 1: 'Mazo I · Precampaña (semana 1)', 2: 'Mazo II · Campaña (semana 4)', 3: 'Mazo III · Recta final (semana 7)' };
const esc = (s: string) => s.replace(/\|/g, '\\|');
for (const m of [0, 1, 2, 3]) {
  const cs = CARTAS_LISTA.filter((c) => c.mazo === m);
  console.log(`\n### ${MAZO[m]} (${cs.length} cartas)\n`);
  console.log('| Carta | PC | Evento | Efecto |');
  console.log('|---|---|---|---|');
  for (const c of cs) console.log(`| ${esc(c.nombre)}${c.retirar ? ' *' : ''} | ${c.lado === 'E' ? '—' : c.ops} | ${LADO[c.lado]} | ${esc(c.texto)} |`);
}
const ops = (l: string) => CARTAS_LISTA.filter((c) => c.lado === l).reduce((a, c) => a + c.ops, 0);
const n = (l: string) => CARTAS_LISTA.filter((c) => c.lado === l).length;
console.log(`\nResumen: ${n('P')} progresistas (${ops('P')} PC), ${n('C')} conservadoras (${ops('C')} PC), ${n('N')} neutrales, ${n('E')} encuestas. * = se retira tras jugar el evento.`);
