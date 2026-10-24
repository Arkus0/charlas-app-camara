# 176 · La Batalla del 29N

Juego de estrategia por cartas, al estilo de *Twilight Struggle*, sobre las elecciones generales anticipadas del **29 de noviembre de 2026**. Dos bloques (Progresista: PSOE y Frente Amplio; Conservador: PP y Vox) se disputan las 52 circunscripciones durante las ocho semanas de precampaña y campaña. La noche electoral se reparten los escaños con D'Hondt y se vota la investidura.

- **Podemos es un comodín**: va por libre, su fuerza resta votos sobre todo a la izquierda, su humor decide si apoya a Sánchez, y sus cartas moradas se activan siempre y siembran el caos en los dos bloques.
- Contra la IA (fácil, normal, difícil) o a dos jugadores en el mismo PC.
- Mapa esquemático de las 52 circunscripciones, 101 cartas en tres mazos (Precampaña, Campaña y Recta final) y calendario real: cierre de listas, cara a cara del 16N, debate a cuatro del 26N y veda demoscópica.
- Proyección de escaños en directo con datos reales: la media de 16 encuestadoras de octubre de 2026 repartida por provincias.

El reglamento completo y el listado de cartas están en [`docs/REGLAMENTO.md`](docs/REGLAMENTO.md).

## Uso

```bash
npm install
npm run dev        # servidor de desarrollo (Vite)
npm test           # pruebas: D'Hondt (reproduce el 23J), motor y 200 partidas al azar
npm run build      # genera dist/index.html, un único archivo jugable sin servidor
npm run simulate -- 20 normal normal   # partidas IA contra IA para medir el equilibrio
scripts/simular-paralelo.sh 80         # lo mismo, en 4 procesos
node scripts/prueba-ui.cjs capturas    # (tras el build) juega una partida completa en el navegador
```

## Estructura

| Carpeta | Contenido |
|---|---|
| `src/engine` | Motor puro y serializable: tipos, reglas, modelo electoral (D'Hondt e investidura) y máquina de tareas y decisiones |
| `src/data` | Circunscripciones, partidos y candidaturas, cartas y `base.json` (voto de partida) |
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
