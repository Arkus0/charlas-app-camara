// Registro del service worker. Si hay una versión nueva, se avisa y se instala cuando el jugador lo acepta
// (la partida está guardada en el navegador, así que recargar no la pierde).
import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';

let hayVersion = false;
let actualizar: ((recargar?: boolean) => Promise<void>) | null = null;
const oyentes = new Set<() => void>();

export function arrancarPWA() {
  if (!('serviceWorker' in navigator)) return;
  actualizar = registerSW({
    immediate: true,
    onNeedRefresh() {
      hayVersion = true;
      oyentes.forEach((f) => f());
    },
  });
}

/** ¿Hay una versión nueva esperando? Y la función para instalarla. */
export function useVersionNueva(): [boolean, () => void] {
  const hay = useSyncExternalStore(
    (f) => { oyentes.add(f); return () => oyentes.delete(f); },
    () => hayVersion,
  );
  return [hay, () => void actualizar?.(true)];
}
