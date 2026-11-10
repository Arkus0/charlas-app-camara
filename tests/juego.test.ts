import { describe, expect, it } from 'vitest';
import { TERR } from '../src/tipos';
import { Juego } from '../src/juego/juego';
import { entrada, juegoEn, leerTodo, pasos, sala, usar } from './util';

/** Anda hacia la derecha saltando cada vez que toca suelo cerca de x; opcionalmente usa el capote en el aire. */
function cruzar(j: Juego, saltaEn: number, pasosMax: number, capote = false): void {
  let enAire = 0;
  for (let i = 0; i < pasosMax; i++) {
    const p = j.jug;
    const salta = p.suelo && p.x >= saltaEn && p.est === 'normal';
    enAire = p.suelo ? 0 : enAire + 1;
    const usa = capote && enAire === 14;
    j.paso(entrada(1, 0, ['b'], [...(salta ? ['b' as const] : []), ...(usa ? ['c' as const] : [])]));
  }
}

describe('movimiento y alturas', () => {
  it('anda y choca con los muros', () => {
    const j = juegoEn(sala(['#######', '#P....#', '#######']));
    const x0 = j.jug.x;
    pasos(j, 30, 1, 0);
    expect(j.jug.x).toBeGreaterThan(x0 + 30);
    pasos(j, 200, 1, 0);
    expect(j.jug.x).toBeLessThan(6 * 16 - 4);
  });

  it('sube un escalón saltando, pero no dos', () => {
    const uno = juegoEn(sala(['########', '#P.----#', '########']));
    pasos(uno, 60, 1, 0);
    expect(uno.jug.x).toBeLessThan(48);
    cruzar(uno, 30, 80);
    pasos(uno, 40);
    expect(uno.jug.z).toBe(16);
    expect(uno.jug.x).toBeGreaterThan(48);
    const dos = juegoEn(sala(['########', '#P.==..#', '########']));
    cruzar(dos, 30, 120);
    pasos(dos, 40);
    expect(dos.jug.x).toBeLessThan(48);
  });

  it('cruza un foso de dos casillas saltando', () => {
    const j = juegoEn(sala(['#########', '#P..oo..#', '#########']));
    cruzar(j, 58, 120);
    expect(j.jug.x).toBeGreaterThan(6 * 16);
    expect(j.p.vida).toBe(6);
  });

  it('un foso de tres casillas exige el capote', () => {
    const mapa = ['###########', '#P..ooo...#', '###########'];
    const sin = juegoEn(sala(mapa));
    cruzar(sin, 58, 200);
    pasos(sin, 80);
    expect(sin.p.vida).toBeLessThan(6);
    expect(sin.jug.x).toBeLessThan(4 * 16);
    const con = juegoEn(sala(mapa));
    con.p.capote = true;
    cruzar(con, 58, 90, true);
    expect(con.jug.x).toBeGreaterThan(7 * 16);
    expect(con.p.vida).toBe(6);
  });

  it('con el capote se cruzan cuatro casillas, pero no seis', () => {
    const cuatro = juegoEn(sala(['############', '#P..oooo...#', '############']));
    cuatro.p.capote = true;
    cruzar(cuatro, 58, 100, true);
    expect(cuatro.jug.x).toBeGreaterThan(8 * 16);
    expect(cuatro.p.vida).toBe(6);
    const seis = juegoEn(sala(['##############', '#P..oooooo...#', '##############']));
    seis.p.capote = true;
    cruzar(seis, 58, 100, true);
    pasos(seis, 80);
    expect(seis.p.vida).toBeLessThan(6);
  });

  it('caer al agua quita vida y devuelve a tierra firme', () => {
    const j = juegoEn(sala(['#######', '#P.~~~#', '#######']));
    pasos(j, 40, 1, 0);
    pasos(j, 80);
    expect(j.p.vida).toBe(4);
    expect(j.jug.x).toBeLessThan(48);
  });

  it('la cinta transportadora arrastra', () => {
    const j = juegoEn(sala(['#######', '#P>>>.#', '#######']));
    pasos(j, 4, 1, 0);
    const x = j.jug.x;
    pasos(j, 20, 1, 0);
    pasos(j, 30);
    expect(j.jug.x).toBeGreaterThan(x + 30);
  });
});

