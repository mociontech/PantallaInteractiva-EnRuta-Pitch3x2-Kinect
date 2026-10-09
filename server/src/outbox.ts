import { randomUUID } from 'node:crypto';
import { existsSync, fsyncSync, mkdirSync, openSync, readFileSync, writeSync } from 'node:fs';
import path from 'node:path';

/**
 * Outbox genérico con persistencia en disco y reintento infinito.
 *
 *  - El registro se escribe en un archivo JSONL (append-only, con fsync) ANTES de intentar cualquier envío.
 *    Si el proceso muere o no hay internet, al reiniciar se reconstruye el estado leyendo el archivo.
 *  - Cada registro (job) tiene una `idempotencyKey` y uno o más destinos. Cada destino se entrega por separado
 *    y lleva su propio contador de intentos.
 *  - Reintento con backoff exponencial (2 s, 4 s, 8 s… tope 5 min) y un poll cada 3 s. Nunca se rinde.
 *  - El archivo NO se compacta ni se borra: es también el respaldo/historial de lo jugado.
 *
 * Genérico: recibe un diccionario de "deliverers" por destino; no sabe nada de Evius.
 */

export interface DeliveryState {
  status: 'pending' | 'done';
  attempts: number;
  /** Epoch ms del próximo intento. */
  nextTryAt: number;
  lastError: string | null;
  doneAt: string | null;
}

export interface Job<P, D extends string> {
  id: string;
  idempotencyKey: string;
  createdAt: string;
  /** Datos sueltos para consultar el estado (p. ej. el id de la sesión). */
  meta: Record<string, string | number | boolean | null>;
  payload: P;
  deliveries: Record<D, DeliveryState>;
}

export interface DeliveryContext<P, D extends string> {
  idempotencyKey: string;
  job: Job<P, D>;
  attempt: number;
}

export interface OutboxOptions<P, D extends string> {
  path: string;
  /** Una función por destino. Debe lanzar un error si la entrega falla. */
  deliverers: Record<D, (payload: P, ctx: DeliveryContext<P, D>) => Promise<void>>;
  /** Destinos que deben estar entregados (dentro del mismo job) antes de intentar este. */
  after?: Partial<Record<D, D[]>>;
  /** false: solo persiste, sin intentar entregar (p. ej. Evius sin configurar). */
  enabled?: () => boolean;
  pollMs?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  log?: (message: string) => void;
}

type Line<P, D extends string> =
  | { t: 'job'; id: string; idempotencyKey: string; createdAt: string; meta: Job<P, D>['meta']; payload: P; destinations: D[] }
  | { t: 'attempt'; id: string; dest: D; attempts: number; nextTryAt: number; error: string; at: string }
  | { t: 'done'; id: string; dest: D; at: string };

export class Outbox<P, D extends string> {
  private readonly jobs = new Map<string, Job<P, D>>();
  private readonly byKey = new Map<string, string>();
  private readonly fd: number;
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly o: Required<Omit<OutboxOptions<P, D>, 'after'>> & Pick<OutboxOptions<P, D>, 'after'>;

  constructor(options: OutboxOptions<P, D>) {
    this.o = {
      enabled: () => true,
      pollMs: 3000,
      baseBackoffMs: 2000,
      maxBackoffMs: 300_000,
      log: (m) => console.log(m),
      ...options,
    };
    mkdirSync(path.dirname(this.o.path), { recursive: true });
    this.replay();
    this.fd = openSync(this.o.path, 'a');
  }

  // ───────── persistencia ─────────

  /** Reconstruye el estado leyendo el JSONL. Una última línea cortada (apagón a mitad de escritura) se ignora. */
  private replay(): void {
    if (!existsSync(this.o.path)) return;
    let skipped = 0;
    for (const raw of readFileSync(this.o.path, 'utf8').split('\n')) {
      if (!raw.trim()) continue;
      let line: Line<P, D>;
      try {
        line = JSON.parse(raw) as Line<P, D>;
      } catch {
        skipped++;
        continue;
      }
      if (line.t === 'job') {
        const deliveries = {} as Record<D, DeliveryState>;
        for (const d of line.destinations) deliveries[d] = { status: 'pending', attempts: 0, nextTryAt: 0, lastError: null, doneAt: null };
        this.jobs.set(line.id, { id: line.id, idempotencyKey: line.idempotencyKey, createdAt: line.createdAt, meta: line.meta, payload: line.payload, deliveries });
        this.byKey.set(line.idempotencyKey, line.id);
      } else {
        const state = this.jobs.get(line.id)?.deliveries[line.dest];
        if (!state) continue;
        if (line.t === 'attempt') {
          state.attempts = line.attempts;
          state.nextTryAt = line.nextTryAt;
          state.lastError = line.error;
        } else {
          state.status = 'done';
          state.doneAt = line.at;
          state.lastError = null;
        }
      }
    }
    if (skipped) this.o.log(`[outbox] ${skipped} línea(s) ilegible(s) ignoradas en ${this.o.path}`);
    const s = this.stats();
    this.o.log(`[outbox] ${this.jobs.size} registros en ${this.o.path} (${s.pending} entregas pendientes)`);
  }

