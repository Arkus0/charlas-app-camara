// Catálogo de sprites: de qué hoja y de dónde sale cada uno.
// Hojas: o = Overworld, i = Inner, c = cave, b = objects (ArMM1998, CC0); k = Kenney RPG Urban Pack (CC0).
// t(): casillas exactas de 16 px.  s(): componente conexa a partir de casillas semilla.

const C = [];
const t = (n, hoja, cx, cy, w = 1, h = 1, extra = {}) => C.push({ n, hoja, rect: [cx, cy, w, h], ...extra });
const s = (n, hoja, semillas, recorte) => C.push({ n, hoja, semillas: Array.isArray(semillas[0]) ? semillas : [semillas], recorte });
const fila = (n, hoja, cx, cy, cuantos, w = 1, h = 1) => { for (let i = 0; i < cuantos; i++) t(n + i, hoja, cx + i * w, cy, w, h); };

// ── Terreno: exteriores ──
t('hierba0', 'o', 0, 0); t('hierba1', 'o', 0, 9); t('hierba2', 'o', 1, 9); t('hierba3', 'o', 0, 10);
fila('ola', 'o', 0, 1, 4);
t('agua0', 'o', 3, 3); t('agua1', 'o', 4, 3);
t('adoquin0', 'o', 13, 13); t('adoquin1', 'o', 13, 14); t('adoquin2', 'o', 12, 14);
t('ladrillo0', 'o', 13, 15); t('ladrillo1', 'o', 14, 15); t('ladrillo2', 'o', 13, 16); t('ladrillo3', 'o', 14, 16);
t('losa0', 'o', 14, 11); t('losa1', 'o', 14, 12);
t('marmol', 'o', 23, 1);
t('risco0', 'o', 5, 12); t('risco1', 'o', 5, 13); t('risco_base', 'o', 5, 14);
t('muralla_sup', 'o', 23, 3); t('muralla', 'o', 23, 4); t('muralla_base', 'o', 23, 5);
t('tierra0', 'o', 1, 30); t('tierra1', 'o', 2, 32);
t('albero0', 'o', 1, 30, 1, 1, { tinte: [1.75, 1.6, 1.05] }); t('albero1', 'o', 2, 32, 1, 1, { tinte: [1.75, 1.6, 1.05] });

// ── Terreno: interiores ──
t('baldosa', 'i', 0, 0); t('ladrillo_osc', 'i', 0, 1); t('ladrillo_ama', 'i', 0, 2);
t('tabla0', 'i', 0, 3); t('tabla1', 'i', 0, 4); t('tabla2', 'i', 1, 4);
t('pared_sup', 'i', 6, 6); t('pared', 'i', 6, 7); t('pared_base', 'i', 6, 8);
t('techo', 'i', 2, 1);
t('moqueta', 'i', 1, 10);

// ── Terreno: cueva ──
t('cueva0', 'c', 0, 0); t('cueva1', 'c', 0, 1); t('cueva2', 'c', 7, 3);
t('cueva_cara0', 'c', 2, 3); t('cueva_cara1', 'c', 2, 4); t('cueva_base', 'c', 2, 5);
t('cueva_techo', 'c', 2, 1);
fila('cola', 'c', 5, 7, 4);

// ── Terreno: ciudad (Kenney) ──
t('asfalto0', 'k', 8, 16); t('asfalto1', 'k', 9, 15); t('asfalto2', 'k', 7, 17);
t('cebra', 'k', 0, 16); t('cebra_h', 'k', 3, 16);
t('acera', 'k', 9, 1); t('plaza', 'k', 1, 4); t('enlosado', 'k', 9, 4);
t('teja_roja', 'k', 18, 1); t('teja', 'k', 18, 5);