describe('mecanismos', () => {
  it('empujar la caja sobre la placa abre la reja', () => {
    const j = juegoEn(sala(['#######', '#G....#', '#p.cP.#', '#######']));
    const reja = j.ents.find((e) => e.tipo === 'reja')!;
    expect(reja.solido).toBe(true);
    pasos(j, 140, -1, 0);
    const caja = j.ents.find((e) => e.tipo === 'caja')!;
    expect(caja.col).toBe(1);
    expect(j.canales.a).toBe(true);
    pasos(j, 30);
    expect(reja.solido).toBe(false);
  });

  it('una caja empujada a un foso lo rellena', () => {
    const j = juegoEn(sala(['#######', '#Pc.o.#', '#######']));
    pasos(j, 200, 1, 0);
    expect(j.sala.tipo(4, 1)).toBe(TERR.RELLENO);
    expect(j.ents.some((e) => e.tipo === 'caja')).toBe(false);
    pasos(j, 60, 1, 0);
    expect(j.jug.x).toBeGreaterThan(5 * 16);
    expect(j.p.vida).toBe(6);
  });

  it('una caja empujada desde un escalón cae al nivel de abajo', () => {
    const j = juegoEn(sala(['#######', '#-----#', '#--c--#', '#.....#', '#######'], {}, '_caida'));
    const caja = j.ents.find((e) => e.tipo === 'caja')!;
    expect(caja.z).toBe(16);
    j.jug.x = caja.x; j.jug.y = caja.y - 14; j.jug.z = 16;
    pasos(j, 80, 0, 1);
    expect(caja.fila).toBe(3);
    expect(caja.z).toBe(0);
  });

  it('la palanca temporizada se apaga sola', () => {
    const j = juegoEn(sala(['#######', '#G....#', '#L.P..#', '#######'], { tiempo: { a: 100 } }));
    j.p.bate = true;
    usar(j, (e) => e.tipo === 'palanca');
    j.paso(entrada());
    expect(j.canales.a).toBe(true);
    pasos(j, 110);
    expect(j.canales.a).toBe(false);
  });

  it('las velas se encienden con el mechero y abren para siempre', () => {
    const id = sala(['#######', '#G....#', '#i.P.i#', '#######'], {}, '_velas');
    const j = juegoEn(id);
    j.p.mechero = true;
    for (const v of j.ents.filter((e) => e.tipo === 'vela')) {
      j.jug.x = v.x + (v.col === 1 ? 14 : -14); j.jug.y = v.y; j.jug.dir = v.col === 1 ? 3 : 1; j.jug.enfria = 0;
      j.paso(entrada(0, 0, [], ['c']));
      pasos(j, 5);
    }
    expect(j.canales.a).toBe(true);
    j.cargarSala(id, null);
    expect(j.canales.a).toBe(true);
  });

  it('las tracas revientan los muros agrietados', () => {
    const j = juegoEn(sala(['#######', '#P.g..#', '#######']));
    j.p.tracas = true;
    pasos(j, 14, 1, 0);
    j.paso(entrada(0, 0, [], ['c']));
    pasos(j, 20, -1, 0);
    pasos(j, 100);
    expect(j.ents.some((e) => e.tipo === 'grieta')).toBe(false);
  });

  it('los cerrojos piden llave', () => {
    const j = juegoEn(sala(['#######', '#P.K..#', '#######']));
    pasos(j, 120, 1, 0);
    leerTodo(j);
    expect(j.jug.x).toBeLessThan(48);
    j.p.llaves.lonja = 1;
    pasos(j, 120, 1, 0);
    expect(j.jug.x).toBeGreaterThan(64);
    expect(j.p.llaves.lonja).toBe(0);
  });

  it('la plataforma móvil lleva al jugador al otro lado', () => {
    const j = juegoEn(sala(['########', '#P.moo.#', '########'], { plataformas: [[1, 0, 2]] }));
    pasos(j, 28, 1, 0);
    expect(j.jug.suelo).toBe(true);
    pasos(j, 110);
    expect(j.jug.x).toBeGreaterThan(5 * 16 - 4);
    pasos(j, 30, 1, 0);
    expect(j.jug.x).toBeGreaterThan(6 * 16);
    expect(j.p.vida).toBe(6);
  });
});

