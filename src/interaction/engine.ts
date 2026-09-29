import { INPUT, STAGE, TIMING } from '../config/experience';
import { cursor, subscribeActivate } from '../input/cursorStore';

export type TargetMode = 'dwell' | 'contact';
export type TargetShape = 'rect' | 'circle';

export interface TargetOptions {
  dwellMs: number;
  /** px de Stage que se suman al hitbox por cada lado. */
  padding: number;
  disabled: boolean;
  mode: TargetMode;
  shape: TargetShape;
  color: string;
  onActivate: () => void;
}

export interface TargetView {
  hover: boolean;
  progress: number;
}

export interface StageRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Registration {
  id: string;
  getEl: () => HTMLElement | null;
  opts: TargetOptions;
  setView: (v: TargetView) => void;
  view: TargetView;
  progressMs: number;
  needsExit: boolean;
  wasHit: boolean;
}

/**
 * Hit-testing centralizado: un solo loop de rAF para todos los DwellTarget.
 * Trabaja en coordenadas de Stage (1920×1280).
 */
export class DwellEngine {
  private regs = new Map<string, Registration>();
  private raf = 0;
  private last = 0;
  private cooldownUntil = 0;
  private blockedUntil = 0;
  private stageEl: HTMLElement | null = null;
  private unsubActivate: (() => void) | null = null;
  private bestId: string | null = null;

  /** Rectángulos actuales, para el overlay de debug. */
  debugRects: Array<StageRect & { id: string; hover: boolean; disabled: boolean }> = [];

  setStageEl(el: HTMLElement | null): void {
    this.stageEl = el;
  }

  block(ms: number): void {
    this.blockedUntil = performance.now() + ms;
  }

  isBlocked(): boolean {
    return performance.now() < this.blockedUntil;
  }

  register(
    id: string,
    getEl: () => HTMLElement | null,
    opts: TargetOptions,
    setView: (v: TargetView) => void,
  ): Registration {
    const reg: Registration = {
      id, getEl, opts, setView,
      view: { hover: false, progress: 0 },
      progressMs: 0, needsExit: false, wasHit: false,
    };
    this.regs.set(id, reg);
    return reg;
  }

  unregister(id: string): void {
    this.regs.delete(id);
  }

  start(): void {
    if (this.raf) return;
    this.last = performance.now();
    const loop = (now: number): void => {
      this.tick(now);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    this.unsubActivate = subscribeActivate(() => this.activateHovered());
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.unsubActivate?.();
  }

  /** Solo con DWELL_SOURCE = 'td': TouchDesigner decide cuándo activar. */
  private activateHovered(): void {
    if (INPUT.dwellSource !== 'td' || this.isBlocked() || !this.bestId) return;
    const reg = this.regs.get(this.bestId);
    if (reg && !reg.opts.disabled) reg.opts.onActivate();
  }

  private rectOf(reg: Registration, sr: DOMRect): StageRect | null {
    const el = reg.getEl();
    if (!el) return null;
    const k = sr.width / STAGE.width;
    const r = el.getBoundingClientRect();
    return { x: (r.left - sr.left) / k, y: (r.top - sr.top) / k, w: r.width / k, h: r.height / k };
  }

  private isHit(rect: StageRect, reg: Registration): boolean {
    const p = reg.opts.padding;
    if (reg.opts.shape === 'circle') {
      const cx = rect.x + rect.w / 2;
      const cy = rect.y + rect.h / 2;
      const r = Math.min(rect.w, rect.h) / 2 + p;
      return Math.hypot(cursor.x - cx, cursor.y - cy) <= r;
    }
    return (
      cursor.x >= rect.x - p && cursor.x <= rect.x + rect.w + p &&
      cursor.y >= rect.y - p && cursor.y <= rect.y + rect.h + p
    );
  }

  private setView(reg: Registration, hover: boolean, progress: number): void {
    if (reg.view.hover === hover && reg.view.progress === progress) return;
    reg.view = { hover, progress };
    reg.setView(reg.view);
  }

  private tick(now: number): void {
    const dt = Math.min(100, now - this.last);
    this.last = now;
    const sr = this.stageEl?.getBoundingClientRect();
    if (!sr || sr.width === 0) return;

    const active = cursor.tracked && now >= this.blockedUntil;
    const hits: Array<{ reg: Registration; dist: number }> = [];
    const dbg: typeof this.debugRects = [];

    for (const reg of this.regs.values()) {
      const rect = this.rectOf(reg, sr);
      if (!rect) continue;
      const hit = active && !reg.opts.disabled && this.isHit(rect, reg);
      dbg.push({ ...rect, id: reg.id, hover: hit, disabled: reg.opts.disabled });
      if (hit) {
        const dist = Math.hypot(cursor.x - (rect.x + rect.w / 2), cursor.y - (rect.y + rect.h / 2));
        hits.push({ reg, dist });
      } else {
        reg.wasHit = false;
        reg.needsExit = false;
        reg.progressMs = 0;
        this.setView(reg, false, 0);
      }
    }
    this.debugRects = dbg;

    // Objetivos de contacto: activan al entrar, todos independientes.
    // Objetivos de dwell: solo el más cercano al cursor.
    let best: { reg: Registration; dist: number } | null = null;
    for (const h of hits) {
      if (h.reg.opts.mode === 'contact') {
        if (!h.reg.wasHit) h.reg.opts.onActivate();
        h.reg.wasHit = true;
        this.setView(h.reg, true, 1);
      } else if (!best || h.dist < best.dist) {
        best = h;
      }
    }

    for (const h of hits) {
      if (h.reg.opts.mode === 'dwell' && h !== best) {
        h.reg.progressMs = 0;
        h.reg.needsExit = false;
        this.setView(h.reg, false, 0);
      }
    }

    this.bestId = best ? best.reg.id : null;
    if (!best) {
      cursor.progress = 0;
      cursor.hoverId = null;
      return;
    }

    const reg = best.reg;
    cursor.hoverId = reg.id;
    cursor.color = reg.opts.color;
    if (INPUT.dwellSource === 'td' || reg.needsExit || now < this.cooldownUntil) {
      this.setView(reg, true, 0);
      cursor.progress = 0;
      return;
    }
    reg.progressMs += dt;
    const progress = Math.min(1, reg.progressMs / reg.opts.dwellMs);
    this.setView(reg, true, progress);
    cursor.progress = progress;
    if (progress >= 1) {
      reg.progressMs = 0;
      reg.needsExit = true;
      this.cooldownUntil = now + TIMING.cooldownMs;
      cursor.progress = 0;
      this.setView(reg, true, 0);
      reg.opts.onActivate();
    }
  }
}
