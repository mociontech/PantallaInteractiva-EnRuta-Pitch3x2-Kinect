import type WebSocket from 'ws';
import type {
  AdminState, QueueInfo, ServerToWall, SessionSummary, WallStatus, WallToServer,
} from '../../shared/protocol';
import { attendees } from './attendees';
import { config } from './config';
import { all, now, one, run, type Participant, type QueueRow, type SessionRow } from './db';
import { deliveryOfSession, enqueueSession, outbox } from './delivery';

/**
 * Gestor de turnos: una sola pared, cola de personas registradas en la tablet.
 *
 *   tablet registra -> cola (waiting) -> la pared queda libre -> assign (active) -> la persona empieza (playing)
 *   -> termina o abandona (session-end) -> puntaje a la base y a Evius -> la pared vuelve a IDLE -> siguiente.
 */
let wallSocket: WebSocket | null = null;
let wallStatus: WallStatus = 'offline';
let activeQueueId: number | null = null;
let turnTimer: NodeJS.Timeout | null = null;

function sendToWall(msg: ServerToWall): void {
  if (wallSocket && wallSocket.readyState === 1) wallSocket.send(JSON.stringify(msg));
}

function clearTurnTimer(): void {
  if (turnTimer) clearTimeout(turnTimer);
  turnTimer = null;
}

function participantOf(queueId: number): Participant | undefined {
  return one<Participant>(
    'SELECT p.* FROM participants p JOIN queue q ON q.participant_id = p.id WHERE q.id = ?',
    queueId,
  );
}

function positionOf(row: QueueRow): number {
  if (row.status !== 'waiting') return 0;
  const ahead = one<{ n: number }>("SELECT COUNT(*) AS n FROM queue WHERE status = 'waiting' AND id < ?", row.id)?.n ?? 0;
  const busy = activeQueueId !== null ? 1 : 0;
  return ahead + busy;
}

// ───────── turnos ─────────

function assign(row: QueueRow): void {
  const p = participantOf(row.id);
  if (!p) return;
  sendToWall({ t: 'assign', participant: { id: p.id, nombre: p.nombre }, queueId: row.id });
}

function dispatch(): void {
  if (wallStatus !== 'idle' || !wallSocket) return;
  const next = one<QueueRow>("SELECT * FROM queue WHERE status = 'waiting' ORDER BY id LIMIT 1");
  if (!next) return;
  run("UPDATE queue SET status = 'active', activated_at = ? WHERE id = ?", now(), next.id);
  activeQueueId = next.id;
  wallStatus = 'assigned';
  assign({ ...next, status: 'active' });
  const id = next.id;
  clearTurnTimer();
  turnTimer = setTimeout(() => {
    if (wallStatus === 'assigned' && activeQueueId === id) {
      console.log(`[turno] ${id} venció sin empezar; se pasa a la siguiente persona`);
      run("UPDATE queue SET status = 'expired', finished_at = ? WHERE id = ?", now(), id);
      activeQueueId = null;
      wallStatus = 'idle';
      sendToWall({ t: 'cancel', reason: 'timeout' });
      dispatch();
    }
  }, config.turnTimeoutMs);
}

export function register(participantId: number): { queueId: number; position: number } | { error: 'already_played' } {
  if (config.replayPolicy === 'block' && one('SELECT id FROM sessions WHERE participant_id = ? LIMIT 1', participantId)) {
    return { error: 'already_played' };
  }
  const existing = one<QueueRow>(
    "SELECT * FROM queue WHERE participant_id = ? AND status IN ('waiting','active','playing') ORDER BY id DESC LIMIT 1",
    participantId,
  );
  if (existing) return { queueId: existing.id, position: positionOf(existing) };
  const id = run("INSERT INTO queue (participant_id, status, created_at) VALUES (?, 'waiting', ?)", participantId, now());
  dispatch();
  const row = one<QueueRow>('SELECT * FROM queue WHERE id = ?', id);
  return { queueId: id, position: row ? positionOf(row) : 1 };
}

