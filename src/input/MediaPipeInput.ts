import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import { MEDIAPIPE } from '../config/experience';
import type { InputProvider } from './InputProvider';
import { link, pushSample } from './cursorStore';
import { OneEuro } from './oneEuro';

// Índices de MediaPipe Pose (derecha = derecha anatómica de la persona).
const R_SHOULDER = 12;
const L_SHOULDER = 11;
const R_ELBOW = 14;
const R_WRIST = 16;
const R_INDEX = 20;

interface Calibration {
  reachWidth: number;
  offsetX: number;
  offsetY: number;
}

const CAL_KEY = 'enruta.cam.calibration';

function loadCalibration(): Calibration {
  const def: Calibration = {
    reachWidth: MEDIAPIPE.reachWidth,
    offsetX: MEDIAPIPE.reachOffsetX,
    offsetY: MEDIAPIPE.reachOffsetY,
  };
  try {
    const raw = localStorage.getItem(CAL_KEY);
    if (!raw) return def;
    const p: unknown = JSON.parse(raw);
    if (typeof p === 'object' && p !== null) {
      const o = p as Record<string, unknown>;
      if (typeof o.reachWidth === 'number' && typeof o.offsetX === 'number' && typeof o.offsetY === 'number') {
        return { reachWidth: o.reachWidth, offsetX: o.offsetX, offsetY: o.offsetY };
      }
    }
  } catch {
    /* sin localStorage: valores por defecto */
  }
  return def;
}

function saveCalibration(c: Calibration): void {
  try {
    localStorage.setItem(CAL_KEY, JSON.stringify(c));
  } catch {
    /* ignorar */
  }
}

function visible(l: NormalizedLandmark | undefined): l is NormalizedLandmark {
  return l !== undefined && (l.visibility ?? 1) >= MEDIAPIPE.minVisibility;
}

/**
 * Cámara web + MediaPipe Pose -> mismo contrato {x, y, tracked} que TouchDesigner.
 * Mapeo: posición de la mano derecha relativa al hombro derecho, en anchos de hombro,
 * dentro de una zona de alcance 3:2 -> 0..1. La imagen se espeja (derecha del usuario = derecha en pantalla).
 */
export class MediaPipeInput implements InputProvider {
  readonly kind = 'cam' as const;
  private video: HTMLVideoElement | null = null;
  private landmarker: PoseLandmarker | null = null;
  private stream: MediaStream | null = null;
  private preview: HTMLCanvasElement | null = null;
  private raf = 0;
  private stopped = false;
  private lastVideoTime = -1;
  private lastSeen = 0;
  private cal = loadCalibration();
  private fx = new OneEuro(MEDIAPIPE.filter.minCutoff, MEDIAPIPE.filter.beta, MEDIAPIPE.filter.dCutoff);
  private fy = new OneEuro(MEDIAPIPE.filter.minCutoff, MEDIAPIPE.filter.beta, MEDIAPIPE.filter.dCutoff);
  private lastX = 0.5;
  private lastY = 0.5;
  private tracked = false;

  /** Vista de la cámara en una esquina. Se oculta con ?preview=0. */
  private showPreview = new URLSearchParams(window.location.search).get('preview') !== '0';

  private onKey = (e: KeyboardEvent): void => {
    const step = 0.1;
    const c = this.cal;
    switch (e.key) {
      case 'ArrowLeft': c.offsetX -= step; break;
      case 'ArrowRight': c.offsetX += step; break;
      case 'ArrowUp': c.offsetY -= step; break;
      case 'ArrowDown': c.offsetY += step; break;
      case '+': case '=': c.reachWidth = Math.max(0.8, c.reachWidth - 0.1); break; // zona menor = más sensible
      case '-': c.reachWidth += 0.1; break;
      default: return;
    }
    saveCalibration(c);
  };