describe('combate y partida', () => {
  it('el combo tumba a un matón y suelta botín', () => {
    const j = juegoEn(sala(['#######', '#P.E..#', '#######']));
    j.p.bate = true;
    pasos(j, 8, 1, 0);
    for (let i = 0; i < 400 && j.ents.some((e) => e.tipo === 'enemigo'); i++) {
      const e = j.ents.find((o) => o.tipo === 'enemigo')!;
      j.jug.dir = e.x > j.jug.x ? 1 : 3;
      j.paso(entrada(0, 0, [], i % 6 === 0 ? ['a'] : []));
      if (j.p.vida < 4) j.p.vida = 6;
    }
    expect(j.ents.some((e) => e.tipo === 'enemigo')).toBe(false);
    expect(j.ents.some((e) => e.tipo === 'recoge')).toBe(true);
    expect(j.p.duende).toBeGreaterThan(0);
  });

  it('sin arma no se puede golpear', () => {
    const j = juegoEn(sala(['#######', '#P....#', '#######']));
    j.paso(entrada(0, 0, [], ['a']));
    expect(j.jug.est).toBe('normal');
  });

  it('morir lleva a la pantalla de reintento y se vuelve con la vida llena', () => {
    const j = juegoEn(sala(['#######', '#P....#', '#######']));
    j.p.dinero = 1000;
    j.danarJugador(99, 0, 0);
    pasos(j, 100);
    expect(j.modo).toBe('muerte');
    j.paso(entrada(0, 0, [], ['a']));
    expect(j.modo).toBe('juego');
    expect(j.p.vida).toBe(j.p.vidaMax);
    expect(j.p.dinero).toBe(900);
  });

  it('el cofre entrega su contenido una sola vez', () => {
    const id = sala(['#######', '#.C...#', '#.P...#', '#######'], { cofres: ['tracas'] }, '_cofre');
    const j = juegoEn(id);
    usar(j, (e) => e.tipo === 'cofre');
    expect(j.p.tracas).toBe(true);
    leerTodo(j);
    j.cargarSala(id, null);
    expect(j.ents.find((e) => e.tipo === 'cofre')!.abierto).toBe(true);
  });

  it('guarda y recupera la partida', () => {
    let disco: string | null = null;
    const almacen = { leer: () => disco, escribir: (s: string) => { disco = s; } };
    const j = juegoEn('paseo', '1', almacen);
    j.p.dinero = 777; j.p.mechero = true; j.pon('jefe:percebe');
    usar(j, (e) => e.tipo === 'cabina');
    expect(disco).toBeTruthy();
    const k = new Juego(almacen);
    expect(k.menu.ops[0]).toBe('Continuar');
    k.paso(entrada(0, 0, [], ['a']));
    expect(k.modo).toBe('juego');
    expect(k.def.id).toBe('paseo');
    expect(k.p.dinero).toBe(777);
    expect(k.p.mechero).toBe(true);
    expect(k.sellos()).toBe(1);
  });

  it('los diálogos con opciones aplican la elegida', () => {
    const j = juegoEn('bar', '1');
    j.p.bate = true; j.p.dinero = 500; j.p.vida = 1;
    usar(j, (e) => e.nom === 'maruja');
    expect(j.modo).toBe('dialogo');
    leerTodo(j, 0);
    expect(j.p.dinero).toBe(350);
    expect(j.p.vida).toBe(j.p.vidaMax);
    expect(j.modo).toBe('juego');
  });

  it('cruzar una puerta cambia de sala y guarda', () => {
    let disco: string | null = null;
    const j = juegoEn('bar', '1', { leer: () => disco, escribir: (s) => { disco = s; } });
    pasos(j, 60, 0, 1);
    expect(j.def.id).toBe('paseo');
    expect(JSON.parse(disco!).sala).toBe('paseo');
    pasos(j, 40);
    expect(j.modo).toBe('juego');
  });
});
