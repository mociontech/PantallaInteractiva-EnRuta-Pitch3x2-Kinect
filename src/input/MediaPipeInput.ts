import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import { MEDIAPIPE } from '../config/experience';
import { calibration, rawHand, setCalibration } from './calibration';
import type { InputProvider } from './InputProvider';
import { link, pushSample } from './cursorStore';
import { OneEuro } from './oneEuro';

// Índices de MediaPipe Pose (derecha = derecha anatómica de la persona).
const R_SHOULDER = 12;
const L_SHOULDER = 11;
const R_ELBOW = 14;
const R_WRIST = 16;
const R_INDEX = 20;

function visible(l: NormalizedLandmark | undefined): l is NormalizedLandmark {
  return l !== undefined && (l.visibility ?? 1) >= MEDIAPIPE.minVisibility;
}

/** Una persona detectada en el fotograma, con medidas en "unidades de ancho de imagen". */
interface Person {
  lms: NormalizedLandmark[];
  /** Punto medio de los hombros. */
  ax: number;
  ay: number;
  /** Ancho de hombros. */
  S: number;
  /** Cuánto está la muñeca por encima del codo, en anchos de hombro (+ = levantada). */
  raise: number;
  sizeOk: boolean;
  role: 'locked' | 'candidate' | 'far' | 'idle';
}

/** Usuario activo bloqueado. Mientras exista, las demás personas se ignoran. */
interface Lock {
  ax: number;
  ay: number;
  S: number;
  lastSeen: number;
  handDownSince: number | null;
}

