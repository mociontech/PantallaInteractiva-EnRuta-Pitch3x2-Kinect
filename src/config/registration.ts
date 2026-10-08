import { STATIC_MODE } from './mode';

/**
 * Modo registro: la pared espera a que alguien se registre en la tablet (/registro) y recibe a esa persona
 * desde el servidor local. En desarrollo está apagado (la pared funciona sola, como antes);
 * se fuerza con ?reg=1 o se apaga en producción con ?reg=0.
 */
const q = new URLSearchParams(window.location.search).get('reg');

export const REGISTRATION = {
  enabled: !STATIC_MODE && (q === '1' ? true : q === '0' ? false : !import.meta.env.DEV),
  /** Dirección del servidor; vacío = el mismo origen desde el que se sirvió la pared. */
  serverUrl: (import.meta.env.VITE_SERVER_URL ?? '').replace(/\/$/, ''),
};
