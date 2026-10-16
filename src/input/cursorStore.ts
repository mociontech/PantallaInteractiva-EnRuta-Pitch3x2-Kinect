import { STAGE } from '../config/experience';
import { touchActivity } from '../state/activity';
import type { InputKind, InputSample, LinkStatus } from './InputProvider';

/**
 * Estado del cursor en px de Stage. Es un objeto mutable (no estado de React)
 * para que el loop de rAF lo lea sin re-renders.
 */
export const cursor = {
  x: STAGE.width / 2,
  y: STAGE.height / 2,
  tracked: false,
  /** Progreso de dwell (0..1) del objetivo activo y su color. */
  progress: 0,
  color: 'var(--white)',
  hoverId: null as string | null,
  /** Momento en que se perdió la mano (null si está siendo seguida). */
  lostAt: null as number | null,
  /** Hora de la última muestra y contador (para dibujar el cursor al ritmo de la pantalla). */
  t: 0,
  seq: 0,
  /** Imán: centro del botón más cercano y fuerza 0..1 (lo calcula el motor de interacción; solo afecta al dibujo). */
  magnet: { x: 0, y: 0, k: 0 },
};

export const link = {
  kind: 'mouse' as InputKind,
  status: 'n/a' as LinkStatus,
  /** Cámara: estado del bloqueo de usuario y personas detectadas (debug). */
  lock: 'none' as 'none' | 'candidate' | 'locked',
  people: 0,
  /** Cámara: velocidad real del modelo (fotogramas procesados por segundo y ms por fotograma). */
  detectFps: 0,
  detectMs: 0,
  /** Delegado real del modelo ('GPU' o 'CPU') y medidas del recorrido de cada muestra (para ?debug=1). */
  delegate: '',
  camFps: 0,
  /** ms entre que la cámara captura el fotograma y la app lo recibe; edad de la muestra cuando mueve el cursor. */
  camLatencyMs: 0,
  sampleAgeMs: 0,
  /** Ancho de hombros en px de imagen y amplificación (px de pantalla por cada px de imagen: lo que multiplica el ruido del modelo). */
  shoulderPx: 0,
  gain: 0,
  /** Temblor medido con la mano casi quieta (desviación en px de pantalla). */
  jitterPx: 0,
};

export type GateState = 'none' | 'closer' | 'back' | 'left' | 'right' | 'ok';

/**
 * Pantalla "Posicionate" (camara): la pared la activa tras el registro. Mientras esta activa, MediaPipeInput dibuja
 * la camara en `canvas`, mide si la persona esta centrada y a la distancia correcta y, al sostenerlo, la fija como usuario.
 */
export const gate = {
  active: false,
  done: false,
  state: 'none' as GateState,
  progress: 0,
  canvas: null as HTMLCanvasElement | null,
  /** Se incrementa para soltar al usuario fijado (nueva persona / fin de sesion). */
  release: 0,
};

export function releaseControl(): void {
  gate.release++;
}

type Listener = () => void;
const trackedListeners = new Set<Listener>();
const activateListeners = new Set<Listener>();

export function pushSample(s: InputSample): void {
  const nx = s.x * STAGE.width;
  const ny = s.y * STAGE.height;
  // Mover el cursor cuenta como actividad (evita que la inactividad cierre la sesión).
  if (s.tracked && Math.hypot(nx - cursor.x, ny - cursor.y) > 12) touchActivity();
  cursor.x = nx;
  cursor.y = ny;
  cursor.t = performance.now();
  cursor.seq++;
  if (cursor.tracked !== s.tracked) {
    cursor.tracked = s.tracked;
    cursor.lostAt = s.tracked ? null : performance.now();
    if (s.tracked) touchActivity();
    trackedListeners.forEach((l) => l());
  }
}

/** Evento de activación calculado por TouchDesigner (DWELL_SOURCE = 'td'). */
export function pushActivate(): void {
  activateListeners.forEach((l) => l());
}

export function subscribeTracked(l: Listener): () => void {
  trackedListeners.add(l);
  return () => trackedListeners.delete(l);
}
export function subscribeActivate(l: Listener): () => void {
  activateListeners.add(l);
  return () => activateListeners.delete(l);
}
export function getTracked(): boolean {
  return cursor.tracked;
}
