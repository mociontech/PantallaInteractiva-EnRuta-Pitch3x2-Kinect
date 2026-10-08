import { useEffect, useRef } from 'react';
import type { SessionSummary } from '../../shared/protocol';
import { REGISTRATION } from '../config/registration';
import { serverLink } from '../services/serverLink';
import { computeScore, lastStep, type Screen, type SessionState } from './machine';
import { useSession } from './SessionContext';

function summarize(s: SessionState, completed: boolean): SessionSummary {
  return {
    localId: s.sessionId,
    completed,
    lastStep: lastStep(s),
    score: computeScore(s),
    gameScore: s.gameScore,
    areas: [...s.areas],
    solutionsViewed: [...s.solutionsViewed],
    durationMs: Math.max(0, Date.now() - (s.startedAt ?? Date.now())),
    startedAt: s.startedAt,
  };
}

/**
 * Sincroniza la pared con el servidor local:
 *  - al empezar una sesión (IDLE -> instrucciones) avisa que la persona asignada comenzó;
 *  - al llegar al resultado envía el puntaje completo;
 *  - si la sesión termina antes (SALIR, inactividad, el operador la cancela) envía el puntaje parcial como abandono;
 *  - al volver a IDLE avisa que la pared está libre para la siguiente persona.
 */
export function useWallSync(): void {
  const { state, act } = useSession();
  const prev = useRef<Screen>('idle');
  const started = useRef(false);
  const finished = useRef(false);
  const lastActive = useRef<SessionState>(state);
  const screenRef = useRef<Screen>(state.screen);
  screenRef.current = state.screen;

  // El servidor cancela el turno: la pared vuelve a IDLE (el efecto de abajo reporta el abandono).
  useEffect(() => {
    if (!REGISTRATION.enabled) return undefined;
    return serverLink.onCancel(() => {
      if (screenRef.current !== 'idle' && screenRef.current !== 'calibration') act({ type: 'RESET' });
    });
  }, [act]);

  useEffect(() => {
    if (!REGISTRATION.enabled) return;
    const from = prev.current;
    const to = state.screen;
    prev.current = to;
    if (to !== 'idle') lastActive.current = state;
    if (from === to) return;

    if (from === 'idle' && to === 'instructions') {
      started.current = true;
      finished.current = false;
      serverLink.clearAssigned();
      serverLink.send({ t: 'session-start', localId: state.sessionId });
    } else if (to === 'result') {
      finished.current = true;
      serverLink.send({ t: 'session-end', summary: summarize(state, true) });
    } else if (to === 'idle') {
      if (started.current && !finished.current) {
        serverLink.send({ t: 'session-end', summary: summarize(lastActive.current, false) });
      }
      started.current = false;
      finished.current = false;
      serverLink.send({ t: 'wall-idle' });
    }
  }, [state]);
}