  /** Escribe una línea y la fuerza a disco antes de continuar. */
  private append(line: Line<P, D>): void {
    writeSync(this.fd, `${JSON.stringify(line)}\n`);
    fsyncSync(this.fd);
  }

  // ───────── API ─────────

  /**
   * Persiste el registro y recién entonces intenta entregarlo. Idempotente: si ya existe un registro con la misma
   * `idempotencyKey` devuelve ese y no escribe otro.
   */
  enqueue(input: { idempotencyKey: string; payload: P; destinations: D[]; meta?: Job<P, D>['meta'] }): Job<P, D> {
    const existingId = this.byKey.get(input.idempotencyKey);
    const existing = existingId ? this.jobs.get(existingId) : undefined;
    if (existing) return existing;

    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const meta = input.meta ?? {};
    this.append({ t: 'job', id, idempotencyKey: input.idempotencyKey, createdAt, meta, payload: input.payload, destinations: input.destinations });
    const deliveries = {} as Record<D, DeliveryState>;
    for (const d of input.destinations) deliveries[d] = { status: 'pending', attempts: 0, nextTryAt: 0, lastError: null, doneAt: null };
    const job: Job<P, D> = { id, idempotencyKey: input.idempotencyKey, createdAt, meta, payload: input.payload, deliveries };
    this.jobs.set(id, job);
    this.byKey.set(input.idempotencyKey, id);
    void this.tick();
    return job;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), this.o.pollMs);
    this.timer.unref();
    void this.tick();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Fuerza el reintento inmediato de todo lo pendiente (el backoff se salta). */
  retryNow(): void {
    for (const job of this.jobs.values()) {
      for (const d of Object.keys(job.deliveries) as D[]) {
        if (job.deliveries[d].status === 'pending') job.deliveries[d].nextTryAt = 0;
      }
    }
    void this.tick();
  }

  stats(): { jobs: number; pending: number; done: number } {
    let pending = 0;
    let done = 0;
    for (const job of this.jobs.values()) {
      for (const state of Object.values<DeliveryState>(job.deliveries)) state.status === 'pending' ? pending++ : done++;
    }
    return { jobs: this.jobs.size, pending, done };
  }

  list(): Array<Job<P, D>> {
    return [...this.jobs.values()];
  }

  // ───────── entrega ─────────

  /** Un ciclo: intenta cada entrega pendiente que ya toca y cuyas dependencias estén cumplidas. */
  async tick(): Promise<void> {
    if (this.running || !this.o.enabled()) return;
    this.running = true;
    try {
      const now = Date.now();
      for (const job of this.jobs.values()) {
        for (const dest of Object.keys(job.deliveries) as D[]) {
          const state = job.deliveries[dest];
          if (state.status !== 'pending' || state.nextTryAt > now) continue;
          const deps = this.o.after?.[dest] ?? [];
          if (deps.some((d) => job.deliveries[d] && job.deliveries[d].status !== 'done')) continue;
          await this.deliver(job, dest, state);
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async deliver(job: Job<P, D>, dest: D, state: DeliveryState): Promise<void> {
    const attempt = state.attempts + 1;
    try {
      await this.o.deliverers[dest](job.payload, { idempotencyKey: job.idempotencyKey, job, attempt });
      const at = new Date().toISOString();
      state.status = 'done';
      state.doneAt = at;
      state.lastError = null;
      this.append({ t: 'done', id: job.id, dest, at });
    } catch (err) {
      const message = (err instanceof Error ? err.message : String(err)).slice(0, 300);
      const backoff = Math.min(this.o.maxBackoffMs, this.o.baseBackoffMs * 2 ** Math.min(attempt - 1, 20));
      state.attempts = attempt;
      state.nextTryAt = Date.now() + backoff;
      state.lastError = message;
      this.append({ t: 'attempt', id: job.id, dest, attempts: attempt, nextTryAt: state.nextTryAt, error: message, at: new Date().toISOString() });
      this.o.log(`[outbox] ${dest} falló (intento ${attempt}, reintenta en ${Math.round(backoff / 1000)} s): ${message}`);
    }
  }
}
