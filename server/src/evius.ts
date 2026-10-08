import { config } from './config';
import { all, db, now, one, run, type OutboxRow } from './db';

/**
 * Envío del puntaje a Evius, con cola (outbox) y reintentos: la experiencia nunca espera a Evius
 * y, si no hay internet, los puntajes se guardan y se envían cuando vuelva.
 *
 * [CONFIRMAR] El formato real (URL, autenticación, campos) depende de la API de Evius. Todo lo que
 * cambie se ajusta aquí y en las variables EVIUS_* de .env.
 */
export interface EviusPayload {
  experience: string;
  deviceId: string;
  cedula: string;
  nombre: string;
  correo: string;
  score: number;
  completed: boolean;
  lastStep: number;
  gameScore: number;
  areas: string[];
  solutionsViewed: string[];
  durationMs: number;
  startedAt: string | null;
  endedAt: string;
  sessionId: number;
}

async function post(payload: EviusPayload): Promise<{ ok: boolean; error?: string }> {
  const { mode, url, token, authHeader } = config.evius;
  if (mode === 'mock') {
    console.log('[evius:mock]', JSON.stringify(payload));
    return { ok: true };
  }
  if (mode === 'off') return { ok: false, error: 'Evius sin configurar (EVIUS_URL)' };
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers[authHeader] = authHeader.toLowerCase() === 'authorization' ? `Bearer ${token}` : token;
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function enqueueForEvius(sessionId: number, payload: EviusPayload): void {
  run(
    'INSERT INTO outbox (session_id, payload, status, created_at) VALUES (?, ?, ?, ?)',
    sessionId, JSON.stringify(payload), 'pending', now(),
  );
  void processOutbox();
}

let running = false;

/** Intenta enviar lo pendiente. Backoff creciente por intento (máx. 5 min). */
export async function processOutbox(): Promise<void> {
  if (running || config.evius.mode === 'off') return;
  running = true;
  try {
    const due = all<OutboxRow>(
      "SELECT * FROM outbox WHERE status = 'pending' AND next_try_at <= ? ORDER BY id LIMIT 10",
      Date.now(),
    );
    for (const item of due) {
      const result = await post(JSON.parse(item.payload) as EviusPayload);
      if (result.ok) {
        db.prepare("UPDATE outbox SET status = 'sent', sent_at = ?, last_error = NULL WHERE id = ?").run(now(), item.id);
      } else {
        const attempts = item.attempts + 1;
        const backoff = Math.min(300_000, config.evius.retryMs * 2 ** Math.min(attempts, 5));
        db.prepare('UPDATE outbox SET attempts = ?, last_error = ?, next_try_at = ? WHERE id = ?')
          .run(attempts, result.error ?? 'error', Date.now() + backoff, item.id);
        console.warn(`[evius] envío ${item.id} falló (intento ${attempts}): ${result.error}`);
      }
    }
  } finally {
    running = false;
  }
}

/** El operador fuerza el reintento inmediato de todo lo pendiente. */
export function retryOutboxNow(): void {
  db.prepare("UPDATE outbox SET next_try_at = 0 WHERE status = 'pending'").run();
  void processOutbox();
}

export function pendingCount(): number {
  return one<{ n: number }>("SELECT COUNT(*) AS n FROM outbox WHERE status = 'pending'")?.n ?? 0;
}

export function startOutboxLoop(): void {
  setInterval(() => void processOutbox(), config.evius.retryMs).unref();
  void processOutbox();
}
