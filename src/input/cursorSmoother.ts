/**
 * Suavizado al ritmo de la pantalla. La cámara + modelo entregan ~15–28 muestras por segundo, pero la pantalla se redibuja
 * a 60–144 Hz: dibujar el cursor solo cuando llega una muestra lo hace ver "a saltos" y atrasado. Aquí se interpola entre
 * muestras y se adelanta un poco (predicción corta) siguiendo la velocidad reciente, sin gastar casi cómputo.
 */
export interface SmootherConfig {
  /** Tope de lo que se adelanta la posición (ms): compensa la edad de la muestra (cámara + modelo + filtro). */
  predictMs: number;
  /** Fracción de la velocidad que se usa al adelantar (0..1): menos = menos rebote al frenar. */
  predictGain: number;
  /** Velocidades (px/s) entre las que la compensación pasa de 0 a 100 %: en reposo no se adelanta nada (no amplifica el temblor). */
  gateLoPxS: number;
  gateHiPxS: number;
  /** Constante de tiempo del seguimiento visual (ms): menos = más pegado a la muestra. */
  tauMs: number;
  /** Si el salto entre lo dibujado y el destino supera esto (px), se salta directo (nueva mano, teletransporte). */
  snapPx: number;
}

export class CursorSmoother {
  private sx = 0;
  private sy = 0;
  private st = 0;
  private vx = 0;
  private vy = 0;
  private dx = 0;
  private dy = 0;
  private lastFrame = 0;
  private has = false;

  constructor(private cfg: SmootherConfig) {}

  reset(x: number, y: number, t: number): void {
    this.sx = this.dx = x;
    this.sy = this.dy = y;
    this.st = this.lastFrame = t;
    this.vx = this.vy = 0;
    this.has = true;
  }

  /** Llega una muestra nueva del seguimiento (px de Stage, hora en ms). */
  push(x: number, y: number, t: number): void {
    if (!this.has) {
      this.reset(x, y, t);
      return;
    }
    const dt = t - this.st;
    if (dt > 0.5) {
      // Velocidad en px/ms, mezclada a la mitad con la anterior (la salida del filtro avanza a escalones).
      const nvx = (x - this.sx) / dt;
      const nvy = (y - this.sy) / dt;
      const a = dt > 150 ? 1 : 0.5;
      this.vx = this.vx * (1 - a) + nvx * a;
      this.vy = this.vy * (1 - a) + nvy * a;
    }
    this.sx = x;
    this.sy = y;
    this.st = t;
  }

  /**
   * Posición que se dibuja en este refresco de pantalla. `sampleAgeMs` = lo que tardó la muestra en llegar desde que la mano
   * estaba ahí (se mide en MediaPipeInput); se compensa solo mientras la mano se mueve con decisión.
   */
  frame(now: number, sampleAgeMs = 0): { x: number; y: number } {
    if (!this.has) return { x: this.sx, y: this.sy };
    const speed = Math.hypot(this.vx, this.vy) * 1000; // px/s
    const g0 = Math.max(0, Math.min(1, (speed - this.cfg.gateLoPxS) / (this.cfg.gateHiPxS - this.cfg.gateLoPxS)));
    // Si la última muestra ya no es reciente (el seguimiento se atrasó o se detuvo), la velocidad guardada está vieja: se apaga la compensación.
    const stale = now - this.st;
    const g = g0 * (stale <= 120 ? 1 : Math.max(0, 1 - (stale - 120) / 80));
    const ahead = Math.min(this.cfg.predictMs, Math.max(0, now - this.st) + sampleAgeMs) * this.cfg.predictGain * g;
    const tx = this.sx + this.vx * ahead;
    const ty = this.sy + this.vy * ahead;
    const dt = Math.max(0, Math.min(100, now - this.lastFrame));
    this.lastFrame = now;
    if (Math.hypot(tx - this.dx, ty - this.dy) > this.cfg.snapPx) {
      this.dx = tx;
      this.dy = ty;
    } else {
      const k = 1 - Math.exp(-dt / this.cfg.tauMs);
      this.dx += (tx - this.dx) * k;
      this.dy += (ty - this.dy) * k;
    }
    return { x: this.dx, y: this.dy };
  }
}