// ── Decorado de exterior ──
s('casa1', 'o', [8, 2]); s('casa2', 'o', [13, 2], [11, 0, 16, 5]); s('caseta', 'o', [14, 7], [13, 5, 15, 8]);
s('fuente0', 'o', [23, 10], [22, 9, 25, 12]); s('fuente1', 'o', [26, 10], [25, 9, 28, 12]); s('fuente2', 'o', [29, 10], [28, 9, 31, 12]);
s('puesto', 'o', [[20, 23], [19, 26], [21, 26], [22, 25]], [18, 22, 23, 28]);
s('fruta0', 'o', [26, 21], [26, 20, 27, 22]); s('fruta1', 'o', [27, 21], [27, 20, 28, 22]); s('fruta2', 'o', [28, 21], [28, 20, 29, 22]); s('fruta3', 'o', [29, 21], [29, 20, 30, 22]);
s('caja', 'o', [30, 0], [30, 0, 31, 2]); s('caja_g', 'o', [35, 8]);
s('barril', 'o', [33, 0], [33, 0, 34, 2]); s('saco', 'o', [32, 0], [32, 0, 33, 1]);
s('maceta', 'o', [35, 0], [35, 0, 36, 1]); s('planta', 'o', [32, 1], [32, 1, 33, 3]); s('trebol', 'o', [35, 1], [35, 1, 36, 2]);
s('cartel', 'o', [34, 2], [34, 2, 35, 4]);
s('banco', 'o', [29, 4], [28, 4, 31, 6]); s('banco_v', 'o', [26, 5], [26, 4, 27, 8]);
s('mesa_redonda', 'o', [37, 10], [36, 10, 39, 13]); s('taburete', 'o', [37, 8], [37, 8, 39, 10]);
s('estatua', 'o', [9, 31], [8, 30, 10, 34]); s('portal', 'o', [6, 32], [4, 31, 8, 34]); s('arco', 'o', [11, 32]);
for (let i = 0; i < 5; i++) s('bandera' + i, 'o', [4 + i * 2, 29], [3 + i * 2, 28, 5 + i * 2, 32]);
s('canon', 'o', [14, 28], [14, 27, 16, 29]);
s('arbol', 'o', [5, 16], [5, 15, 7, 18]); s('arbusto', 'o', [0, 16], [0, 16, 2, 17]);
s('valla', 'o', [3, 17], [2, 17, 4, 19]); s('valla_v', 'o', [0, 17], [0, 17, 1, 19]);
s('roca', 'o', [4, 2], [4, 1, 6, 3]); s('tronco', 'o', [4, 5], [3, 5, 6, 6]);
s('reja', 'o', [25, 1], [25, 0, 26, 2]); s('calavera', 'o', [26, 3], [26, 3, 27, 4]);
s('puerta_madera', 'o', [25, 8], [25, 7, 26, 9]); s('ventana', 'o', [26, 8], [26, 8, 27, 9]); s('ventanal', 'o', [28, 8], [27, 8, 30, 9]);
s('trampilla', 'o', [33, 3], [33, 3, 35, 5]); s('bajada', 'o', [33, 6], [33, 5, 35, 7]);
s('lapida', 'o', [36, 6], [35, 5, 37, 7]);
s('pasarela', 'o', [6, 6], [6, 6, 8, 8]);

// ── Decorado de interior ──
s('mesa', 'i', [11, 2], [10, 1, 13, 4]); s('mantel', 'i', [14, 2], [13, 1, 16, 4]); s('cama', 'i', [16, 2], [16, 1, 18, 4]); s('cama2', 'i', [20, 2], [20, 1, 22, 4]);
s('silla', 'i', [13, 5], [13, 4, 14, 6]); s('silla2', 'i', [15, 5], [15, 4, 16, 7]);
s('mostrador', 'i', [11, 8]); s('aparador', 'i', [7, 9]); s('barra', 'i', [15, 8], [14, 7, 17, 9]); s('arcon', 'i', [15, 9], [14, 9, 17, 11]);
s('estanteria', 'i', [1, 13], [0, 12, 3, 15]); s('botellero', 'i', [4, 12], [3, 12, 6, 14]); s('armario', 'i', [7, 10], [6, 9, 9, 12]); s('ropero', 'i', [6, 13], [6, 12, 8, 16]);
s('chimenea', 'i', [12, 11]); s('planta_i', 'i', [8, 12], [8, 12, 9, 14]); s('ventana_i', 'i', [9, 4]);
s('cuadro0', 'i', [9, 1], [9, 0, 10, 2]); s('cuadro1', 'i', [12, 0], [12, 0, 14, 1]); s('cuadro2', 'i', [14, 0], [14, 0, 16, 1]); s('cuadro3', 'i', [16, 0], [16, 0, 18, 1]);
s('escalera_i', 'i', [0, 15], [0, 15, 2, 17]); s('escalera_sub', 'i', [2, 16], [2, 15, 4, 18]); s('lampara', 'i', [4, 16], [4, 15, 5, 17]);
s('alfombra', 'i', [1, 8], [0, 7, 3, 10]); s('tapete', 'i', [0, 10], [0, 10, 2, 12]);
s('puerta_i', 'i', [4, 2], [4, 2, 5, 4]); s('puerta_doble', 'i', [7, 5], [7, 4, 9, 6]); s('arco_i', 'i', [5, 2], [5, 2, 6, 4]);
s('platos', 'i', [8, 8], [8, 8, 9, 9]); s('radiador', 'i', [9, 9], [9, 9, 10, 10]); s('libro', 'i', [13, 9], [13, 9, 14, 10]);
s('maceta_i', 'i', [11, 10], [11, 10, 12, 11]); s('cesta', 'i', [11, 12], [10, 12, 12, 13]);

