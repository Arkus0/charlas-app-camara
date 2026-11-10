import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Dos builds:
// - por defecto, el sitio estático que se publica en Vercel;
// - `vite build --mode artefacto`, un único index.html jugable sin servidor (todo incrustado).
export default defineConfig(({ mode }) => {
  if (mode === 'artefacto') {
    return {
      plugins: [viteSingleFile({ useRecommendedBuildConfig: false })],
      base: './',
      publicDir: false,
      build: {
        outDir: 'dist-artefacto',
        assetsInlineLimit: Number.MAX_SAFE_INTEGER,
        chunkSizeWarningLimit: 100000000,
        cssCodeSplit: false,
        rollupOptions: { output: { inlineDynamicImports: true } },
      },
    };
  }
  return {
    base: '/',
    build: { outDir: 'dist', assetsDir: 'recursos', chunkSizeWarningLimit: 2000 },
    test: { globals: true, environment: 'node', include: ['tests/**/*.test.ts'] },
  };
});
