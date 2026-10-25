// Vibración breve en los momentos clave (dados, cambios de control). Se puede desactivar en los ajustes.
let activa = true;
try {
  activa = localStorage.getItem('176-vibracion') !== 'no';
} catch {
  /* sin almacenamiento */
}

export function haptica(patron: number | number[] = 12) {
  if (!activa) return;
  try {
    navigator.vibrate?.(patron);
  } catch {
    /* no disponible (iOS) */
  }
}

export function vibracionActiva() {
  return activa;
}

export function activarVibracion(si: boolean) {
  activa = si;
  try {
    localStorage.setItem('176-vibracion', si ? 'si' : 'no');
  } catch {
    /* sin almacenamiento */
  }
}