// ── Decorado de cueva ──
fila('idolo', 'c', 6, 0, 4, 1, 3);
s('pedrusco', 'c', [5, 4], [5, 4, 6, 5]); s('pedrusco2', 'c', [6, 4], [6, 4, 7, 5]); s('penasco', 'c', [8, 5], [7, 5, 9, 7]);
s('antorcha', 'c', [0, 5], [0, 5, 1, 7]);

// ── Objetos y efectos ──
t('cofre', 'b', 0, 0); t('cofre_ab', 'b', 1, 0);
fila('corazon', 'b', 4, 0, 1);
fila('moneda', 'b', 0, 4, 4);
fila('fuego', 'b', 4, 3, 7);
fila('chispa', 'b', 11, 3, 4);
t('humo0', 'b', 4, 4, 2, 2); t('humo1', 'b', 6, 4, 2, 2); t('humo2', 'b', 8, 4, 2, 2); t('humo3', 'b', 10, 4, 2, 2); t('humo4', 'b', 12, 4, 2, 2); t('humo5', 'b', 14, 4, 2, 2);
fila('tajo', 'b', 16, 3, 8, 2, 1);
t('olla', 'b', 13, 0); t('olla2', 'b', 14, 0);
t('trozos0', 'b', 6, 6, 2, 2); t('trozos1', 'b', 8, 6, 2, 2); t('trozos2', 'b', 10, 6, 2, 2);
t('aviso', 'b', 2, 8); t('duda', 'b', 3, 8); t('globo', 'b', 2, 6);
fila('vida', 'b', 4, 8, 4);
s('losa_boton', 'b', [26, 0]); s('roca_musgo', 'b', [21, 0], [20, 0, 22, 2]);
t('matojo', 'b', 16, 12, 2, 2);
t('libro_obj', 'b', 15, 0); t('pergamino', 'b', 16, 0);

// ── Mobiliario urbano (Kenney) ──
s('farola2', 'k', [1, 6], [0, 6, 2, 8]); s('farola', 'k', [2, 6], [2, 6, 3, 8]); s('farola_v', 'k', [7, 6], [7, 6, 8, 8]);
s('senal', 'k', [4, 6], [4, 6, 5, 8]); s('parada', 'k', [5, 6], [5, 6, 6, 8]);
t('barrera', 'k', 5, 8); t('barrera2', 'k', 6, 9); t('banco_k', 'k', 7, 8);
t('buzon', 'k', 8, 11); t('buzon2', 'k', 9, 11); t('papelera', 'k', 9, 10); t('papelera2', 'k', 10, 10); t('bolsa', 'k', 11, 9);
t('hidrante', 'k', 8, 9); t('bidon', 'k', 9, 9); t('cono', 'k', 10, 11);
t('maquina', 'k', 10, 12); t('aire', 'k', 9, 12);
t('valla_metal', 'k', 4, 13, 3, 1); t('valla_naranja', 'k', 4, 14, 3, 1); t('seto', 'k', 4, 12, 3, 1);
t('jardinera', 'k', 6, 10); t('jardinera2', 'k', 7, 10); t('cajon', 'k', 3, 11); t('cajon2', 'k', 4, 11);
t('puerta_k', 'k', 13, 10); t('puerta_k2', 'k', 14, 10); t('puerta_k3', 'k', 12, 10); t('escaparate', 'k', 11, 10);
t('ventana_k', 'k', 12, 15, 1, 2); t('ventana_k2', 'k', 13, 12, 1, 2); t('toldo_k', 'k', 8, 13, 3, 1);
s('taxi', 'k', [16, 15], [15, 14, 17, 17]); s('taxi_l', 'k', [17, 15], [17, 14, 18, 17]);
s('coche_v', 'k', [21, 15], [21, 14, 22, 17]); s('coche_r', 'k', [16, 17], [15, 16, 17, 18]);
s('arbol_k', 'k', [16, 9], [16, 8, 17, 11]); s('pino_k', 'k', [22, 9], [22, 8, 23, 11]);

export const CATALOGO = C;
