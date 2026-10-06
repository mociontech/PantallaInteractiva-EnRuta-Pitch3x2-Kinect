import { MEDIAPIPE } from '../config/experience';

/**
 * Zona de alcance de la mano (input=cam), en anchos de hombro y relativa al hombro derecho:
 *   nx = (u - offsetX) / reachWidth  + 0.5
 *   ny = (v - offsetY) / reachHeight + 0.5
 * donde (u, v) es la posición de la mano espejada, medida desde el hombro derecho en anchos de hombro.
 */
export interface Calibration {
  offsetX: number;
  offsetY: number;
  reachWidth: number;
  reachHeight: number;
  /** Ancho de hombros (fracción del ancho de imagen) medido en el punto de uso; filtra a quien está lejos/cerca. */
  shoulderRef?: number;
}

const KEY = 'enruta.cam.calibration.v2';

export const defaultCalibration: Calibration = {
  offsetX: MEDIAPIPE.reachOffsetX,
  offsetY: MEDIAPIPE.reachOffsetY,
  reachWidth: MEDIAPIPE.reachWidth,
  reachHeight: (MEDIAPIPE.reachWidth * 2) / 3,
};

function isCalibration(v: unknown): v is Calibration {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.offsetX === 'number' && typeof o.offsetY === 'number' &&
    typeof o.reachWidth === 'number' && typeof o.reachHeight === 'number' &&
    (o.shoulderRef === undefined || typeof o.shoulderRef === 'number')
  );
}

function load(): Calibration {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p: unknown = JSON.parse(raw);
      if (isCalibration(p)) return p;
    }
  } catch {
    /* sin localStorage: valores por defecto */
  }
  return { ...defaultCalibration };
}

/** Calibración activa (mutable, la lee MediaPipeInput en cada frame). */
export const calibration: Calibration = load();

/** Última medida cruda de la mano, en las mismas unidades (u, v) que usa la calibración. */
export const rawHand = { u: 0, v: 0, s: 0, valid: false };

export function setCalibration(c: Calibration, persist: boolean): void {
  Object.assign(calibration, c);
  if (!persist) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(calibration));
  } catch {
    /* ignorar */
  }
}

export function resetCalibration(): void {
  setCalibration({ ...defaultCalibration }, true);
}

export interface CornerSample {
  /** Posición normalizada del punto objetivo en el Stage. */
  nx: number;
  ny: number;
  u: number;
  v: number;
}

/**
 * Ajuste lineal a partir de las 4 esquinas: [arriba-izq, arriba-der, abajo-der, abajo-izq].
 * Devuelve null si las muestras son degeneradas.
 */
export function fitCalibration(s: readonly [CornerSample, CornerSample, CornerSample, CornerSample]): Calibration | null {
  const [tl, tr, br, bl] = s;
  const uL = (tl.u + bl.u) / 2;
  const uR = (tr.u + br.u) / 2;
  const vT = (tl.v + tr.v) / 2;
  const vB = (bl.v + br.v) / 2;
  const nxL = (tl.nx + bl.nx) / 2;
  const nxR = (tr.nx + br.nx) / 2;
  const nyT = (tl.ny + tr.ny) / 2;
  const nyB = (bl.ny + br.ny) / 2;
  const width = (uR - uL) / (nxR - nxL);
  const height = (vB - vT) / (nyB - nyT);
  if (!(width > 0.3) || !(height > 0.2)) return null;
  return {
    reachWidth: width,
    reachHeight: height,
    offsetX: (uL + uR) / 2 - ((nxL + nxR) / 2 - 0.5) * width,
    offsetY: (vT + vB) / 2 - ((nyT + nyB) / 2 - 0.5) * height,
  };
}
