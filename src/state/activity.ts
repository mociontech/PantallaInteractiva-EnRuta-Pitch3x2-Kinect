/**
 * Última actividad del usuario: mover el cursor, activar un botón o cambiar de pantalla.
 * La usa la inactividad para avisar ("¿Sigues ahí?") y, si nadie responde, liberar la pared.
 */
let last = performance.now();

export function touchActivity(): void {
  last = performance.now();
}

export function idleMs(): number {
  return performance.now() - last;
}
