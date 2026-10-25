import { decidirIA } from '../src/ia/bot';
import { crearPartida, responder } from '../src/motor/motor';

describe('IA', () => {
  it('juega partidas completas en cada nivel sin dar nunca una respuesta inválida', () => {
    for (const [semilla, nP, nC] of [[1, 'normal', 'facil'], [2, 'dificil', 'normal']] as const) {
      const e = crearPartida(semilla);
      e.silencio = true;
      let k = 0;
      while (!e.ganador) {
        const d = e.pendiente!;
        responder(e, decidirIA(e, d.bando === 'P' ? nP : nC, semilla * 1000 + k++));
      }
      expect(e.ganador).toBeTruthy();
    }
  }, 60000);

  it('con el Clima en 2 nunca provoca la ruptura', () => {
    let rupturas = 0;
    for (let s = 1; s <= 6; s++) {
      const e = crearPartida(100 + s);
      e.silencio = true;
      let k = 0;
      while (!e.ganador) {
        if (e.pendiente!.tipo === 'accion') e.clima = Math.min(e.clima, 2);
        responder(e, decidirIA(e, 'normal', s * 1000 + k++));
      }
      if (/Ruptura/.test(e.ganador!.motivo)) rupturas++;
    }
    expect(rupturas).toBe(0);
  }, 60000);
});
