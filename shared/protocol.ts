/**
 * Contrato entre el servidor local, la pared (/), la tablet de registro (/registro) y el operador (/admin).
 * Lo importan ambos lados: cualquier cambio se verifica con `npm run typecheck`.
 */

export type WallStatus = 'offline' | 'idle' | 'assigned' | 'playing' | 'finishing';
export type QueueStatus = 'waiting' | 'active' | 'playing' | 'done' | 'expired' | 'skipped';

// ───────── WebSocket (pared <-> servidor) ─────────

export interface AssignedParticipant {
  id: number;
  nombre: string;
}

export type ServerToWall =
  | { t: 'assign'; participant: AssignedParticipant; queueId: number }
  /** Se cancela el turno actual (el operador saltó a la persona o venció el tiempo): la pared vuelve a IDLE. */
  | { t: 'cancel'; reason: 'skipped' | 'timeout' };

export interface SessionSummary {
  localId: string | null;
  completed: boolean;
  /** 0 = inicio, 1..5 estaciones, 6 = resultado. */
  lastStep: number;
  score: number;
  gameScore: number;
  areas: string[];
  solutionsViewed: string[];
  durationMs: number;
  startedAt: number | null;
}

export type WallToServer =
  | { t: 'hello' }
  /** La pared volvió a IDLE (lista para recibir a la siguiente persona). */
  | { t: 'wall-idle' }
  | { t: 'session-start'; localId: string | null }
  | { t: 'session-end'; summary: SessionSummary };

// ───────── HTTP (tablet y operador) ─────────

export type RegisterError =
  | 'invalid_cedula'
  | 'invalid_name'
  | 'invalid_email'
  | 'consent_required'
  | 'already_played'
  /** La cédula no está en el CSV de asistentes y ALLOW_UNLISTED=false. */
  | 'not_found'
  | 'server_error';

export type RegisterResponse =
  | { ok: true; status: 'queued'; queueId: number; nombre: string; position: number }
  /** La cédula no está en la base: la tablet pide nombre y autorización (el correo es opcional). */
  | { ok: true; status: 'new' }
  | { ok: false; error: RegisterError };

export interface QueueInfo {
  status: QueueStatus;
  /** Personas por delante (incluye a quien está jugando ahora). 0 = es su turno o ya terminó. */
  position: number;
  wall: WallStatus;
}

export interface AdminState {
  wall: WallStatus;
  active: { queueId: number; nombre: string; cedula: string } | null;
  waiting: Array<{ queueId: number; nombre: string; cedula: string; since: string }>;
  recent: Array<{
    sessionId: number;
    nombre: string;
    cedula: string;
    score: number;
    completed: boolean;
    endedAt: string;
    evius: 'pending' | 'sent';
    attempts: number;
    lastError: string | null;
  }>;
  attendees: { total: number; source: string; loadedAt: string | null; error: string | null };
  evius: { mode: 'http' | 'mock' | 'off'; pending: number };
  replayPolicy: 'allow' | 'block';
}
