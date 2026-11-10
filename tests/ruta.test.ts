// La historia de principio a fin, con atajos de depuración entre sala y sala.
import { describe, expect, it } from 'vitest';
import { Juego } from '../src/juego/juego';
import { entrada, leerTodo, pasos, usar } from './util';

function tumbar(j: Juego): void {
  const b = j.jefe!;
  j.jug.x = b.x; j.jug.y = b.y + 30;
  for (let i = 0; i < 400 && (b.est === 'espera' || j.modo !== 'juego' || j.tarjeta); i++) { j.paso(entrada()); leerTodo(j); }
  for (let fase = 0; fase < 2 && b.vivo; fase++) {
    j.golpear(b, 9999, j.jug.x, j.jug.y, 0, 'remate');
    for (let i = 0; i < 300 && j.jefe; i++) { j.p.vida = j.p.vidaMax; j.paso(entrada()); leerTodo(j); if (b.est === 'acecha') break; }
  }
}

describe('ruta crítica', () => {
  it('del telegrama a los créditos', () => {
    let disco: string | null = null;
    const j = new Juego({ leer: () => disco, escribir: (s) => { disco = s; } }, () => 0.5);
    expect(j.modo).toBe('titulo');
    j.paso(entrada(0, 0, [], ['a']));
    expect(j.modo).toBe('escena');
    leerTodo(j);
    expect(j.modo).toBe('juego');
    expect(j.def.id).toBe('muelle');

    // la Lonja está vedada hasta tener el bate
    j.cargarSala('muelle', '2');
    pasos(j, 40, 0, -1);
    expect(j.modo).toBe('dialogo');
    leerTodo(j);
    expect(j.def.id).toBe('muelle');

    j.cargarSala('bar', '1');
    usar(j, (e) => e.nom === 'maruja');
    leerTodo(j, 1);
    expect(j.p.bate).toBe(true);

    j.cargarSala('muelle', '2');
    pasos(j, 60, 0, -1);
    expect(j.def.id).toBe('lonja1');

    const jefes: [string, string, string][] = [['lonja_jefe', 'percebe', 'muelle'], ['bodega_jefe', 'faraona', 'casco'], ['toros_jefe', 'miura', 'toros_ext']];
    jefes.forEach(([sala, nom, vuelta], n) => {
      j.cargarSala(sala, '1');
      j.modo = 'juego';
      tumbar(j);
      for (let i = 0; i < 200; i++) { j.paso(entrada()); leerTodo(j); }
      expect(j.ban('jefe:' + nom)).toBe(true);
      expect(j.def.id).toBe(vuelta);
      expect(j.sellos()).toBe(n + 1);
      expect(j.p.tinta).toBe(1);
      j.cargarSala('tatuador', '1');
      usar(j, (e) => e.nom === 'chino');
      leerTodo(j);
      expect(j.p.tatuaje).toBe(n + 1);
      expect(j.p.vidaMax).toBe(6 + 2 * (n + 1));
    });

    // el hotel sigue cerrado hasta leer la carta
    j.cargarSala('paseo', '5');
    pasos(j, 40, 1, 0);
    leerTodo(j);
    expect(j.def.id).toBe('paseo');

    j.cargarSala('casa', '1');
    usar(j, (e) => e.nom === 'altar');
    leerTodo(j);
    expect(j.p.katana).toBe(true);

    j.cargarSala('paseo', '5');
    pasos(j, 60, 1, 0);
    expect(j.def.id).toBe('hotel_ext');

    j.cargarSala('hotel_jefe', '1');
    j.modo = 'juego';
    tumbar(j);
    for (let i = 0; i < 4000 && j.modo !== 'creditos'; i++) j.paso(entrada(0, 0, [], i % 2 ? ['a'] : []));
    expect(j.modo).toBe('creditos');
    expect(j.ban('fin')).toBe(true);
    expect(JSON.parse(disco!).banderas.fin).toBe(1);
  });

  it('las historias secundarias dan su premio', () => {
    const j = new Juego(null, () => 0.5);
    j.cargarSala('casco', '1'); j.modo = 'juego';
    usar(j, (e) => e.nom === 'remedios'); leerTodo(j);
    usar(j, (e) => e.nom === 'gato'); leerTodo(j);
    expect(j.ban('gato')).toBe(true);
    usar(j, (e) => e.nom === 'remedios'); leerTodo(j);
    expect(j.p.tinta).toBe(1);

    j.cargarSala('plaza', '1');
    j.p.cromos = 3;
    usar(j, (e) => e.nom === 'kevin'); leerTodo(j);
    expect(j.p.tinta).toBe(2);
    expect(j.p.cromos).toBe(0);

    j.cargarSala('muelle', '1');
    j.pon('cana');
    usar(j, (e) => e.nom === 'chema'); leerTodo(j);
    expect(j.p.dinero).toBe(1000);
    expect(j.p.bocatas).toBe(1);

    j.cargarSala('paseo', '1');
    usar(j, (e) => e.nom === 'turista'); leerTodo(j, 2);
    expect(j.p.dinero).toBe(1300);

    j.cargarSala('estanco', '1');
    j.p.dinero = 2300;
    usar(j, (e) => e.nom === 'paca'); leerTodo(j, 1);
    expect(j.p.tinta).toBe(3);
    usar(j, (e) => e.nom === 'paca'); leerTodo(j, 0);
    expect(j.p.bocatas).toBe(2);
    expect(j.p.dinero).toBe(0);
  });
});
