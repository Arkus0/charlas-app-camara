import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Dos builds:
// - por defecto, la PWA que se publica en Vercel (archivos aparte, service worker, manifiesto y fuentes propias);
// - `vite build --mode artefacto`, un único index.html jugable sin servidor (sin PWA y con las fuentes de Google).

// Las ilustraciones (cartas y capas del mapa, ya preparadas en src/assets/web por scripts/preparar-ilustraciones.mjs)
// van como archivos aparte también en el artefacto para que el HTML siga siendo ligero.
const ILUSTRACION = /[\\/]assets[\\/]web[\\/]/;

const FUENTES_GOOGLE =
  'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=IBM+Plex+Mono:wght@400;600&family=Source+Serif+4:opsz,wght@8..60,400..600&display=swap';

/** En el artefacto no hay service worker y las fuentes vienen de Google: se sustituyen por módulos vacíos. */
function sinPWA(): Plugin {
  const VACIO = '\0vacio';
  return {
    name: 'sin-pwa',
    enforce: 'pre',
    resolveId(id) {
      if (id === 'virtual:pwa-register' || /[\\/]app[\\/]fuentes(\.ts)?$/.test(id)) return VACIO;
      return null;
    },
    load(id) {
      return id === VACIO ? 'export const registerSW = () => async () => {};' : null;
    },
    transformIndexHtml(html) {
      return {
        // fuera los iconos y metadatos de la PWA (marcados con data-pwa)
        html: html.replace(/\s*<(?:link|meta)\b[^>]*\bdata-pwa\b[^>]*>/g, ''),
        tags: [
          { tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.googleapis.com' }, injectTo: 'head' },
          { tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }, injectTo: 'head' },
          { tag: 'link', attrs: { rel: 'stylesheet', href: FUENTES_GOOGLE }, injectTo: 'head' },
        ],
      };
    },
  };
}

export default defineConfig(({ mode }) => {
  if (mode === 'artefacto') {
    return {
      plugins: [sinPWA(), react(), viteSingleFile({ useRecommendedBuildConfig: false })],
      base: './',
      publicDir: false,
      build: {
        outDir: 'dist-artefacto',
        // el JS va dentro del index.html: las rutas de las imágenes se resuelven desde la raíz
        assetsDir: '',
        assetsInlineLimit: (archivo: string) => !ILUSTRACION.test(archivo),
        chunkSizeWarningLimit: 100000000,
        cssCodeSplit: false,
        rollupOptions: { output: { inlineDynamicImports: true, assetFileNames: 'ilustraciones/[name]-[hash][extname]' } },
      },
    };
  }
  return {
    plugins: [
      react(),
      mode !== 'test' && VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'prompt',
        injectRegister: false,
        injectManifest: {
          // solo el alfabeto latino de las fuentes: el resto de subconjuntos no se usa
          globPatterns: ['**/*.{js,css,html,svg,png,webp,ico}', '**/*-latin-*.woff2'],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        },
        manifest: {
          name: '176 · La Batalla del 29N',
          short_name: '176',
          description: 'Juego de estrategia por cartas sobre las elecciones generales del 29 de noviembre de 2026.',
          lang: 'es',
          start_url: './',
          scope: './',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#0d1524',
          theme_color: '#0d1524',
          categories: ['games'],
          icons: [
            { src: 'icono-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icono-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
      }),
    ],
    base: '/',
    build: {
      outDir: 'dist',
      assetsDir: 'recursos',
      chunkSizeWarningLimit: 2000,
    },
    test: { globals: true, environment: 'node', include: ['tests/**/*.test.ts'] },
  };
});