  async start(): Promise<void> {
    link.kind = 'cam';
    link.status = 'connecting';
    this.stopped = false;
    try {
      const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE.wasmPath);
      this.landmarker = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MEDIAPIPE.modelPath, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numPoses: 3,
      });
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: MEDIAPIPE.cameraWidth, height: MEDIAPIPE.cameraHeight, facingMode: 'user' },
        audio: false,
      });
      if (this.stopped) {
        this.stop();
        return;
      }
      const video = document.createElement('video');
      video.playsInline = true;
      video.muted = true;
      video.srcObject = this.stream;
      await video.play();
      this.video = video;
      if (this.showPreview) this.mountPreview();
      window.addEventListener('keydown', this.onKey);
      link.status = 'open';
      this.loop();
    } catch (err) {
      console.error('[MediaPipeInput]', err);
      link.status = 'closed';
    }
  }

  stop(): void {
    this.stopped = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKey);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.landmarker?.close();
    this.preview?.remove();
    this.stream = null;
    this.landmarker = null;
    this.video = null;
    this.preview = null;
    pushSample({ x: 0.5, y: 0.5, tracked: false });
  }

  private mountPreview(): void {
    const c = document.createElement('canvas');
    c.width = 480;
    c.height = 270;
    c.style.cssText =
      'position:fixed;left:8px;bottom:8px;width:400px;height:225px;z-index:99999;pointer-events:none;border:3px solid #fff;border-radius:12px;background:#000';
    document.body.appendChild(c);
    this.preview = c;
  }

  private loop = (): void => {
    if (this.stopped) return;
    this.raf = requestAnimationFrame(this.loop);
    const v = this.video;
    const lm = this.landmarker;
    if (!v || !lm || v.readyState < 2 || v.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = v.currentTime;
    const now = performance.now();
    const result = lm.detectForVideo(v, now);

    // Persona objetivo: la más cercana (hombros más anchos) con la mano derecha levantada; si no, ninguna.
    let best: { lms: NormalizedLandmark[]; width: number } | null = null;
    for (const lms of result.landmarks) {
      const rs = lms[R_SHOULDER];
      const ls = lms[L_SHOULDER];
      const el = lms[R_ELBOW];
      const wr = lms[R_WRIST];
      if (!visible(rs) || !visible(ls) || !visible(el) || !visible(wr)) continue;
      if (wr.y > el.y) continue; // mano por debajo del codo: no está levantada
      const width = Math.abs(rs.x - ls.x);
      if (!best || width > best.width) best = { lms, width };
    }

    // Para la vista previa: si nadie levanta la mano, mostrar igual a la persona más cercana.
    let shown = best?.lms ?? null;
    if (!shown) {
      let w = 0;
      for (const lms of result.landmarks) {
        const a = lms[R_SHOULDER];
        const b = lms[L_SHOULDER];
        if (a && b && Math.abs(a.x - b.x) > w) {
          w = Math.abs(a.x - b.x);
          shown = lms;
        }
      }
    }

    let hand: { x: number; y: number } | null = null;
    if (best) {
      const { lms, width } = best;
      const aspect = v.videoHeight / v.videoWidth;
      const rs = lms[R_SHOULDER] as NormalizedLandmark;
      const tip = lms[R_INDEX];
      const h = visible(tip) ? tip : (lms[R_WRIST] as NormalizedLandmark);
      const S = Math.max(0.02, width);
      // Espejo en X; Y escalada a "unidades de ancho".
      const hx = 1 - h.x;
      const hy = h.y * aspect;
      const cx = 1 - rs.x + this.cal.offsetX * S;
      const cy = rs.y * aspect + this.cal.offsetY * S;
      const boxW = this.cal.reachWidth * S;
      const boxH = (boxW * 2) / 3;
      hand = {
        x: Math.min(1, Math.max(0, (hx - cx) / boxW + 0.5)),
        y: Math.min(1, Math.max(0, (hy - cy) / boxH + 0.5)),
      };
    }

    if (hand) {
      this.lastSeen = now;
      if (!this.tracked) {
        this.fx.reset();
        this.fy.reset();
      }
      this.lastX = this.fx.filter(hand.x, now);
      this.lastY = this.fy.filter(hand.y, now);
      this.tracked = true;
    } else if (this.tracked && now - this.lastSeen > MEDIAPIPE.lostGraceMs) {
      this.tracked = false;
    }
    pushSample({ x: this.lastX, y: this.lastY, tracked: this.tracked });

    if (this.preview) this.drawPreview(v, shown);
  };

  private drawPreview(v: HTMLVideoElement, lms: NormalizedLandmark[] | null): void {
    const c = this.preview;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.save();
    ctx.scale(-1, 1); // espejo
    ctx.drawImage(v, -c.width, 0, c.width, c.height);
    ctx.restore();
    if (!lms || !visible(lms[R_SHOULDER]) || !visible(lms[L_SHOULDER])) return;
    const rs = lms[R_SHOULDER] as NormalizedLandmark;
    const ls = lms[L_SHOULDER] as NormalizedLandmark;
    const S = Math.abs(rs.x - ls.x);
    const aspect = v.videoHeight / v.videoWidth;
    // Zona de alcance en coordenadas de imagen espejada.
    const cx = 1 - rs.x + this.cal.offsetX * S;
    const cy = rs.y + (this.cal.offsetY * S) / aspect;
    const bw = this.cal.reachWidth * S;
    const bh = ((bw * 2) / 3) / aspect;
    ctx.strokeStyle = '#ff0';
    ctx.lineWidth = 2;
    ctx.strokeRect((cx - bw / 2) * c.width, (cy - bh / 2) * c.height, bw * c.width, bh * c.height);
    const tip = lms[R_INDEX];
    const h = visible(tip) ? tip : (lms[R_WRIST] as NormalizedLandmark);
    const px = (1 - h.x) * c.width;
    const py = h.y * c.height;
    ctx.fillStyle = this.tracked ? '#3f3' : '#f44';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(px, py, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}
