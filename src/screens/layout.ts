import type { CSSProperties } from 'react';

/** Posiciona en coordenadas absolutas de Stage (px de referencia). */
export function at(x: number, y: number, w?: number, h?: number): CSSProperties {
  return { position: 'absolute', left: x, top: y, width: w, height: h };
}

/** Posiciona centrando en (cx, cy). */
export function centered(cx: number, cy: number, w: number, h: number): CSSProperties {
  return { position: 'absolute', left: cx - w / 2, top: cy - h / 2, width: w, height: h };
}
