# Clavel Negro

Action RPG de aventura con aspecto de 16 bits. Drama criminal en la costa de Levante, noche de San Juan de 1999.

Don Hideo Tachibana, el marinero japonés que fundó el clan del Clavel Negro en Puerto Albor, ha muerto. El sello del clan
ha aparecido partido en tres y cada trozo lo guarda uno de sus lugartenientes. Tú eres Rai Montoya, «el Ahijado», y acabas de volver.

- Vista cenital con **salto y alturas**: escalones, fosos, plataformas y cajas que se empujan (y se caen).
- Combate en tiempo real: combo de tres golpes, giro cargado y la barra de **Duende**.
- Tres herramientas que abren camino: **tracas**, **mechero** y **capote**.
- Un pueblo con bar, estanco, tatuador e historias secundarias; **cuatro mazmorras, cuatro jefes** y 42 salas.
- La espalda de Rai se va tatuando: cada pieza sube la vida máxima.
- Resolución interna de SNES (256×224), color de 15 bits, luces por suma de color y sonido sintetizado con eco.
- Teclado, mando y pantalla táctil. Se guarda sola al cambiar de sala y en las cabinas.

## Controles

| | Teclado | Mando | Táctil |
|---|---|---|---|
| Moverse | Flechas o WASD | Cruceta / palanca | Cruceta |
| Golpear · hablar · abrir | Z o J | X / B | GOLPE |
| Saltar | X, K o Espacio | A | SALTO |
| Usar objeto | C o L | Y | OBJ |
| Cambiar de objeto | V o Q | L / R | CAMB |
| Pausa | Intro o Esc | Start | PAUSA |

Mantén pulsado el golpe para cargar un giro; con el Duende lleno, el giro es un remate.

## Desarrollo

```
npm install
npm run dev              # servidor de desarrollo
npm test                 # tests de lógica, mapas, progreso, jefes y puzles
npm run build            # sitio estático en dist/ (lo que publica Vercel)
npm run build:artefacto  # un único index.html jugable en dist-artefacto/
npm run atlas            # regenera el atlas a partir de recursos/originales/
```

Motor propio en TypeScript sobre Canvas 2D, sin dependencias de ejecución. La lógica (`src/juego`, `src/mundo`) no toca el DOM:
se simula a 60 pasos por segundo y los tests la juegan sin navegador.

| Carpeta | Qué hay |
|---|---|
| `src/juego` | Reglas: física con alturas, combate, enemigos, jefes, diálogos |
| `src/mundo` | Carga de salas a partir de mapas ASCII |
| `src/motor` | Pintado, luces, texto, sonido y mandos |
| `src/datos` | Salas, guion, paletas, temas gráficos y música |
| `scripts` | Generación del atlas a partir de los packs originales |
| `tests` | Validador de mapas, grafo de progreso, bots de jefes y de puzles, ruta crítica |

Los mapas son texto. `.` es suelo, `-` `=` `+` son suelos a uno, dos y tres niveles, `#` muro, `o` foso, `~` agua;
el resto de caracteres son objetos (la leyenda completa está en `src/mundo/sala.ts` y `src/juego/juego.ts`).

## Créditos

Gráficos de ArMM1998 y Kenney (CC0), fuente Tiny5 (OFL). Detalle en [CREDITOS.md](CREDITOS.md).
