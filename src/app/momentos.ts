// Los «momentos»: lo que ha pasado desde la última vez que el jugador miró, agrupado para contarlo
// pantalla a pantalla (la jugada del rival, la noticia de la semana, el cierre con la encuesta, el debate…).
import type { Bando } from '../motor/base';
import type { Cronica, EntradaLog, Suceso } from '../motor/tipos';

type De<S extends Suceso['s']> = Extract<Suceso, { s: S }>;

export type Momento =
  | { tipo: 'rival' | 'propia'; seq: number; fin: number; jugada: De<'jugada'>; efectos: Suceso[]; log: EntradaLog[] }
  | { tipo: 'semana'; seq: number; fin: number; semana: number; noticia?: number; agenda?: De<'agendaPodemos'>; efectos: Suceso[]; log: EntradaLog[] }
  | { tipo: 'cierre'; seq: number; fin: number; semana: number; efectos: Suceso[]; log: EntradaLog[] }
  | { tipo: 'debate'; seq: number; fin: number; debate: De<'debateTV'>; efectos: Suceso[]; log: EntradaLog[] };

const CIERRE = new Set(['encuesta', 'dominante', 'listas']);

/** Agrupa los sucesos posteriores a `visto` en momentos. */
export function momentosDesde(c: Cronica, yo: Bando, visto: number): Momento[] {
  const res: Momento[] = [];
  let actual: Momento | null = null;
  const cerrar = () => {
    if (actual) res.push(actual);
    actual = null;
  };
  for (const s of c.sucesos) {
    if (s.seq <= visto) continue;
    if (s.s === 'semana') {
      cerrar();
      actual = { tipo: 'semana', seq: s.seq, fin: s.seq, semana: s.semana, efectos: [], log: [] };
    } else if (s.s === 'noticia' || s.s === 'agendaPodemos') {
      if (!actual || actual.tipo !== 'semana') {
        cerrar();
        actual = { tipo: 'semana', seq: s.seq, fin: s.seq, semana: s.semana, efectos: [], log: [] };
      }
      if (s.s === 'noticia') actual.noticia = s.carta;
      else actual.agenda = s;
    } else if (s.s === 'jugada') {
      cerrar();
      actual = { tipo: s.bando === yo ? 'propia' : 'rival', seq: s.seq, fin: s.seq, jugada: s, efectos: [], log: [] };
    } else if (CIERRE.has(s.s)) {
      if (!actual || actual.tipo !== 'cierre') {
        cerrar();
        actual = { tipo: 'cierre', seq: s.seq, fin: s.seq, semana: s.semana, efectos: [], log: [] };
      }
      actual.efectos.push(s);
    } else if (s.s === 'debateTV') {
      cerrar();
      res.push({ tipo: 'debate', seq: s.seq, fin: s.seq, debate: s, efectos: [], log: [] });
    } else if (s.s === 'fin') {
      cerrar();
    } else if (actual) {
      actual.efectos.push(s);
    }
    if (actual) actual.fin = s.seq;
  }
  cerrar();
  // el texto de la crónica de cada momento
  for (let i = 0; i < res.length; i++) {
    const desde = res[i].seq;
    const hasta = i + 1 < res.length ? res[i + 1].seq : Infinity;
    res[i].log = c.log.filter((l) => l.seq >= desde && l.seq < hasta);
    const ultimo = res[i].log[res[i].log.length - 1];
    if (ultimo && ultimo.seq > res[i].fin) res[i].fin = ultimo.seq;
  }
  // de las jugadas propias solo interesa el resultado cuando había dados
  return res.filter((m) => m.tipo !== 'propia' || m.efectos.some((s) => s.s === 'ataque' || s.s === 'dado'));
}

/** El último número de secuencia de la crónica. */
export const ultimoSeq = (c: Cronica) => c.seq;
