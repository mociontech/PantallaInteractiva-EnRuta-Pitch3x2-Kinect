import type { AreaId, SolutionId } from './content';

export const STAGE = { width: 1920, height: 1280 } as const;

export const LAYOUT = {
  header: 120,
  stage: 960,
  footer: 200,
  marginX: 96,
  gutter: 32,
  interactiveMinY: 200,
  interactiveMaxY: 1100,
} as const;

export const TIMING = {
  dwellMs: 1200,
  dwellCtaMs: 1500,
  cooldownMs: 800,
  transitionBlockMs: 600,
  inactivityWarnMs: 20_000,
  idleReturnMs: 30_000,
  untrackedIdleMs: 10_000,
  resultCountdownMs: 30_000,
} as const;

export const INPUT = {
  tdWsUrl: import.meta.env.VITE_TD_WS_URL ?? 'ws://localhost:9980',
  reconnectMs: 2000,
  /** 'td': el dwell lo calcula TouchDesigner y llega como evento. [CONFIRMAR] */
  dwellSource: 'web' as 'web' | 'td',
} as const;

export const SCORE = {
  station1: 20,
  area: 20,
  station3: 20,
  solutionCard: 10,
  gameItem: 25,
} as const;

export const GAME = {
  durationMs: 30_000,
  maxItems: 3,
  itemLifeMs: 3000,
  spawnEveryMs: 700,
  startDelayMs: 1000,
  /** Puntos de juego para llenar la barra de la planta. */
  targetPoints: 250,
  endHoldMs: 2500,
} as const;

/** [CONFIRMAR] URL del QR final; puede incluir el id de sesión. */
export const QR = {
  url: 'https://www.cccartagena.org.co',
  appendSessionId: false,
} as const;

export const FEATURES = {
  /** Video por solución en Estación 4 (dwell abre VideoContentPanel). */
  solutionVideos: false,
} as const;

/** [CONFIRMAR] Mapeo área elegida -> soluciones a resaltar en la Estación 3. */
export const AREA_TO_SOLUTIONS: Record<AreaId, readonly SolutionId[]> = {
  vender: ['programas', 'eventos', 'acompanamiento'],
  organizar: ['acompanamiento', 'informacion', 'formacion'],
  aprender: ['formacion', 'informacion'],
  conectar: ['eventos', 'programas'],
};
