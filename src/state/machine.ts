import type { AreaId, SolutionId } from '../config/content';
import { SCORE } from '../config/experience';

export type Screen = 'idle' | 'instructions' | 'calibration' | 'home' | 's1' | 's2' | 's3' | 's4' | 's5' | 'result';

/** Tabla de transiciones explícita. 'idle' desde cualquier pantalla = abandono/inactividad. */
export const TRANSITIONS: Record<Screen, readonly Screen[]> = {
  idle: ['instructions', 'calibration'],
  instructions: ['home', 'idle'],
  calibration: ['idle'],
  home: ['s1', 's2', 's3', 's4', 's5', 'idle'],
  s1: ['home', 'idle'],
  s2: ['home', 'idle'],
  s3: ['home', 'idle'],
  s4: ['home', 'idle'],
  s5: ['result', 'idle'],
  result: ['idle'],
};

/** Orden para los atajos de debug: 1–9 y 0 (décima). */
export const SCREEN_ORDER: readonly Screen[] = [
  'idle', 'instructions', 'home', 's1', 's2', 's3', 's4', 's5', 'result', 'calibration',
];

export interface SessionState {
  screen: Screen;
  /** Estaciones completadas (1..5). El desbloqueo es secuencial. */
  completed: readonly number[];
  areas: readonly AreaId[];
  solutionsViewed: readonly SolutionId[];
  gameScore: number;
  sessionId: string | null;
  startedAt: number | null;
  endedAt: number | null;
}

export type Action =
  | { type: 'START' }
  | { type: 'CALIBRATE' }
  | { type: 'GO'; to: Screen }
  | { type: 'COMPLETE_STATION'; n: number }
  | { type: 'TOGGLE_AREA'; area: AreaId }
  | { type: 'VIEW_SOLUTION'; id: SolutionId }
  | { type: 'ADD_GAME_SCORE'; points: number }
  | { type: 'RESET' }
  | { type: 'DEBUG_JUMP'; to: Screen }
  | { type: 'DEBUG_UNLOCK_ALL' };

/** Acciones que cambian de pantalla (se ejecutan con TransitionOverlay). */
export function changesScreen(a: Action): boolean {
  return (
    a.type === 'START' || a.type === 'CALIBRATE' || a.type === 'GO' || a.type === 'COMPLETE_STATION' ||
    a.type === 'RESET' || a.type === 'DEBUG_JUMP'
  );
}

export const initialState: SessionState = {
  screen: 'idle',
  completed: [],
  areas: [],
  solutionsViewed: [],
  gameScore: 0,
  sessionId: null,
  startedAt: null,
  endedAt: null,
};

function newSessionId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `s-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export function nextStation(s: SessionState): number {
  return s.completed.length + 1;
}

export function computeScore(s: SessionState): number {
  const has = (n: number): boolean => s.completed.includes(n);
  return (
    (has(1) ? SCORE.station1 : 0) +
    s.areas.length * SCORE.area +
    (has(3) ? SCORE.station3 : 0) +
    s.solutionsViewed.length * SCORE.solutionCard +
    s.gameScore
  );
}

export function lastStep(s: SessionState): number {
  if (s.screen === 'result') return 6;
  const m = /^s(\d)$/.exec(s.screen);
  if (m) return Number(m[1]);
  return s.completed.length;
}

function go(s: SessionState, to: Screen): SessionState {
  if (!TRANSITIONS[s.screen].includes(to)) return s;
  return { ...s, screen: to };
}

export function reducer(s: SessionState, a: Action): SessionState {
  switch (a.type) {
    case 'START':
      if (s.screen !== 'idle') return s;
      return { ...initialState, screen: 'instructions', sessionId: newSessionId(), startedAt: Date.now() };

    case 'CALIBRATE':
      return go(s, 'calibration');

    case 'GO': {
      // Solo se puede entrar a la siguiente estación disponible.
      const st = /^s(\d)$/.exec(a.to);
      if (s.screen === 'home' && st && Number(st[1]) !== nextStation(s)) return s;
      return go(s, a.to);
    }

    case 'COMPLETE_STATION': {
      if (s.screen !== `s${a.n}`) return s;
      const completed = s.completed.includes(a.n) ? s.completed : [...s.completed, a.n];
      if (a.n === 5) return { ...go(s, 'result'), completed, endedAt: Date.now() };
      return { ...go(s, 'home'), completed };
    }

    case 'TOGGLE_AREA': {
      if (s.screen !== 's2') return s;
      if (s.areas.includes(a.area)) return { ...s, areas: s.areas.filter((x) => x !== a.area) };
      if (s.areas.length >= 2) return s;
      return { ...s, areas: [...s.areas, a.area] };
    }

    case 'VIEW_SOLUTION':
      if (s.solutionsViewed.includes(a.id)) return s;
      return { ...s, solutionsViewed: [...s.solutionsViewed, a.id] };

    case 'ADD_GAME_SCORE':
      if (s.screen !== 's5') return s;
      return { ...s, gameScore: s.gameScore + a.points };

    case 'RESET':
      return { ...initialState };

    case 'DEBUG_JUMP': {
      const base: SessionState = s.sessionId
        ? s
        : { ...s, sessionId: newSessionId(), startedAt: Date.now() };
      const areas: readonly AreaId[] = base.areas.length === 2 ? base.areas : ['vender', 'organizar'];
      return { ...base, areas, screen: a.to };
    }

    case 'DEBUG_UNLOCK_ALL':
      return { ...s, completed: [1, 2, 3, 4] };
  }
}
