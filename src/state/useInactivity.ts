import { useEffect, useState } from 'react';
import { TIMING } from '../config/experience';
import { isDebugMode } from '../config/mode';
import { idleMs } from './activity';
import type { Screen } from './machine';
import { useSession } from './SessionContext';

/** Pantallas en las que la persona debe estar interactuando (no IDLE, resultado ni calibración). */
const ACTIVE: ReadonlySet<Screen> = new Set(['instructions', 'home', 's1', 's2', 's3', 's4', 's5']);

/**
 * Inactividad: a los 20 s sin mover la mano ni activar nada avisa "¿Sigues ahí?" con cuenta regresiva;
 * a los 30 s vuelve a IDLE (el puntaje parcial se envía como abandono y la pared queda libre).
 * Apagada en desarrollo/debug (se fuerza con ?inactivity=1).
 * Devuelve los segundos que faltan si hay que mostrar el aviso, o null.
 */
export function useInactivity(): number | null {
  const { state, act } = useSession();
  const [warn, setWarn] = useState<number | null>(null);
  const active = ACTIVE.has(state.screen);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('inactivity');
    const enabled = q === '1' || (q !== '0' && !isDebugMode());
    if (!enabled || !active) {
      setWarn(null);
      return undefined;
    }
    const iv = window.setInterval(() => {
      const idle = idleMs();
      if (idle > TIMING.idleReturnMs) {
        setWarn(null);
        act({ type: 'RESET' });
      } else if (idle > TIMING.inactivityWarnMs) {
        setWarn(Math.max(1, Math.ceil((TIMING.idleReturnMs - idle) / 1000)));
      } else {
        setWarn(null);
      }
    }, 500);
    return () => window.clearInterval(iv);
  }, [active, act]);

  return warn;
}
