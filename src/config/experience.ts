export const STAGE = { width: 1920, height: 1280 } as const;

/**
 * Archivo de diseño de impresión: 8503,937 × 5669,291 px (3 m × 2 m a 72 ppp), 3:2.
 * 1 px de referencia del Stage = PRINT_SCALE px del archivo de diseño (≈ 4,43).
 * La resolución nativa de la pantalla no cambia nada: el Stage escala a cualquier 3:2.
 */
export const PRINT = { width: 8503.937, height: 5669.291 } as const;
export const PRINT_SCALE = PRINT.width / STAGE.width;

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

/**
 * Puntaje de la pared sobre 100 (igual que las otras experiencias). Recorrido: 40 como máximo (6 + 2×5 + 6 + 6×3);
 * juego: hasta 60 (15 aciertos netos × 4). Un 100 exige haber visto todo y llenar la barra del juego.
 */
export const SCORE = {
  station1: 6,
  area: 5,
  station3: 6,
  solutionCard: 3,
  gameItem: 4,
  max: 100,
} as const;

export const GAME = {
  durationMs: 30_000,
  maxItems: 3,
  itemLifeMs: 3000,
  spawnEveryMs: 700,
  startDelayMs: 1000,
  /** Puntos de juego para llenar la barra de la planta (y máximo que aporta el juego al total). */
  targetPoints: 60,
  endHoldMs: 2500,
  /** Probabilidad de que un ítem nuevo sea un obstáculo ("lo que no pertenece a tu ruta"). [CONFIRMAR] */
  obstacleChance: 0.35,
  /** Puntos que se pierden al tocar un obstáculo (el puntaje del juego no baja de 0). [CONFIRMAR] */
  obstaclePenalty: 4,
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

/**
 * Cámara + MediaPipe Pose (input=cam). La mano se mide relativa al cuerpo (en anchos de
 * hombro), así funciona a cualquier distancia. Valores calibrables en vivo con las flechas
 * y +/- (solo con ?input=cam&debug=1); se guardan en localStorage. [CONFIRMAR] en sitio.
 */
export const MEDIAPIPE = {
  wasmPath: '/mediapipe/wasm',
  modelPath: '/mediapipe/models/pose_landmarker_full.task',
  cameraWidth: 1280,
  cameraHeight: 720,
  minVisibility: 0.5,
  /** Personas que MediaPipe detecta a la vez (hay público pasando y gente de pie). */
  numPoses: 3,
  /** Ancho de la zona de alcance, en anchos de hombro. Alto = ancho × 2/3. */
  reachWidth: 2.6,
  /** Centro de la zona respecto al hombro derecho, en anchos de hombro (x + = derecha en pantalla, y − = arriba). */
  reachOffsetX: 0.3,
  reachOffsetY: -0.7,
  /** La vista de la cámara (pantalla "Ubícate" y depuración) se muestra normal, no como espejo. No cambia el seguimiento: el cursor sigue la mano igual. */
  mirrorPreview: false,
  /** Tiempo que se tolera perder la mano antes de marcar tracked=false. */
  lostGraceMs: 700,

  /*
   * Selección y bloqueo del usuario. Solo controla quien levanta la mano derecha y la sostiene
   * (acquireMs); mientras sea el usuario activo, el resto se ignora aunque levante la mano o esté más cerca.
   * Distancias en anchos de hombro; tiempos en ms.
   */
  /** Ancho de hombros mínimo absoluto (fracción del ancho de imagen) cuando no hay calibración: descarta a los lejanos. */
  minShoulderWidth: 0.05,
  /** Con calibración: rango aceptado del ancho de hombros respecto al medido en el punto de uso. */
  sizeRange: { min: 0.6, max: 1.7 },
  /** Muñeca por encima del codo (en anchos de hombro) para ADQUIRIR el control. */
  raiseMargin: 0.25,
  /** Para MANTENERLO basta con tener la muñeca cerca del nivel del codo (histéresis, permite descansar el brazo). */
  keepMargin: -0.15,
  acquireMs: 400,
  /** Mano abajo este tiempo = libera el control para que otra persona pueda tomarlo. */
  releaseMs: 6000,
  /** Si el usuario activo desaparece de la imagen este tiempo, se libera el control. */
  lostMs: 1500,
  /** Radio de seguimiento entre fotogramas y tolerancia de tamaño para reconocer a la misma persona. */
  followRadius: 0.8,
  /** Si el usuario deja de verse, el radio de busqueda crece despacio (anchos de hombro por segundo) hasta followMaxRadius. */
  followGrowPerSec: 0.3,
  followMaxRadius: 1.0,
  /**
   * Tamaño aceptado para seguir al usuario, respecto al suyo. Quien pasa DETRÁS (más lejos de la cámara) se ve más pequeño:
   * por debajo de followSizeMin se ignora aunque esté justo detrás. followSizeMax cubre al usuario inclinándose hacia la cámara.
   */
  followSizeMin: 0.8,
  followSizeMax: 1.35,
  /** Confianza mínima del modelo para detectar, mantener y seguir a una persona (más alta = ignora siluetas dudosas del fondo). */
  minPoseConfidence: 0.6,
  /** Alcance máximo creíble de la mano desde el hombro derecho (anchos de hombro). Más lejos = el modelo agarró el brazo de OTRA persona. */
  maxArmReach: 3.2,
  /** Si los fotogramas inválidos duran más de esto, el cursor deja de mostrarse en vez de quedarse congelado. */
  jumpDropMs: 1200,
  /** Usuario fijado en la pantalla de posicion: no pierde el control por bajar la mano; solo por desaparecer este tiempo. */
  stickyLostMs: 8000,
  /** Visibilidad minima de codo/muneca para medir el brazo (mas baja que minVisibility: con la mano cerca de la cara se oscurecen). */
  armVisibility: 0.3,
  /** Mano = muneca prolongada esta fraccion del antebrazo (estable); la punta del indice solo se mezcla si es fiable. */
  handExtend: 0.3,
  tipVisibility: 0.7,
  /** Salto maximo de la mano entre fotogramas, en anchos de hombro por segundo; mas alla se ignora el fotograma (hasta jumpGraceFrames seguidos). */
  maxHandSpeed: 14,
  jumpGraceFrames: 6,
  /** Para adquirir el control con la mano, la persona debe estar en el centro de la imagen (+/- fraccion del ancho). */
  acquireHalfWidth: 0.32,
  /** Pantalla "Posicionate": franja central, banda de tamano respecto a la calibracion y tiempo que debe sostenerse. */
  gate: { holdMs: 1500, centerHalfWidth: 0.16, searchHalfWidth: 0.4, sizeLow: 0.8, sizeHigh: 1.3, fallbackMin: 0.08, fallbackMax: 0.35 },
  /** Filtro One Euro sobre la posición (esta señal es propia, a diferencia de TD). */
  filter: { minCutoff: 1.2, beta: 0.05, dCutoff: 1.0 },
} as const;

/** Recorrido de sensibilidad en las instrucciones: puntos (px de Stage) que se visitan uno a uno. */
export const COURSE = {
  dwellMs: 700,
  /** Pausa entre un punto y el siguiente. */
  gapMs: 350,
  diameter: 200,
  points: [
    { x: 260, y: 340 },
    { x: 1660, y: 340 },
    { x: 960, y: 640 },
    { x: 1660, y: 960 },
    { x: 260, y: 960 },
  ],
} as const;
