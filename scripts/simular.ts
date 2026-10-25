// Partidas IA contra IA para medir el equilibrio y la duración:
// npm run simulate -- [partidas] [nivelP] [nivelC] [semillaInicial]   (RITMO=2 para el modo online, SESGO=… para calibrar)
import { decidirIA, type Nivel } from '../src/ia/bot';
import { AJUSTES_IA } from '../src/ia/evaluar';
import { crearPartida, responder } from '../src/motor/motor';
import { proyectar } from '../src/motor/electoral';
import { PROVINCIAS } from '../src/data/provincias';
import { CARTAS } from '../src/data/mazos';
import { DUENO_TEMA } from '../src/motor/agenda';

const [nArg, nivP, nivC, s0] = process.argv.slice(2);
const N = Number(nArg ?? 20);
const nivel = { P: (nivP ?? 'normal') as Nivel, C: (nivC ?? 'normal') as Nivel };
const semilla0 = Number(s0 ?? 1);
const ritmo = Number(process.env.RITMO ?? 1);
const sesgo = process.env.SESGO !== undefined ? Number(process.env.SESGO) : undefined;
// MAQ_P / MAQ_C: escala del valor que da la IA de cada bloque a la Maquinaria (para calibrar)
AJUSTES_IA.maquinaria.P = Number(process.env.MAQ_P ?? AJUSTES_IA.maquinaria.P);
AJUSTES_IA.maquinaria.C = Number(process.env.MAQ_C ?? AJUSTES_IA.maquinaria.C);

const motivos = new Map<string, number>();
const victorias = { P: 0, C: 0, nadie: 0 };
const modos = new Map<string, number>();
const maquinaria = { P: 0, C: 0 };
let decisiones = 0, acciones = 0, ms = 0, msMax = 0, escC = 0, escP = 0, ventaja = 0, ajenas = 0, anticipadas = 0;
for (let i = 0; i < N; i++) {
  const e = crearPartida(semilla0 + i, { ritmo, sesgo });
  e.silencio = true;
  let k = 0;
  let jugoAjena = false;
  while (!e.ganador) {
    const d = e.pendiente!;
    const t0 = performance.now();
    const r = decidirIA(e, nivel[d.bando], (semilla0 + i) * 1000 + k++);
    const dt = performance.now() - t0;
    ms += dt;
    msMax = Math.max(msMax, dt);
    decisiones++;
    if (r.tipo === 'accion') {
      acciones++;
      modos.set(r.modo, (modos.get(r.modo) ?? 0) + 1);
      if (r.modo === 'maquinaria') maquinaria[d.bando]++;
      if (typeof r.carta === 'number' && r.modo !== 'maquinaria') {
        const c = CARTAS[r.carta];
        if (c.tema === 'COR' || DUENO_TEMA[c.tema] !== d.bando) jugoAjena = true;
      }
    }
    responder(e, r);
  }
  if (jugoAjena) ajenas++;
  if (e.semana < 8 || !/Investidura|Bloqueo/.test(e.ganador!.motivo)) anticipadas++;
  const res = proyectar(PROVINCIAS, e);
  escC += res.bloque.C;
  escP += res.bloque.P;
  ventaja += e.ventaja;
  const m = e.ganador!.motivo.split(':')[0].split('(')[0].trim() + ' → ' + (e.ganador!.bando ?? '=');
  motivos.set(m, (motivos.get(m) ?? 0) + 1);
  victorias[e.ganador!.bando ?? 'nadie']++;
  if (process.env.VERBOSE) console.log(i, e.ganador, 'S', e.semana, 'V', e.ventaja, 'PP+Vox', res.bloque.C, 'PSOE+FA', res.bloque.P, 'clima', e.clima);
}
console.log(JSON.stringify({
  partidas: N, nivel, ritmo,
  victorias, pctProgresista: +(100 * victorias.P / N).toFixed(1),
  anticipadasPct: +(100 * anticipadas / N).toFixed(1),
  decisionesPorJugador: +(decisiones / N / 2).toFixed(1),
  accionesPorJugador: +(acciones / N / 2).toFixed(1),
  modos: Object.fromEntries([...modos].map(([k, v]) => [k, +(100 * v / acciones).toFixed(1)])),
  partidasConCartaAjenaPct: +(100 * ajenas / N).toFixed(1),
  maquinariaPorPartida: { P: +(maquinaria.P / N).toFixed(2), C: +(maquinaria.C / N).toFixed(2) },
  ventajaMedia: +(ventaja / N).toFixed(2), escanosPPVox: +(escC / N).toFixed(1), escanosPSOEFA: +(escP / N).toFixed(1),
  msPorDecision: +(ms / decisiones).toFixed(1), msMax: Math.round(msMax),
  motivos: Object.fromEntries(motivos),
}, null, 1));
