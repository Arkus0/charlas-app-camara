// Service worker de la PWA: guarda el juego para jugar sin conexión y muestra los avisos de turno del modo online.
// La versión nueva espera a que el jugador la acepte («Hay una versión nueva»), así nunca cambia a mitad de jugada.
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

self.addEventListener('message', (ev) => {
  if (ev.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

interface AvisoTurno {
  titulo?: string;
  cuerpo?: string;
  partida?: string;
  url?: string;
}

// Avisos de turno (modo online). Un aviso sin contenido muestra un «Te toca» genérico.
self.addEventListener('push', (ev) => {
  let datos: AvisoTurno = {};
  try {
    datos = ev.data?.json() ?? {};
  } catch {
    datos = {};
  }
  const titulo = datos.titulo ?? '176 · Te toca';
  ev.waitUntil(
    self.registration.showNotification(titulo, {
      body: datos.cuerpo ?? 'Tu rival ya ha jugado: es tu turno.',
      icon: 'icono-192.png',
      badge: 'icono-192.png',
      // el aviso nuevo de una partida sustituye al anterior
      tag: datos.partida ? `partida-${datos.partida}` : 'partida',
      data: { url: datos.url ?? './' },
    }),
  );
});

self.addEventListener('notificationclick', (ev) => {
  ev.notification.close();
  const url = new URL((ev.notification.data as { url?: string })?.url ?? './', self.registration.scope).href;
  ev.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const v of ventanas) {
        if ('focus' in v) {
          await (v as WindowClient).navigate(url).catch(() => undefined);
          return (v as WindowClient).focus();
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
