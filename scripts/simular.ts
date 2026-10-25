// Simula partidas IA contra IA para medir el equilibrio: npm run simulate -- [partidas] [nivelP] [nivelC] [semillaInicial]
import { decidirIA, type Nivel } from '../src/ai/bot';
import { crearPartida, responder, SESGO_ESCENARIO } from '../src/engine/motor';
import { posturaPodemos, proyectar, votoPodemos } from '../src/engine/electoral';
import { PROVINCIAS } from '../src/data/provincias';

const [nArg, nivP, nivC, s0] = process.argv.slice(2);
const escenario = (process.env.ESCENARIO ?? 'abierto') as 'abierto' | 'realista';
if (process.env.SESGO) SESGO_ESCENARIO[escenario] = Number(process.env.SESGO);
const N = Number(nArg ?? 20);
const nivel = { P: (nivP ?? 'normal') as Nivel, C: (nivC ?? 'normal') as Nivel };
const semilla0 = Number(s0 ?? 1);

const motivos = new Map<string, number>();
const victorias = { P: 0, C: 0, empate: 0 };
let turnos = 0, ms = 0, escC = 0, ventaja = 0;
const pinza = { tejida: 0, abstencion: 0, apoyo: 0 }; // partidas con pinza ≥1 en algún momento, y voto final de Podemos a Feijóo
for (let i = 0; i < N; i++) {
  const t0 = Date.now();
  const e = crearPartida(semilla0 + i, escenario);
  e.silencio = true;
  let k = 0;
  let maxPinza = 0;
  while (!e.ganador) {
    const d = e.pendiente!;
    responder(e, decidirIA(e, nivel[d.bando], (semilla0 + i) * 1000 + k++));
    maxPinza = Math.max(maxPinza, e.podemos.pinza);
  }
  if (maxPinza > 0) pinza.tejida++;
  const votoF = votoPodemos('C', posturaPodemos(e));
  if (votoF === 'abst') pinza.abstencion++;
  if (votoF === 'si') pinza.apoyo++;
  ms += Date.now() - t0;
  turnos += e.turno;
  ventaja += e.ventaja;
  const r = proyectar(PROVINCIAS, e);
  escC += r.bloque.C;
  const m = e.ganador!.motivo.split(':')[0].split('(')[0].trim() + ' → ' + (e.ganador!.bando ?? '=');
  motivos.set(m, (motivos.get(m) ?? 0) + 1);
  if (e.ganador!.bando) victorias[e.ganador!.bando]++;
  else victorias.empate++;
  if (process.env.VERBOSE) console.log(i, e.ganador, 'T', e.turno, 'V', e.ventaja, 'PP+Vox', r.bloque.C, 'izq', r.bloque.P, 'clima', e.clima, 'socios', e.socio, 'carrera', e.carrera);
}
console.log(JSON.stringify({ partidas: N, nivel, victorias, pctProgresista: +(100 * victorias.P / N).toFixed(1), turnoMedio: +(turnos / N).toFixed(2), ventajaMedia: +(ventaja / N).toFixed(2), escanosPPVoxMedios: +(escC / N).toFixed(1), pinza, msPorPartida: Math.round(ms / N), motivos: Object.fromEntries(motivos) }, null, 1));
