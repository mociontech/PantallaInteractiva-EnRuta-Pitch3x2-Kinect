import { useSyncExternalStore } from 'react';

/**
 * Interruptor de "lo técnico" de la pared (solo con ?debug=1): vista de la cámara, cajas de los botones y datos de rendimiento.
 * La tecla H lo oculta o lo vuelve a mostrar sin recargar. Se recuerda entre recargas en este navegador.
 */
const KEY = 'enruta.tech.hidden';

let hidden = (() => {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
})();
const listeners = new Set<() => void>();

export const isTechHidden = (): boolean => hidden;

export function toggleTech(): void {
  hidden = !hidden;
  try {
    window.localStorage.setItem(KEY, hidden ? '1' : '0');
  } catch {
    /* sin almacenamiento: vale solo hasta recargar */
  }
  listeners.forEach((l) => l());
}

export function subscribeTech(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export const useTechHidden = (): boolean => useSyncExternalStore(subscribeTech, isTechHidden);
