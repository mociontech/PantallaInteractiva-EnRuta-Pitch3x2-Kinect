import { SCREEN_ORDER, type Screen } from '../state/machine';

const params = new URLSearchParams(window.location.search);

/**
 * Modo captura (?screen=s2&static=1): sin animaciones ni cursor, Stage a 1920×1280 reales
 * y contenido en su estado final. Sirve para pasar cada pantalla a Figma.
 */
export const STATIC_MODE = params.get('static') === '1';

/** Pantalla inicial pedida por ?screen= (solo debug/dev/captura). */
export function requestedScreen(): Screen | null {
  const q = params.get('screen');
  return SCREEN_ORDER.find((s) => s === q) ?? null;
}
