import { config } from './config';

/**
 * Gateway hacia Evius (Datahub). Solo sabe hablar HTTP con Evius; la cola y los reintentos viven en outbox.ts.
 * Las funciones LANZAN un error si la entrega no se pudo confirmar, para que el outbox reintente.
 *
 * [CONFIRMAR] Los nombres de los campos del cuerpo (eventId, cedula, name, cargo, score…) y las rutas son los del patrón
 * de Mirage descrito para este proyecto; si Evius usa otros, se ajustan SOLO en este archivo.
 */

export interface EviusAttendee {
  cedula: string;
  nombre: string;
  cargo: string;
}

export interface EviusResult {
  sessionId: number;
  score: number;
  completed: boolean;
  lastStep: number;
  gameScore: number;
  areas: string[];
  solutionsViewed: string[];
  durationMs: number;
  startedAt: string | null;
  endedAt: string;
  deviceId: string;
}

interface HttpResult {
  status: number;
  text: string;
}

async function post(route: string, body: unknown, idempotencyKey: string): Promise<HttpResult> {
  const { url, token } = config.evius;
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${url.replace(/\/$/, '')}${route}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  return { status: res.status, text: await res.text() };
}

const ok = (r: HttpResult): boolean => r.status >= 200 && r.status < 300;

function fail(route: string, r: HttpResult): Error {
  return new Error(`POST ${route} -> HTTP ${r.status}: ${r.text.slice(0, 160).replace(/\s+/g, ' ')}`);
}

/** Registra a la persona en el evento. Evius la deduplica por cédula + eventId (un 409 = ya estaba registrada = éxito). */
export async function deliverAttendeeToEvius(a: EviusAttendee): Promise<void> {
  const { mode, eventId, experienceName } = config.evius;
  if (mode === 'mock') {
    console.log('[evius:mock] attendee', JSON.stringify(a));
    return;
  }
  const route = '/attendees';
  const r = await post(
    route,
    { eventId, cedula: a.cedula, name: a.nombre, cargo: a.cargo, source: experienceName },
    `att:${eventId}:${a.cedula}`,
  );
  if (ok(r) || r.status === 409) return;
  throw fail(route, r);
}

/**
 * Guarda el puntaje. Si el evento no tiene el endpoint /experiences (404/405/501), cae a /activities con el puntaje
 * embebido como JSON en `longDescription`.
 */
export async function deliverExperienceToEvius(a: EviusAttendee, result: EviusResult, idempotencyKey: string): Promise<void> {
  const { mode, eventId, experienceId, experienceName } = config.evius;
  if (mode === 'mock') {
    console.log('[evius:mock] experience', JSON.stringify({ cedula: a.cedula, ...result }));
    return;
  }
  const details = {
    score: result.score,
    completed: result.completed,
    lastStep: result.lastStep,
    gameScore: result.gameScore,
    areas: result.areas,
    solutionsViewed: result.solutionsViewed,
    durationMs: result.durationMs,
    startedAt: result.startedAt,
    endedAt: result.endedAt,
    deviceId: result.deviceId,
    sessionId: result.sessionId,
  };
  const route = '/experiences';
  const r = await post(
    route,
    { eventId, experienceId, experienceName, cedula: a.cedula, name: a.nombre, cargo: a.cargo, ...details, idempotencyKey },
    idempotencyKey,
  );
  if (ok(r)) return;
  if (![404, 405, 501].includes(r.status)) throw fail(route, r);

  const fallback = '/activities';
  const f = await post(
    fallback,
    {
      eventId,
      experienceId,
      cedula: a.cedula,
      name: experienceName,
      shortDescription: `${a.nombre}: ${result.score} puntos`,
      longDescription: JSON.stringify({ cedula: a.cedula, nombre: a.nombre, cargo: a.cargo, ...details }),
      idempotencyKey,
    },
    idempotencyKey,
  );
  if (ok(f)) return;
  throw new Error(`${fail(route, r).message} · fallback ${fail(fallback, f).message}`);
}
