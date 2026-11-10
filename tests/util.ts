import { entradaVacia, type Boton, type DefSala, type Entrada } from '../src/tipos';
import { SALAS } from '../src/datos/salas';
import { Juego, type Almacen } from '../src/juego/juego';

export function sala(mapa: string[], extra: Partial<DefSala> = {}, id = '_prueba'): string {
  SALAS[id] = { id, zona: 'lonja', mapa, ...extra };
  return id;
}

export function juegoEn(id: string, puerta: string | null = null, almacen: Almacen | null = null): Juego {
  const j = new Juego(almacen, () => 0.5);
  j.cargarSala(id, puerta);
  j.modo = 'juego';
  j.dlg = null;
  return j;
}

export function entrada(dx = 0, dy = 0, mant: Boton[] = [], puls: Boton[] = []): Entrada {
  const e = entradaVacia();
  e.dx = dx; e.dy = dy;
  for (const b of mant) e.m[b] = true;
  for (const b of puls) { e.m[b] = true; e.p[b] = true; }
  return e;
}

/** Avanza n pasos con la misma entrada; los botones de `puls` solo cuentan como recién pulsados en el primero. */
export function pasos(j: Juego, n: number, dx = 0, dy = 0, mant: Boton[] = [], puls: Boton[] = []): void {
  for (let i = 0; i < n; i++) j.paso(entrada(dx, dy, i === 0 ? mant : [...mant, ...puls], i === 0 ? puls : []));
}

/** Despacha todos los diálogos pendientes eligiendo siempre la opción indicada. */
export function leerTodo(j: Juego, opcion = 0, tope = 4000): void {
  for (let i = 0; i < tope && (j.modo === 'dialogo' || j.modo === 'trans' || j.modo === 'escena'); i++) {
    if (j.modo === 'dialogo' && j.dlg?.op && j.dlg.sel !== opcion && j.dlg.vis >= (j.dlg.paginas[j.dlg.pag] ?? '').length) j.dlg.sel = opcion;
    j.paso(entrada(0, 0, [], i % 2 ? ['a'] : []));
  }
}

/** Coloca al jugador mirando a una entidad y pulsa acción. */
export function usar(j: Juego, filtro: (e: any) => boolean): void {
  const o = j.ents.find((e) => e.vivo && filtro(e));
  if (!o) throw new Error('no hay tal cosa en ' + j.def.id);
  const p = j.jug;
  p.x = o.x; p.y = o.y + o.ry + p.ry + 3; p.z = o.z; p.dir = 2; p.est = 'normal'; p.suelo = true; p.vz = 0;
  j.paso(entrada(0, 0, [], ['a']));
}
