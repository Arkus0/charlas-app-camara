# 176 · La Batalla del 29N

Juego de estrategia por cartas **para el móvil** sobre las elecciones generales anticipadas del **29 de noviembre de 2026**. Dos bloques (Progresista: PSOE y Frente Amplio; Conservador: PP y Vox) se disputan las 52 circunscripciones durante las ocho semanas de precampaña y campaña. La noche electoral se reparten los escaños con D'Hondt y se vota la investidura. Una partida contra la IA dura entre 10 y 20 minutos.

- **Se juega con una mano**: tocas una carta, eliges cómo jugarla (evento, implantarte en una zona, atacar una provincia, negociar, marcar la agenda o subir tu Maquinaria) y antes de confirmar ves la **previsión** de escaños. Una jugada, un toque de confirmar.
- **Jugadas alternas**: 3 por semana (4 desde la semana 4); empieza quien va por delante y el que va detrás cierra la semana antes de la encuesta.
- **La Agenda**, el dilema central: siete temas con calor. Jugar una carta calienta su tema, los dos más calientes dan PC y al cerrar la semana el dominante da PV a su dueño. Tus mejores cartas pueden ser de un tema del rival: si las juegas, le haces la campaña.
- **Maquinaria de campaña**: tres ramas (Calle, Medios, Datos) que se suben descartando cartas.
- **Podemos es el caos**: va por libre, su fuerza resta votos sobre todo a la izquierda, su humor decide si apoya a Sánchez y cada semana su Agenda golpea a quien va primero. Un buen jugador conservador puede tejer **la pinza** para que se abstenga con Feijóo.
- **Noticias reales verificadas**: caso Koldo y caso Kitchen, «la fontanera» y caso Montoro, Torre Pacheco, la flotilla, el apagón, la DANA, Vito Quiles… Cada carta de un bloque tiene su **pareja espejo** en el otro, con la misma fuerza y el tema espejo.
- **El plató**: al cerrar cada semana, presentador y tertulianos cuentan la campaña en tres intervenciones; la noche electoral tiene su especial.
- Contra la IA (fácil, normal, difícil). El modo online por turnos está en camino.
- Proyección de escaños en directo con datos reales: la media de 16 encuestadoras de octubre de 2026 repartida por provincias.

El reglamento y el listado de cartas están en [`docs/REGLAMENTO.md`](docs/REGLAMENTO.md). Las cartas no llevan ilustración: cada una tiene su efecto y un breve comentario de lore.

## Uso

```bash
npm install
npm run dev        # servidor de desarrollo (Vite)
npm test           # pruebas: D'Hondt (reproduce el 23J), cada carta, la vista sin fugas, la IA y 200 partidas al azar
npm run build      # genera dist/: la PWA que se publica en Vercel (se instala en el móvil y funciona sin conexión)
npm run build:artefacto   # dist-artefacto/index.html, un único archivo jugable sin servidor
npm run simulate -- 20 normal normal   # partidas IA contra IA para medir el equilibrio
scripts/simular-paralelo.sh 80         # lo mismo, en 4 procesos
node scripts/prueba-movil.cjs capturas # (tras el build, con Playwright) sirve la PWA como Vercel, comprueba que abre sin conexión y juega una partida completa a toques en un iPhone emulado
npm run iconos                         # regenera los iconos de la PWA en public/
npm run cartas                         # imprime el listado de cartas en Markdown
```

## Estructura

| Carpeta | Contenido |
|---|---|
| `src/motor` | Motor puro y serializable: núcleo de tareas y decisiones, reglas, Agenda, Maquinaria, semana, efectos de las cartas, modelo electoral (D'Hondt e investidura), la vista de cada jugador y la previsión de jugadas |
| `src/data` | Circunscripciones, partidos y candidaturas, mazos (`mazos/`), mapa, personajes del plató y `base.json` (voto de partida) |
| `src/ia` | IA: simula cada jugada candidata sobre una copia en la que baraja lo que no ve y valora por escaños, PV esperados y Maquinaria. Corre en un Web Worker |
| `src/narrativa` | El plató: crónica semanal y especial de la noche electoral a partir de lo que ha pasado en la partida |
| `src/app` | Interfaz móvil en React: mapa por zonas, mano, hoja de jugada con previsión, hojas de zona, Congreso, Agenda y Maquinaria, momentos del rival, debates y noche electoral |
| `src/sw.ts` | Service worker: precarga del juego para jugar sin conexión y avisos de turno del modo online |
| `public` | Iconos de la PWA |
| `scripts` | Generación de datos y mapa, simulaciones, listado de cartas, prompts de imagen y prueba en móvil |
| `data/fuentes` | Datos de origen (resultados de 2023, encuestas, geografía) |

## Datos

`npm run datos` regenera `src/data/base.json` a partir de `data/fuentes`:

- Resultados oficiales del Congreso de 2023 y encuestas de 2026, tomados del repositorio [albertlra02/Modelo-29N](https://github.com/albertlra02/Modelo-29N) (MIT), que los obtiene del Ministerio del Interior y de Wikipedia.
- Estimación provincial de ElectoPanel (12-10-2026) usada para repartir por provincias la media nacional.
- Escaños de 2026 según el RD 806/2026: Madrid 38 y Cádiz 8.
- Centroides y vecindad de provincias de es-atlas 0.6.0 (IGN/CNIG).

Si cambian las candidaturas o las encuestas, basta con editar `src/data/partidos.ts` o los CSV de `data/fuentes` y volver a ejecutar `npm run datos`.
