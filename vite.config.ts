import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Las ilustraciones (cartas y capas del mapa, ya preparadas en src/assets/web por scripts/preparar-ilustraciones.mjs)
// se sirven como archivos aparte para que el HTML siga siendo ligero; todo lo demás (JS, CSS) va dentro de un único index.html.
const ILUSTRACION = /[\\/]assets[\\/]web[\\/]/;

export default defineConfig({
  plugins: [react(), viteSingleFile({ useRecommendedBuildConfig: false })],
  base: './',
  build: {
    outDir: 'dist',
    // el JS va dentro del index.html: las rutas de las imágenes se resuelven desde la raíz
    assetsDir: '',
    assetsInlineLimit: (archivo: string) => !ILUSTRACION.test(archivo),
    chunkSizeWarningLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: { output: { inlineDynamicImports: true, assetFileNames: 'ilustraciones/[name]-[hash][extname]' } },
  },
  test: { globals: true, environment: 'node', include: ['tests/**/*.test.ts'] },
});
