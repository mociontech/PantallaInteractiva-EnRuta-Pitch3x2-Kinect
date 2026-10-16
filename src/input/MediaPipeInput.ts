import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import { MEDIAPIPE } from '../config/experience';
import { calibration, rawHand, setCalibration } from './calibration';
import type { InputProvider } from './InputProvider';
import { gate, link, pushSample, type GateState } from './cursorStore';
import { OneEuro } from './oneEuro';
import { STAGE } from '../config/experience';
import { CLASSIC_CURSOR } from '../config/mode';

// Índices de MediaPipe Pose (derecha = derecha anatómica de la persona).
const R_SHOULDER = 12;
const L_SHOULDER = 11;
const R_ELBOW = 14;
const R_WRIST = 16;
const R_INDEX = 20;

function visible(l: NormalizedLandmark | undefined, min: number = MEDIAPIPE.minVisibility): l is NormalizedLandmark {
  return l !== undefined && (l.visibility ?? 1) >= min;
}

/** Una persona detectada en el fotograma, con medidas en "unidades de ancho de imagen". */
interface Person {
  lms: NormalizedLandmark[];
  /** Punto medio de los hombros. */
  ax: number;
  ay: number;
  /** Ancho de hombros. */
  S: number;
  /** Cuánto está la muñeca por encima del codo, en anchos de hombro (+ = levantada). Visibilidad laxa: con la mano cerca de la cara se oscurece. */
  raise: number;
  /** Igual, pero exigiendo buena visibilidad (para adquirir el control, donde un falso positivo cuesta más). */
  raiseStrict: number;
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
  /** Fijado en la pantalla "Posiciónate": no se suelta por bajar la mano. */
  sticky: boolean;
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
  /** Posición que realmente se entrega al cursor (tras la zona muerta). */
  private outX = 0.5;
  private outY = 0.5;
  /** Marco de referencia suavizado: hombro derecho y ancho de hombros. */
  private ref: { x: number; y: number; S: number; t: number } | null = null;
  private tracked = false;
  /** Vista de la cámara en una esquina: solo para depuración (?debug=1 o ?preview=1). En producción solo se ve en "Posiciónate". */
  private showPreview = ((q: URLSearchParams) => q.get('preview') === '1' || q.get('debug') === '1')(new URLSearchParams(window.location.search));
  /** Vista de la cámara como espejo. Por defecto la imagen se ve normal (MEDIAPIPE.mirrorPreview); ?mirror=1 / ?mirror=0 lo cambia. */
  private mirror = ((q: URLSearchParams) => (q.get('mirror') === '1' ? true : q.get('mirror') === '0' ? false : MEDIAPIPE.mirrorPreview))(
    new URLSearchParams(window.location.search),
  );
  private releaseSeen = gate.release;
  private gateHold: number | null = null;
  private lastRaw: { u: number; v: number; t: number } | null = null;
  private jumpRejects = 0;
  private rejectSince: number | null = null;
  private frames = 0;
  private fpsSince = 0;
  /** Inferencia en un worker (fuera del hilo de la interfaz). ?worker=0 fuerza el modo anterior (hilo principal) para comparar. */
  private useWorker = new URLSearchParams(window.location.search).get('worker') !== '0';
  private worker: Worker | null = null;
  private inflight = false;
  /** Medidores: fotogramas de cámara por segundo y salida reciente del cursor (para el temblor). */
  private camFrames = 0;
  private camSince = 0;
  private vfc = 0;
  private lastFilterT = 0;
  private recent: Array<{ x: number; y: number }> = [];

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
      await this.initInference();
      this.stream = await this.openCamera();
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
      this.startFrameLoop();
    } catch (err) {
      console.error('[MediaPipeInput]', err);
      link.status = 'closed';
    }
  }

  /** Pide la cámara con lo ideal y, si el dispositivo no lo da (OverconstrainedError), baja las exigencias en vez de quedarse sin cámara. */
  private async openCamera(): Promise<MediaStream> {
    const attempts: MediaTrackConstraints[] = [
      { width: { ideal: MEDIAPIPE.cameraWidth }, height: { ideal: MEDIAPIPE.cameraHeight }, frameRate: { ideal: MEDIAPIPE.cameraFps }, facingMode: 'user' },
      { width: { ideal: MEDIAPIPE.cameraWidth }, height: { ideal: MEDIAPIPE.cameraHeight } },
      {},
    ];
    let lastErr: unknown;
    for (const video of attempts) {
      try {
        return await navigator.mediaDevices.getUserMedia({ video, audio: false });
      } catch (err) {
        lastErr = err;
        if (!(err instanceof DOMException) || err.name !== 'OverconstrainedError') throw err;
      }
    }
    throw lastErr;
  }

  /** Worker si se puede; si no inicia o falla, el modelo corre en el hilo principal como antes. */
  private async initInference(): Promise<void> {
    if (this.useWorker && typeof Worker !== 'undefined' && typeof createImageBitmap === 'function') {
      try {
        await this.startWorker();
        return;
      } catch (err) {
        console.warn('[MediaPipeInput] el worker no está disponible; se usa el hilo principal.', err);
        this.dropWorker();
      }
    }
    await this.startMainLandmarker();
  }

  private async startMainLandmarker(): Promise<void> {
    const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE.wasmPath);
    link.delegate = 'GPU (hilo principal)';
    this.landmarker = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MEDIAPIPE.modelPath, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numPoses: CLASSIC_CURSOR ? 3 : MEDIAPIPE.numPoses,
      minPoseDetectionConfidence: MEDIAPIPE.minPoseConfidence,
      minPosePresenceConfidence: MEDIAPIPE.minPoseConfidence,
      minTrackingConfidence: MEDIAPIPE.minPoseConfidence,
    });
  }

  private startWorker(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const w = new Worker('/mediapipe/pose-worker.js');
      this.worker = w;
      const timer = window.setTimeout(() => reject(new Error('el worker no respondió a tiempo')), 30_000);
      w.onerror = (ev) => {
        window.clearTimeout(timer);
        if (this.worker === w && this.video) {
          // Falló después de arrancar: se vuelve al hilo principal sin cortar la experiencia.
          console.warn('[MediaPipeInput] error del worker; se pasa al hilo principal.', ev.message);
          this.dropWorker();
          void this.startMainLandmarker().catch((e) => console.error('[MediaPipeInput]', e));
        } else {
          reject(new Error(ev.message || 'error del worker'));
        }
      };
      w.onmessage = (ev: MessageEvent<{ t: string; ts?: number; ms?: number; message?: string; landmarks?: NormalizedLandmark[][] }>) => {
        const m = ev.data;
        if (m.t === 'ready') {
          window.clearTimeout(timer);
          link.delegate = (m as { delegate?: string }).delegate ?? 'GPU';
          resolve();
        } else if (m.t === 'result') {
          this.inflight = false;
          this.onResult(m.landmarks ?? [], m.ms ?? 0, m.ts);
        } else if (m.t === 'error') {
          window.clearTimeout(timer);
          if (!this.video) {
            reject(new Error(m.message));
          } else {
            console.warn('[MediaPipeInput] error del worker; se pasa al hilo principal.', m.message);
            this.dropWorker();
            void this.startMainLandmarker().catch((e) => console.error('[MediaPipeInput]', e));
          }
        }
      };
      w.postMessage({
        t: 'init',
        wasmPath: new URL(MEDIAPIPE.wasmPath, window.location.href).toString(),
        modelPath: new URL(MEDIAPIPE.modelPath, window.location.href).toString(),
        numPoses: CLASSIC_CURSOR ? 3 : MEDIAPIPE.numPoses,
        confidence: MEDIAPIPE.minPoseConfidence,
      });
    });
  }

  private dropWorker(): void {
    this.worker?.terminate();
    this.worker = null;
    this.inflight = false;
  }

  stop(): void {
    this.stopped = true;
    cancelAnimationFrame(this.raf);
    const vv = this.video as (HTMLVideoElement & { cancelVideoFrameCallback?: (h: number) => void }) | null;
    if (this.vfc && vv?.cancelVideoFrameCallback) vv.cancelVideoFrameCallback(this.vfc);
    this.vfc = 0;
    window.removeEventListener('keydown', this.onKey);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.dropWorker();
    this.landmarker?.close();
    this.preview?.remove();
    this.stream = null;
    this.landmarker = null;
    this.video = null;
    this.preview = null;
    this.lock = null;
    this.cand = null;
    this.lastRaw = null;
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
      const arm = MEDIAPIPE.armVisibility;
      const raise = visible(el, arm) && visible(wr, arm) ? ((el.y - wr.y) * aspect) / S : Number.NEGATIVE_INFINITY;
      const raiseStrict = visible(el) && visible(wr) ? raise : Number.NEGATIVE_INFINITY;
      const sizeOk = ref
        ? S >= ref * MEDIAPIPE.sizeRange.min && S <= ref * MEDIAPIPE.sizeRange.max
        : S >= MEDIAPIPE.minShoulderWidth;
      out.push({
        lms, S, raise, raiseStrict, sizeOk, role: sizeOk ? 'idle' : 'far',
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
      // Si se dejó de ver al usuario, el radio de búsqueda crece despacio: así quien está detrás no hereda el control en un parpadeo.
      const gap = (now - lock.lastSeen) / 1000;
      const radius = Math.min(MEDIAPIPE.followMaxRadius, MEDIAPIPE.followRadius + gap * MEDIAPIPE.followGrowPerSec);
      for (const p of people) {
        const ratio = p.S / lock.S;
        if (ratio < MEDIAPIPE.followSizeMin || ratio > MEDIAPIPE.followSizeMax) continue; // más pequeño = está detrás
        const dS = Math.abs(ratio - 1);
        const d = Math.hypot(p.ax - lock.ax, p.ay - lock.ay) / lock.S;
        if (d >= radius) continue;
        const score = d + dS; // posición y tamaño: la misma persona
        if (score < bestD) {
          best = p;
          bestD = score;
        }
      }
      if (best) {
        lock.ax = best.ax;
        lock.ay = best.ay;
        lock.S = lock.S * 0.8 + best.S * 0.2;
        lock.lastSeen = now;
        if (lock.sticky || best.raise >= MEDIAPIPE.keepMargin) {
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
      if (now - lock.lastSeen > (lock.sticky ? MEDIAPIPE.stickyLostMs : MEDIAPIPE.lostMs)) this.lock = null;
      return null;
    }

    // Sin usuario activo: el candidato debe sostener la mano levantada acquireMs.
    let cand: Person | null = null;
    for (const p of people) {
      const centered = Math.abs(1 - p.ax - 0.5) <= MEDIAPIPE.acquireHalfWidth;
      if (p.sizeOk && centered && p.raiseStrict >= MEDIAPIPE.raiseMargin && (!cand || p.S > cand.S)) cand = p;
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
      this.lock = { ax: cand.ax, ay: cand.ay, S: cand.S, lastSeen: now, handDownSince: null, sticky: false };
      this.cand = null;
      cand.role = 'locked';
      return cand;
    }
    return null;
  }

  /** Zona muerta en px de pantalla: fija en modo clásico; si no, proporcional a lo que se amplifica el ruido del modelo (más lejos = mayor). */
  private deadzone(): number {
    if (CLASSIC_CURSOR || link.gain <= 0) return MEDIAPIPE.deadzonePx;
    const z = MEDIAPIPE.deadzone;
    return Math.min(z.max, Math.max(z.min, z.perGain * link.gain));
  }

  /** Suaviza el hombro y su ancho (paso bajo): el temblor de este marco de referencia se sumaba al de la mano. */
  private smoothRef(rs: NormalizedLandmark, S: number, now: number): { x: number; y: number; S: number } {
    const r = this.ref;
    if (!r) {
      this.ref = { x: rs.x, y: rs.y, S, t: now };
      return this.ref;
    }
    const dt = Math.max(0.001, (now - r.t) / 1000);
    const a = 1 - Math.exp(-2 * Math.PI * MEDIAPIPE.referenceCutoffHz * dt);
    r.x += (rs.x - r.x) * a;
    r.y += (rs.y - r.y) * a;
    r.S += (S - r.S) * a;
    r.t = now;
    return r;
  }

  /** Alcance máximo creíble de la mano: nunca menor que la esquina más lejana de la zona calibrada (con margen). */
  private armReachLimit(): number {
    const corner = Math.hypot(Math.abs(calibration.offsetX) + calibration.reachWidth / 2, Math.abs(calibration.offsetY) + calibration.reachHeight / 2);
    return Math.max(MEDIAPIPE.maxArmReach, corner * MEDIAPIPE.armReachMargin);
  }

  /** Rango de ancho de hombros aceptado en "Posiciónate": respecto a la calibración, o uno genérico si no hay. */
  private sizeBand(): [number, number] {
    const ref = calibration.shoulderRef;
    const g = MEDIAPIPE.gate;
    return ref ? [ref * g.sizeLow, ref * g.sizeHigh] : [g.fallbackMin, g.fallbackMax];
  }

  /** "Posiciónate": mide a la persona más centrada y, si está en el centro y a la distancia correcta el tiempo pedido, la fija. */
  private runGate(people: Person[], now: number): void {
    if (!gate.active || gate.done) {
      this.gateHold = null;
      return;
    }
    // Quien está frente al muro es la persona MÁS CERCANA a la cámara (la más grande), no la más centrada:
    // alguien que cruza el pasillo por detrás se ve más pequeño y no debe quedar fijado.
    let best: Person | null = null;
    for (const p of people) {
      if (Math.abs(1 - p.ax - 0.5) > MEDIAPIPE.gate.searchHalfWidth) continue;
      if (!best || p.S > best.S) best = p;
    }
    let state: GateState = 'none';
    if (best) {
      const [lo, hi] = this.sizeBand();
      const mx = 1 - best.ax; // imagen espejada: izquierda de la imagen = izquierda de la persona al mirarse
      const lim = MEDIAPIPE.gate.centerHalfWidth;
      state = best.S < lo ? 'closer' : best.S > hi ? 'back' : mx < 0.5 - lim ? 'right' : mx > 0.5 + lim ? 'left' : 'ok';
    }
    gate.state = state;
    if (best && state === 'ok') {
      this.gateHold ??= now;
      gate.progress = Math.min(1, (now - this.gateHold) / MEDIAPIPE.gate.holdMs);
      if (gate.progress >= 1) {
        this.lock = { ax: best.ax, ay: best.ay, S: best.S, lastSeen: now, handDownSince: null, sticky: true };
        this.cand = null;
        gate.done = true;
      }
    } else {
      this.gateHold = null;
      gate.progress = 0;
    }
  }

  /**
   * Procesa cada fotograma EN CUANTO la cámara lo entrega (requestVideoFrameCallback). Antes se revisaba con un temporizador
   * de pantalla (rAF): eso añadía de 0 a 1 refresco de espera y podía perder fotogramas. Sin soporte, cae al método anterior.
   */
  private startFrameLoop(): void {
    const v = this.video as (HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: (now: number, md: { captureTime?: number }) => void) => number;
    }) | null;
    if (!v) return;
    if (typeof v.requestVideoFrameCallback !== 'function') {
      this.loop();
      return;
    }
    const cb = (now: number, md: { captureTime?: number }): void => {
      if (this.stopped || !this.video) return;
      this.vfc = v.requestVideoFrameCallback!(cb);
      this.camFrames++;
      if (now - this.camSince >= 1000) {
        link.camFps = Math.round((this.camFrames * 1000) / (now - this.camSince));
        this.camFrames = 0;
        this.camSince = now;
      }
      const capture = typeof md.captureTime === 'number' ? md.captureTime : undefined;
      if (capture !== undefined) {
        const lat = Math.max(0, performance.now() - capture);
        link.camLatencyMs = link.camLatencyMs === 0 ? lat : link.camLatencyMs * 0.9 + lat * 0.1;
      }
      this.dispatchFrame(capture);
    };
    this.vfc = v.requestVideoFrameCallback(cb);
  }

  /** Envía el fotograma actual al modelo (worker o hilo principal). `capture` = hora real de captura (ms), si el driver la informa. */
  private dispatchFrame(capture?: number): void {
    const v = this.video;
    if (!v || v.readyState < 2) return;
    const ts = capture ?? performance.now();
    if (this.worker) {
      // Un fotograma a la vez: si el worker sigue ocupado se descarta este (así la latencia no crece con una cola).
      if (this.inflight) return;
      this.inflight = true;
      const w = this.worker;
      createImageBitmap(v)
        .then((bitmap) => w.postMessage({ t: 'frame', bitmap, ts }, [bitmap]))
        .catch(() => {
          this.inflight = false;
        });
      return;
    }
    const lm = this.landmarker;
    if (!lm) return;
    const t0 = performance.now();
    const result = lm.detectForVideo(v, Math.max(ts, this.lastFilterT + 1));
    this.onResult(result.landmarks, performance.now() - t0, ts);
  }

  private loop = (): void => {
    if (this.stopped) return;
    this.raf = requestAnimationFrame(this.loop);
    const v = this.video;
    if (!v || v.readyState < 2 || v.currentTime === this.lastVideoTime) return;

    this.lastVideoTime = v.currentTime;
    this.dispatchFrame();
  };

  /** Procesa un resultado del modelo (venga del worker o del hilo principal): selección de usuario, mano, filtro y cursor. */
  private onResult(landmarks: NormalizedLandmark[][], spent: number, sampleTs?: number): void {
    const v = this.video;
    if (this.stopped || !v) return;
    const now = performance.now();
    if (sampleTs !== undefined) link.sampleAgeMs = link.sampleAgeMs === 0 ? now - sampleTs : link.sampleAgeMs * 0.9 + (now - sampleTs) * 0.1;
    link.detectMs = link.detectMs === 0 ? spent : link.detectMs * 0.9 + spent * 0.1;
    this.frames++;
    if (now - this.fpsSince >= 1000) {
      link.detectFps = Math.round((this.frames * 1000) / (now - this.fpsSince));
      this.frames = 0;
      this.fpsSince = now;
    }
    const aspect = v.videoHeight / v.videoWidth;

    if (gate.release !== this.releaseSeen) {
      this.releaseSeen = gate.release;
      this.lock = null;
      this.cand = null;
      this.gateHold = null;
    }
    const people = this.measure(landmarks, aspect);
    this.runGate(people, now);
    const user = this.select(people, now);
    link.people = people.length;
    link.lock = this.lock ? 'locked' : this.cand ? 'candidate' : 'none';

    let hand: { x: number; y: number } | null = null;
    if (user && user.raise >= MEDIAPIPE.keepMargin) {
      const { lms, S } = user;
      const rs = lms[R_SHOULDER] as NormalizedLandmark;
      const h = this.handPoint(lms, aspect);
      // Espejo en X; Y escalada a "unidades de ancho"; ambas en anchos de hombro desde el hombro derecho.
      const ref = this.smoothRef(rs, S, now);
      link.shoulderPx = ref.S * v.videoWidth;
      link.gain = STAGE.width / Math.max(1, link.shoulderPx * calibration.reachWidth);
      const u = (ref.x - h.x) / ref.S;
      const vv = ((h.y - ref.y) * aspect) / ref.S;
      // Con la mano cerca de la cara el modelo a veces salta: un salto imposible entre fotogramas se ignora.
      const last = this.lastRaw;
      const dt = last ? Math.max(0.016, (now - last.t) / 1000) : 1;
      const jump = last ? Math.hypot(u - last.u, vv - last.v) : 0;
      // Un punto demasiado lejos del hombro no puede ser la mano de esta persona: el modelo tomó el brazo de alguien que pasa.
      const farFromBody = Math.hypot(u, vv) > this.armReachLimit();
      const tooFast = last !== null && this.tracked && jump > MEDIAPIPE.maxHandSpeed * dt && this.jumpRejects < MEDIAPIPE.jumpGraceFrames;
      if (farFromBody || tooFast) {
        this.jumpRejects++;
        this.rejectSince ??= now;
        // Se mantiene la última posición un momento; si dura demasiado, se suelta el cursor en vez de dejarlo congelado.
        if (now - this.rejectSince < MEDIAPIPE.jumpDropMs) this.lastSeen = now;
      } else {
        this.jumpRejects = 0;
        this.rejectSince = null;
        this.lastRaw = { u, v: vv, t: now };
        rawHand.u = u;
        rawHand.v = vv;
        rawHand.s = S;
        rawHand.valid = true;
        hand = {
          x: Math.min(1, Math.max(0, (u - calibration.offsetX) / calibration.reachWidth + 0.5)),
          y: Math.min(1, Math.max(0, (vv - calibration.offsetY) / calibration.reachHeight + 0.5)),
        };
      }
    } else {
      rawHand.valid = false;
      this.lastRaw = null;
      this.rejectSince = null;
      this.ref = null;
    }

    if (hand) {
      this.lastSeen = now;
      if (!this.tracked) {
        this.fx.reset();
        this.fy.reset();
      }
      // El filtro usa la hora real de captura del fotograma (regular) y no la de llegada del resultado (irregular): su derivada es menos ruidosa.
      const tf = sampleTs !== undefined ? Math.max(sampleTs, this.lastFilterT + 1) : Math.max(now, this.lastFilterT + 1);
      this.lastFilterT = tf;
      const fx = this.fx.filter(hand.x, tf);
      const fy = this.fy.filter(hand.y, tf);
      if (!this.tracked) {
        this.outX = fx;
        this.outY = fy;
      } else {
        // Zona muerta suave: el cursor solo se mueve la parte del desplazamiento que supera el radio (sin retraso en movimientos reales).
        const dx = (fx - this.outX) * STAGE.width;
        const dy = (fy - this.outY) * STAGE.height;
        const d = Math.hypot(dx, dy);
        const dz = this.deadzone();
        if (d > dz) {
          const k = (d - dz) / d;
          this.outX += (dx * k) / STAGE.width;
          this.outY += (dy * k) / STAGE.height;
        }
      }
      this.lastX = this.outX;
      this.lastY = this.outY;
      this.tracked = true;
    } else if (this.tracked && now - this.lastSeen > MEDIAPIPE.lostGraceMs) {
      this.tracked = false;
    }
    pushSample({ x: this.lastX, y: this.lastY, tracked: this.tracked });

    // Medidor (?debug=1): temblor visible con la mano casi quieta, en px de pantalla.
    if (this.tracked) {
      this.recent.push({ x: this.lastX * STAGE.width, y: this.lastY * STAGE.height });
      if (this.recent.length > 24) this.recent.shift();
      if (this.recent.length >= 12) {
        const n = this.recent.length;
        const mx = this.recent.reduce((a, q) => a + q.x, 0) / n;
        const my = this.recent.reduce((a, q) => a + q.y, 0) / n;
        const spread = Math.max(...this.recent.map((q) => Math.hypot(q.x - mx, q.y - my)));
        if (spread < 90) {
          const sd = Math.sqrt(this.recent.reduce((a, q) => a + (q.x - mx) ** 2 + (q.y - my) ** 2, 0) / n);
          link.jitterPx = link.jitterPx === 0 ? sd : link.jitterPx * 0.8 + sd * 0.2;
        }
      }
    } else {
      this.recent = [];
    }

    const surface = gate.canvas ?? this.preview;
    if (surface) this.drawPreview(surface, v, people, user);
  }

  /**
   * Punto de la mano: la muñeca prolongada hacia adelante por el antebrazo (estable: el modelo ve bien codo y muñeca incluso con
   * la mano frente a la cara). La punta del índice solo se mezcla cuando es fiable y coherente con el antebrazo; si no, se ignora
   * (antes se alternaba entre punta y muñeca y el cursor saltaba).
   */
  private handPoint(lms: NormalizedLandmark[], aspect: number): { x: number; y: number } {
    const wr = lms[R_WRIST] as NormalizedLandmark;
    const el = lms[R_ELBOW];
    if (!visible(el, MEDIAPIPE.armVisibility)) return { x: wr.x, y: wr.y };
    const k = MEDIAPIPE.handExtend;
    const ext = { x: wr.x + (wr.x - el.x) * k, y: wr.y + (wr.y - el.y) * k };
    const tip = lms[R_INDEX];
    if (tip && (tip.visibility ?? 1) > MEDIAPIPE.tipVisibility - 0.1) {
      // Mezcla CONTINUA (antes era un interruptor visible/no visible y el cursor saltaba al conmutar).
      const fore = Math.hypot(wr.x - el.x, (wr.y - el.y) * aspect);
      const off = Math.hypot(tip.x - ext.x, (tip.y - ext.y) * aspect);
      const coherent = Math.min(1, Math.max(0, 1 - (off / Math.max(fore, 1e-6) - 0.5) / 0.5));
      const vis = Math.min(1, Math.max(0, ((tip.visibility ?? 1) - (MEDIAPIPE.tipVisibility - 0.1)) / 0.3));
      const w = 0.5 * coherent * vis;
      return { x: ext.x * (1 - w) + tip.x * w, y: ext.y * (1 - w) + tip.y * w };
    }
    return ext;
  }

  private drawPreview(c: HTMLCanvasElement, v: HTMLVideoElement, people: Person[], user: Person | null): void {
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.save();
    if (this.mirror) ctx.scale(-1, 1); // espejo (solo si se pide)
    ctx.drawImage(v, this.mirror ? -c.width : 0, 0, c.width, c.height);
    ctx.restore();
    // Las posiciones de abajo están en "espacio espejado" (como usa el seguimiento); con la imagen normal se vuelven a voltear al dibujar.
    const dx = (mx: number): number => (this.mirror ? mx : 1 - mx);
    const aspect = v.videoHeight / v.videoWidth;

    if (gate.canvas === c) {
      // "Posiciónate": franja central objetivo y los hombros de lo que se detecta.
      const lim = MEDIAPIPE.gate.centerHalfWidth;
      const ok = gate.state === 'ok';
      ctx.fillStyle = ok ? 'rgba(80,220,120,0.16)' : 'rgba(255,255,255,0.10)';
      ctx.fillRect((0.5 - lim) * c.width, 0, 2 * lim * c.width, c.height);
      ctx.strokeStyle = ok ? '#4ade80' : '#ffffff';
      ctx.lineWidth = 4;
      ctx.setLineDash([16, 12]);
      ctx.strokeRect((0.5 - lim) * c.width, 4, 2 * lim * c.width, c.height - 8);
      ctx.setLineDash([]);
      for (const p of people) {
        const rs = p.lms[R_SHOULDER] as NormalizedLandmark;
        const ls = p.lms[L_SHOULDER] as NormalizedLandmark;
        ctx.strokeStyle = ok ? '#4ade80' : '#ff9a3c';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(dx(1 - rs.x) * c.width, rs.y * c.height);
        ctx.lineTo(dx(1 - ls.x) * c.width, ls.y * c.height);
        ctx.stroke();
      }
      return;
    }

    // Todas las personas: verde = usuario activo, amarillo = candidato, rojo = fuera de rango, gris = quieta.
    const colors: Record<Person['role'], string> = { locked: '#3f3', candidate: '#ff0', far: '#f44', idle: '#aaa' };
    for (const p of people) {
      const rs = p.lms[R_SHOULDER] as NormalizedLandmark;
      const ls = p.lms[L_SHOULDER] as NormalizedLandmark;
      ctx.strokeStyle = colors[p.role];
      ctx.lineWidth = p.role === 'locked' ? 5 : 3;
      ctx.beginPath();
      ctx.moveTo(dx(1 - rs.x) * c.width, rs.y * c.height);
      ctx.lineTo(dx(1 - ls.x) * c.width, ls.y * c.height);
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
    ctx.strokeRect((dx(cx) - bw / 2) * c.width, (cy - bh / 2) * c.height, bw * c.width, bh * c.height);
    const tip = user.lms[R_INDEX];
    const h = visible(tip) ? tip : (user.lms[R_WRIST] as NormalizedLandmark);
    ctx.fillStyle = this.tracked ? '#3f3' : '#f44';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(dx(1 - h.x) * c.width, h.y * c.height, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}
