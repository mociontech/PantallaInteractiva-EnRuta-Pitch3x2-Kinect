import type { InputProvider } from './InputProvider';
import { link, pushSample, cursor } from './cursorStore';
import { STAGE } from '../config/experience';

/**
 * Desarrollo: simula la misma señal normalizada que enviará TouchDesigner.
 * Normaliza contra el rectángulo del Stage. Tecla T alterna tracked.
 */
export class MouseInput implements InputProvider {
  readonly kind = 'mouse' as const;
  private trackedFlag = true;

  private onMove = (e: MouseEvent): void => {
    const el = document.getElementById('stage');
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    pushSample({ x, y, tracked: this.trackedFlag });
  };

  private onKey = (e: KeyboardEvent): void => {
    if (e.key.toLowerCase() !== 't') return;
    this.trackedFlag = !this.trackedFlag;
    pushSample({ x: cursor.x / STAGE.width, y: cursor.y / STAGE.height, tracked: this.trackedFlag });
  };

  start(): void {
    link.kind = 'mouse';
    link.status = 'n/a';
    window.addEventListener('mousemove', this.onMove);
    window.addEventListener('keydown', this.onKey);
  }

  stop(): void {
    window.removeEventListener('mousemove', this.onMove);
    window.removeEventListener('keydown', this.onKey);
  }
}
