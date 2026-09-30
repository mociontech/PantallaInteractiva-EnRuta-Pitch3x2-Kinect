import {
  createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState,
  type ReactNode,
} from 'react';
import { TIMING } from '../config/experience';
import { STATIC_MODE } from '../config/mode';
import { useDwellEngine } from '../interaction/DwellContext';
import { changesScreen, computeScore, initialState, reducer, type Action, type SessionState } from './machine';

interface SessionApi {
  state: SessionState;
  score: number;
  transitioning: boolean;
  /** Despacha una acción; las que cambian de pantalla pasan por la transición. */
  act: (a: Action) => void;
}

const SessionCtx = createContext<SessionApi | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const engine = useDwellEngine();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [transitioning, setTransitioning] = useState(false);
  const busy = useRef(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const act = useCallback(
    (a: Action): void => {
      if (!changesScreen(a) || STATIC_MODE) {
        dispatch(a);
        return;
      }
      if (busy.current) return;
      busy.current = true;
      setTransitioning(true);
      engine.block(TIMING.transitionBlockMs);
      // El swap ocurre a mitad del barrido (600 ms en total).
      timers.current.push(
        window.setTimeout(() => dispatch(a), TIMING.transitionBlockMs / 2),
        window.setTimeout(() => {
          setTransitioning(false);
          busy.current = false;
        }, TIMING.transitionBlockMs),
      );
    },
    [engine],
  );

  const value = useMemo<SessionApi>(
    () => ({ state, score: computeScore(state), transitioning, act }),
    [state, transitioning, act],
  );
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}

export function useSession(): SessionApi {
  const s = useContext(SessionCtx);
  if (!s) throw new Error('useSession requiere <SessionProvider>');
  return s;
}