/**
 * Cámara web + MediaPipe Pose -> mismo contrato {x, y, tracked} que TouchDesigner.
 *
 * Pensado para cámara en alto y en diagonal, con público pasando y gente quieta:
 *  - Solo controla UNA persona: la primera que levanta la mano derecha y la sostiene (acquireMs).
 *    Queda bloqueada (se sigue por posición y tamaño entre fotogramas): nadie más la reemplaza aunque
 *    esté más cerca o levante la mano. Se libera si baja la mano (releaseMs) o desaparece (lostMs).
 *  - Se descarta a quien está muy lejos/cerca (ancho de hombros fuera de rango).
 *  - Mapeo: mano derecha relativa al hombro derecho, en anchos de hombro, dentro de la zona de alcance
 *    calibrada (src/input/calibration.ts). La imagen se espeja.
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
  private lock: Lock | null = null;
  private cand: { ax: number; ay: number; S: number; since: number } | null = null;
  private fx = new OneEuro(MEDIAPIPE.filter.minCutoff, MEDIAPIPE.filter.beta, MEDIAPIPE.filter.dCutoff);
  private fy = new OneEuro(MEDIAPIPE.filter.minCutoff, MEDIAPIPE.filter.beta, MEDIAPIPE.filter.dCutoff);
  private lastX = 0.5;
  private lastY = 0.5;
  private tracked = false;
  /** Vista de la cámara en una esquina. Se oculta con ?preview=0. */
  private showPreview = new URLSearchParams(window.location.search).get('preview') !== '0';

  private onKey = (e: KeyboardEvent): void => {
    const step = 0.1;
    const c = { ...calibration };
    switch (e.key) {
      case 'ArrowLeft': c.offsetX -= step; break;
      case 'ArrowRight': c.offsetX += step; break;
      case 'ArrowUp': c.offsetY -= step; break;
      case 'ArrowDown': c.offsetY += step; break;
      case '+': case '=': // zona menor = más sensible
        c.reachWidth = Math.max(0.8, c.reachWidth - 0.1);
        c.reachHeight = Math.max(0.5, c.reachHeight - 0.067);
        break;
      case '-':
        c.reachWidth += 0.1;
        c.reachHeight += 0.067;
        break;
      default: return;
    }
    setCalibration(c, true);
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
        numPoses: MEDIAPIPE.numPoses,
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
    this.lock = null;
    this.cand = null;
    rawHand.valid = false;
    link.lock = 'none';
    link.people = 0;
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

  /** Mide a cada persona detectada (necesita hombros visibles). */
  private measure(all: NormalizedLandmark[][], aspect: number): Person[] {
    const out: Person[] = [];
    const ref = calibration.shoulderRef;
    for (const lms of all) {
      const rs = lms[R_SHOULDER];
      const ls = lms[L_SHOULDER];
      if (!visible(rs) || !visible(ls)) continue;
      const S = Math.abs(rs.x - ls.x);
      if (S <= 0) continue;
      const el = lms[R_ELBOW];
      const wr = lms[R_WRIST];
      const raise = visible(el) && visible(wr) ? ((el.y - wr.y) * aspect) / S : Number.NEGATIVE_INFINITY;
      const sizeOk = ref
        ? S >= ref * MEDIAPIPE.sizeRange.min && S <= ref * MEDIAPIPE.sizeRange.max
        : S >= MEDIAPIPE.minShoulderWidth;
      out.push({
        lms, S, raise, sizeOk, role: sizeOk ? 'idle' : 'far',
        ax: (rs.x + ls.x) / 2, ay: ((rs.y + ls.y) / 2) * aspect,
      });
    }
    return out;
  }

  /** Decide quién controla: mantiene el bloqueo o adquiere a quien sostiene la mano levantada. */
  private select(people: Person[], now: number): Person | null {
    const lock = this.lock;
    if (lock) {
      let best: Person | null = null;
      let bestD = Infinity;
      for (const p of people) {
        if (Math.abs(p.S - lock.S) / lock.S > MEDIAPIPE.followSizeTolerance) continue;
        const d = Math.hypot(p.ax - lock.ax, p.ay - lock.ay) / lock.S;
        if (d < MEDIAPIPE.followRadius && d < bestD) {
          best = p;
          bestD = d;
        }
      }
      if (best) {
        lock.ax = best.ax;
        lock.ay = best.ay;
        lock.S = lock.S * 0.8 + best.S * 0.2;
        lock.lastSeen = now;
        if (best.raise >= MEDIAPIPE.keepMargin) {
          lock.handDownSince = null;
        } else {
          lock.handDownSince ??= now;
          if (now - lock.handDownSince > MEDIAPIPE.releaseMs) {
            this.lock = null;
            return null;
          }
        }
        best.role = 'locked';
        return best;
      }
      if (now - lock.lastSeen > MEDIAPIPE.lostMs) this.lock = null;
      return null;
    }

    // Sin usuario activo: el candidato debe sostener la mano levantada acquireMs.
    let cand: Person | null = null;
    for (const p of people) {
      if (p.sizeOk && p.raise >= MEDIAPIPE.raiseMargin && (!cand || p.S > cand.S)) cand = p;
    }
    if (!cand) {
      this.cand = null;
      return null;
    }
    cand.role = 'candidate';
    const c = this.cand;
    if (!c || Math.hypot(cand.ax - c.ax, cand.ay - c.ay) / cand.S > MEDIAPIPE.followRadius) {
      this.cand = { ax: cand.ax, ay: cand.ay, S: cand.S, since: now };
      return null;
    }
    c.ax = cand.ax;
    c.ay = cand.ay;
    c.S = cand.S;
    if (now - c.since >= MEDIAPIPE.acquireMs) {
      this.lock = { ax: cand.ax, ay: cand.ay, S: cand.S, lastSeen: now, handDownSince: null };
      this.cand = null;
      cand.role = 'locked';
      return cand;
    }
    return null;
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
    const aspect = v.videoHeight / v.videoWidth;

    const people = this.measure(result.landmarks, aspect);
    const user = this.select(people, now);
    link.people = people.length;
    link.lock = this.lock ? 'locked' : this.cand ? 'candidate' : 'none';

    let hand: { x: number; y: number } | null = null;
    if (user && user.raise >= MEDIAPIPE.keepMargin) {
      const { lms, S } = user;
      const rs = lms[R_SHOULDER] as NormalizedLandmark;
      const tip = lms[R_INDEX];
      const h = visible(tip) ? tip : (lms[R_WRIST] as NormalizedLandmark);
      // Espejo en X; Y escalada a "unidades de ancho"; ambas en anchos de hombro desde el hombro derecho.
      const u = (1 - h.x - (1 - rs.x)) / S;
      const vv = ((h.y - rs.y) * aspect) / S;
      rawHand.u = u;
      rawHand.v = vv;
      rawHand.s = S;
      rawHand.valid = true;
      hand = {
        x: Math.min(1, Math.max(0, (u - calibration.offsetX) / calibration.reachWidth + 0.5)),
        y: Math.min(1, Math.max(0, (vv - calibration.offsetY) / calibration.reachHeight + 0.5)),
      };
    } else {
      rawHand.valid = false;
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

    if (this.preview) this.drawPreview(v, people, user);
  };

  private drawPreview(v: HTMLVideoElement, people: Person[], user: Person | null): void {
    const c = this.preview;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.save();
    ctx.scale(-1, 1); // espejo
    ctx.drawImage(v, -c.width, 0, c.width, c.height);
    ctx.restore();
    const aspect = v.videoHeight / v.videoWidth;

    // Todas las personas: verde = usuario activo, amarillo = candidato, rojo = fuera de rango, gris = quieta.
    const colors: Record<Person['role'], string> = { locked: '#3f3', candidate: '#ff0', far: '#f44', idle: '#aaa' };
    for (const p of people) {
      const rs = p.lms[R_SHOULDER] as NormalizedLandmark;
      const ls = p.lms[L_SHOULDER] as NormalizedLandmark;
      ctx.strokeStyle = colors[p.role];
      ctx.lineWidth = p.role === 'locked' ? 5 : 3;
      ctx.beginPath();
      ctx.moveTo((1 - rs.x) * c.width, rs.y * c.height);
      ctx.lineTo((1 - ls.x) * c.width, ls.y * c.height);
      ctx.stroke();
    }

    if (!user) return;
    const rs = user.lms[R_SHOULDER] as NormalizedLandmark;
    const S = user.S;
    // Zona de alcance en coordenadas de imagen espejada.
    const cx = 1 - rs.x + calibration.offsetX * S;
    const cy = rs.y + (calibration.offsetY * S) / aspect;
    const bw = calibration.reachWidth * S;
    const bh = (calibration.reachHeight * S) / aspect;
    ctx.strokeStyle = '#ff0';
    ctx.lineWidth = 2;
    ctx.strokeRect((cx - bw / 2) * c.width, (cy - bh / 2) * c.height, bw * c.width, bh * c.height);
    const tip = user.lms[R_INDEX];
    const h = visible(tip) ? tip : (user.lms[R_WRIST] as NormalizedLandmark);
    ctx.fillStyle = this.tracked ? '#3f3' : '#f44';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc((1 - h.x) * c.width, h.y * c.height, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}
