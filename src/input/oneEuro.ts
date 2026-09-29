/** Filtro One Euro (Casiez et al. 2012): suaviza en reposo y casi no añade latencia al moverse rápido. */
class LowPass {
  private y: number | null = null;
  filter(x: number, alpha: number): number {
    this.y = this.y === null ? x : alpha * x + (1 - alpha) * this.y;
    return this.y;
  }
  last(): number | null {
    return this.y;
  }
}

function alpha(cutoff: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

export class OneEuro {
  private x = new LowPass();
  private dx = new LowPass();
  private t: number | null = null;

  constructor(
    private minCutoff: number,
    private beta: number,
    private dCutoff: number,
  ) {}

  reset(): void {
    this.x = new LowPass();
    this.dx = new LowPass();
    this.t = null;
  }

  /** @param tMs timestamp en ms */
  filter(value: number, tMs: number): number {
    if (this.t === null) {
      this.t = tMs;
      return this.x.filter(value, 1);
    }
    const dt = Math.max(1e-3, (tMs - this.t) / 1000);
    this.t = tMs;
    const prev = this.x.last() ?? value;
    const dValue = this.dx.filter((value - prev) / dt, alpha(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(dValue);
    return this.x.filter(value, alpha(cutoff, dt));
  }
}
