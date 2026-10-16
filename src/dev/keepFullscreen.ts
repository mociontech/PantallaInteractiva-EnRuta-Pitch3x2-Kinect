/**
 * Mantiene la pared en pantalla completa. Los navegadores solo permiten pedirla tras un gesto del usuario, así que:
 * al primer toque, clic o tecla entra en pantalla completa, y si se sale (Esc, F11, etc.) vuelve a entrar en el siguiente gesto.
 * Lo más firme sigue siendo abrir Chrome con --kiosk (ver iniciar-pared.bat), que ya arranca a pantalla completa.
 */
export function keepFullscreen(): () => void {
  const enter = (): void => {
    if (document.fullscreenElement) return;
    document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {
      /* sin gesto válido o bloqueado: se reintenta en el siguiente */
    });
  };
  const opts = { capture: true } as const;
  window.addEventListener('pointerdown', enter, opts);
  window.addEventListener('keydown', enter, opts);
  return () => {
    window.removeEventListener('pointerdown', enter, opts);
    window.removeEventListener('keydown', enter, opts);
  };
}