export function queueInfo(queueId: number): QueueInfo | null {
  const row = one<QueueRow>('SELECT * FROM queue WHERE id = ?', queueId);
  if (!row) return null;
  return { status: row.status, position: positionOf(row), wall: wallStatus };
}

// ───────── pared (WebSocket) ─────────

export function attachWall(ws: WebSocket): void {
  if (wallSocket && wallSocket !== ws) wallSocket.close();
  wallSocket = ws;
  wallStatus = 'idle';
  // Si la pared se recargó a mitad de una sesión, esa sesión se da por perdida.
  const active = activeQueueId !== null ? one<QueueRow>('SELECT * FROM queue WHERE id = ?', activeQueueId) : undefined;
  if (active?.status === 'playing') {
    run("UPDATE queue SET status = 'expired', finished_at = ? WHERE id = ?", now(), active.id);
    activeQueueId = null;
  } else if (active?.status === 'active') {
    wallStatus = 'assigned';
    assign(active);
    return;
  }
  dispatch();
}

export function detachWall(ws: WebSocket): void {
  if (ws !== wallSocket) return;
  wallSocket = null;
  wallStatus = 'offline';
  clearTurnTimer();
  // Quien estaba asignado sin empezar vuelve al principio de la cola.
  if (activeQueueId !== null) {
    run("UPDATE queue SET status = 'waiting' WHERE id = ? AND status = 'active'", activeQueueId);
    activeQueueId = null;
  }
}

