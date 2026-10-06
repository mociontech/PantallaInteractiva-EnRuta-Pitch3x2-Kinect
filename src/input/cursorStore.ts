import { STAGE } from '../config/experience';
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
};

export const link = {
  kind: 'mouse' as InputKind,
  status: 'n/a' as LinkStatus,
  /** Cámara: estado del bloqueo de usuario y personas detectadas (debug). */
  lock: 'none' as 'none' | 'candidate' | 'locked',
  people: 0,
};

type Listener = () => void;
const trackedListeners = new Set<Listener>();
const activateListeners = new Set<Listener>();

export function pushSample(s: InputSample): void {
  cursor.x = s.x * STAGE.width;
  cursor.y = s.y * STAGE.height;
  if (cursor.tracked !== s.tracked) {
    cursor.tracked = s.tracked;
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
