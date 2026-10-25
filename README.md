# 176 · La Batalla del 29N

Juego de estrategia por cartas, al estilo de *Twilight Struggle*, sobre las elecciones generales anticipadas del **29 de noviembre de 2026**. Dos bloques (Progresista: PSOE y Frente Amplio; Conservador: PP y Vox) se disputan las 52 circunscripciones durante las ocho semanas de precampaña y campaña. La noche electoral se reparten los escaños con D'Hondt y se vota la investidura.

- **Todas las mecánicas de Twilight Struggle** traducidas a la campaña: efectos en vigor, guerras (batallas), Quagmire (guerra interna), crisis de los misiles (crisis institucional), carta China (El Voto Útil), Europa (Asalto a la Moncloa), Defectors, UN Intervention…
- **220 cartas** en tres mazos más la Agenda de Podemos. Cada carta de un bloque tiene su **pareja espejo** en el otro (74 y 74, los mismos PC), y muchas son **noticias reales verificadas**: caso Koldo y caso Kitchen, «la fontanera» y caso Montoro, Torre Pacheco, la flotilla, La Vuelta, Vito Quiles…
- **Podemos es el caos**: va por libre, su fuerza resta votos sobre todo a la izquierda, su humor decide si apoya a Sánchez, sus cartas moradas se activan siempre y cada semana su Agenda golpea a quien va primero.
- **El plató**: al cerrar cada semana, presentador y tertulianos cuentan la campaña como una historia; la noche electoral tiene su especial.
- Contra la IA (fácil, normal, difícil) o a dos jugadores en el mismo PC.
- Proyección de escaños en directo con datos reales: la media de 16 encuestadoras de octubre de 2026 repartida por provincias.

El reglamento completo y el listado de cartas están en [`docs/REGLAMENTO.md`](docs/REGLAMENTO.md). Los prompts para generar la ilustración de cada carta (con un estilo común) están en [`docs/PROMPTS_IMAGENES.md`](docs/PROMPTS_IMAGENES.md): guarda las imágenes en `src/assets/cartas/<id>.webp` y aparecerán solas al compilar.

## Uso

```bash
npm install
npm run dev        # servidor de desarrollo (Vite)
npm test           # pruebas: D'Hondt (reproduce el 23J), motor, cada carta y 200 partidas al azar
npm run build      # genera dist/index.html, un único archivo jugable sin servidor
npm run simulate -- 20 normal normal   # partidas IA contra IA para medir el equilibrio
scripts/simular-paralelo.sh 80         # lo mismo, en 4 procesos
node scripts/prueba-ui.cjs capturas    # (tras el build) juega una partida completa en el navegador
npx tsx scripts/prompts-imagenes.ts    # regenera docs/PROMPTS_IMAGENES.md
```

## Estructura

| Carpeta | Contenido |
|---|---|
| `src/engine` | Motor puro y serializable: tipos, reglas, modelo electoral (D'Hondt e investidura) y máquina de tareas y decisiones |
| `src/data` | Circunscripciones, partidos y candidaturas, cartas, estilo de las ilustraciones, personajes del plató y `base.json` (voto de partida) |
| `src/narrativa` | El plató: crónica semanal y especial de la noche electoral a partir de lo que ha pasado en la partida |
| `src/ai` | IA: evaluación de posiciones por escaños proyectados y política voraz con simulación |
| `src/ui` | Interfaz en React: mapa, marcadores, mano, escrutinio y noche electoral |
| `scripts` | Generación de datos, simulaciones, listado de cartas y prueba de interfaz |
| `data/fuentes` | Datos de origen (resultados de 2023, encuestas, geografía) |

## Datos

`npm run datos` regenera `src/data/base.json` a partir de `data/fuentes`:

- Resultados oficiales del Congreso de 2023 y encuestas de 2026, tomados del repositorio [albertlra02/Modelo-29N](https://github.com/albertlra02/Modelo-29N) (MIT), que los obtiene del Ministerio del Interior y de Wikipedia.
- Estimación provincial de ElectoPanel (12-10-2026) usada para repartir por provincias la media nacional.
- Escaños de 2026 según el RD 806/2026: Madrid 38 y Cádiz 8.
- Centroides y vecindad de provincias de es-atlas 0.6.0 (IGN/CNIG).

Si cambian las candidaturas o las encuestas, basta con editar `src/data/partidos.ts` o los CSV de `data/fuentes` y volver a ejecutar `npm run datos`.