function onSessionEnd(summary: SessionSummary): void {
  if (wallStatus !== 'playing' || activeQueueId === null) {
    console.warn('[pared] session-end sin turno activo; se ignora');
    wallStatus = 'finishing';
    return;
  }
  const queueId = activeQueueId;
  const p = participantOf(queueId);
  activeQueueId = null;
  wallStatus = 'finishing';
  clearTurnTimer();
  run("UPDATE queue SET status = 'done', finished_at = ? WHERE id = ?", now(), queueId);
  if (!p) return;
  const endedAt = now();
  const sessionId = run(
    `INSERT INTO sessions (participant_id, local_id, started_at, ended_at, completed, last_step, score, game_score,
       areas, solutions, duration_ms, device_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    p.id, summary.localId, summary.startedAt ? new Date(summary.startedAt).toISOString() : null, endedAt,
    summary.completed ? 1 : 0, summary.lastStep, summary.score, summary.gameScore,
    JSON.stringify(summary.areas), JSON.stringify(summary.solutionsViewed), summary.durationMs, config.deviceId,
  );
  // Primero se persiste en el outbox (disco) y recién entonces se intenta enviar a Evius.
  enqueueSession(
    { cedula: p.cedula, nombre: p.nombre, cargo: p.cargo },
    {
      sessionId,
      score: summary.score,
      completed: summary.completed,
      lastStep: summary.lastStep,
      gameScore: summary.gameScore,
      areas: summary.areas,
      solutionsViewed: summary.solutionsViewed,
      durationMs: summary.durationMs,
      startedAt: summary.startedAt ? new Date(summary.startedAt).toISOString() : null,
      endedAt,
      deviceId: config.deviceId,
    },
  );
  console.log(`[sesión] ${p.nombre} · ${summary.score} pts · ${summary.completed ? 'completa' : 'abandonó'}`);
}

export function onWallMessage(msg: WallToServer): void {
  switch (msg.t) {
    case 'hello':
      return;
    case 'session-start': {
      if (wallStatus !== 'assigned') return;
      wallStatus = 'playing';
      clearTurnTimer();
      if (activeQueueId !== null) run("UPDATE queue SET status = 'playing' WHERE id = ?", activeQueueId);
      return;
    }
    case 'session-end':
      onSessionEnd(msg.summary);
      return;
    case 'wall-idle': {
      const active = activeQueueId !== null ? one<QueueRow>('SELECT * FROM queue WHERE id = ?', activeQueueId) : undefined;
      if (active?.status === 'active') {
        // Sigue asignado y todavía no empezó: se reenvía el saludo.
        wallStatus = 'assigned';
        assign(active);
        return;
      }
      if (active?.status === 'playing') {
        run("UPDATE queue SET status = 'expired', finished_at = ? WHERE id = ?", now(), active.id);
        activeQueueId = null;
      }
      wallStatus = 'idle';
      dispatch();
    }
  }
}

// ───────── operador ─────────

/** Saca de la pared a quien esté asignado o jugando. */
export function skipCurrent(): boolean {
  if (activeQueueId === null) return false;
  const id = activeQueueId;
  const playing = wallStatus === 'playing';
  clearTurnTimer();
  run("UPDATE queue SET status = 'skipped', finished_at = ? WHERE id = ?", now(), id);
  if (!playing) {
    activeQueueId = null;
    wallStatus = 'idle';
  }
  // Si estaba jugando, la pared volverá sola a IDLE y enviará session-end (queda registrado como abandono).
  sendToWall({ t: 'cancel', reason: 'skipped' });
  if (!playing) dispatch();
  return true;
}

export function clearQueue(): number {
  const n = one<{ n: number }>("SELECT COUNT(*) AS n FROM queue WHERE status = 'waiting'")?.n ?? 0;
  run("UPDATE queue SET status = 'skipped', finished_at = ? WHERE status = 'waiting'", now());
  return n;
}

export function adminState(): AdminState {
  const active = activeQueueId !== null ? participantOf(activeQueueId) : undefined;
  const waiting = all<{ queueId: number; nombre: string; cedula: string; since: string }>(
    `SELECT q.id AS queueId, p.nombre AS nombre, p.cedula AS cedula, q.created_at AS since
       FROM queue q JOIN participants p ON p.id = q.participant_id WHERE q.status = 'waiting' ORDER BY q.id`,
  );
  const recent = all<{ sessionId: number; nombre: string; cedula: string; score: number; completed: number; endedAt: string }>(
    `SELECT s.id AS sessionId, p.nombre AS nombre, p.cedula AS cedula, s.score AS score, s.completed AS completed,
            s.ended_at AS endedAt
       FROM sessions s JOIN participants p ON p.id = s.participant_id
      ORDER BY s.id DESC LIMIT 25`,
  );
  return {
    wall: wallStatus,
    active: active && activeQueueId !== null ? { queueId: activeQueueId, nombre: active.nombre, cedula: active.cedula } : null,
    waiting,
    recent: recent.map((r) => {
      const d = deliveryOfSession(r.sessionId);
      return { ...r, completed: r.completed === 1, evius: d.status, attempts: d.attempts, lastError: d.lastError };
    }),
    attendees: {
      total: attendees.info.total, source: attendees.info.source, loadedAt: attendees.info.loadedAt, error: attendees.info.error,
    },
    evius: { mode: config.evius.mode, pending: outbox.stats().pending },
    replayPolicy: config.replayPolicy,
  };
}

/** Todas las sesiones, para exportar (respaldo en CSV). */
export function exportRows(): Array<Record<string, string | number>> {
  const rows = all<SessionRow & { cedula: string; nombre: string; cargo: string; origen: string }>(
    `SELECT s.*, p.cedula, p.nombre, p.cargo, p.origen
       FROM sessions s JOIN participants p ON p.id = s.participant_id ORDER BY s.id`,
  );
  return rows.map((r) => ({
    sesion: r.id, cedula: r.cedula, nombre: r.nombre, cargo: r.cargo, origen: r.origen,
    inicio: r.started_at ?? '', fin: r.ended_at, completo: r.completed ? 'si' : 'no',
    ultimo_paso: r.last_step, puntaje: r.score, puntos_juego: r.game_score,
    areas: r.areas, soluciones: r.solutions, duracion_ms: r.duration_ms, pared: r.device_id,
  }));
}

export function recoverOnBoot(): void {
  // Tras un reinicio nadie está jugando: quien estaba asignado vuelve a la cola, quien jugaba se da por perdido.
  run("UPDATE queue SET status = 'waiting' WHERE status = 'active'");
  run("UPDATE queue SET status = 'expired', finished_at = ? WHERE status = 'playing'", now());
}
