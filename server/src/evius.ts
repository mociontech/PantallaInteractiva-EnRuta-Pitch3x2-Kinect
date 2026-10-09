import { config } from './config';

/**
 * Gateway hacia Evius (Datahub). Solo sabe hablar HTTP con Evius; la cola y los reintentos viven en outbox.ts.
 * Las funciones LANZAN un error si la entrega no se pudo confirmar, para que el outbox reintente.
 *
 * La API real (Datahub) recibe LOTES: { eventId, source, sentAt, records: [...] } y responde 200 aunque algunos registros fallen,
 * con { received, processed, failed, errors }. Por eso el éxito se decide por el cuerpo (failed === 0), no por el código HTTP.
 * [CONFIRMAR] Campos de cada record, confirmados contra dev: `email` (identifica al asistente) y `fullName` (attendees); `email`,
 * `play_timestamp` y `score` (experiences, enlaza por email); `name` (activities). Se ajustan SOLO en este archivo.
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

interface BatchResponse {
  received?: number;
  processed?: number;
  failed?: number;
  errors?: string[];
}

/** Envía un lote. Lanza si HTTP != 2xx o si el cuerpo reporta registros fallidos (la API responde 200 con errores). */
async function postBatch(route: string, extra: Record<string, unknown>, records: unknown[], idempotencyKey: string): Promise<void> {
  const { url, token, eventId, experienceName } = config.evius;
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${url.replace(/\/$/, '')}${route}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ eventId, source: experienceName, sentAt: new Date().toISOString(), ...extra, records }),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  const brief = text.slice(0, 200).replace(/\s+/g, ' ');
  if (!res.ok) throw new Error(`POST ${route} -> HTTP ${res.status}: ${brief}`);
  let data: BatchResponse;
  try {
    data = JSON.parse(text) as BatchResponse;
  } catch {
    throw new Error(`POST ${route} -> respuesta no es JSON: ${brief}`);
  }
  const errors = data.errors ?? [];
  if ((data.failed ?? 0) > 0 || errors.length > 0 || (data.processed ?? 0) < records.length) {
    throw new Error(`POST ${route} -> rechazado: ${errors.join('; ') || brief}`.slice(0, 300));
  }
}

/** Evius identifica al asistente por correo. La base no trae correos: se deriva uno estable de la cédula (único por persona). */
const emailOf = (a: EviusAttendee): string => `${a.cedula}@${config.evius.emailDomain}`;

/** Registra a la persona en el evento (Evius deduplica por cédula + eventId). */
export async function deliverAttendeeToEvius(a: EviusAttendee): Promise<void> {
  const { mode, eventId } = config.evius;
  if (mode === 'mock') {
    console.log('[evius:mock] attendee', JSON.stringify(a));
    return;
  }
  await postBatch('/attendees', {}, [{ email: emailOf(a), fullName: a.nombre, cedula: a.cedula, cargo: a.cargo }], `att:${eventId}:${a.cedula}`);
}

/** Guarda el puntaje. Si /experiences no existe en el evento (404/405/501) cae a /activities con el puntaje en `longDescription`. */
export async function deliverExperienceToEvius(a: EviusAttendee, result: EviusResult, idempotencyKey: string): Promise<void> {
  const { mode, experienceId, experienceName } = config.evius;
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
  try {
    await postBatch(
      '/experiences',
      { experienceId },
      [{ email: emailOf(a), fullName: a.nombre, cedula: a.cedula, cargo: a.cargo, play_timestamp: result.endedAt, ...details, idempotencyKey }],
      idempotencyKey,
    );
  } catch (err) {
    if (!/HTTP (404|405|501)/.test(err instanceof Error ? err.message : '')) throw err;
    await postBatch(
      '/activities',
      { experienceId },
      [
        {
          name: experienceName,
          cedula: a.cedula,
          shortDescription: `${a.nombre}: ${result.score} puntos`,
          longDescription: JSON.stringify({ cedula: a.cedula, nombre: a.nombre, cargo: a.cargo, ...details }),
          idempotencyKey,
        },
      ],
      idempotencyKey,
    );
  }
}
