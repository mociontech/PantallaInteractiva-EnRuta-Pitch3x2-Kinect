import { config } from './config';
import { deliverAttendeeToEvius, deliverExperienceToEvius, type EviusAttendee, type EviusResult } from './evius';
import { Outbox } from './outbox';
import { attendees } from './attendees';
import { ensureAttendee, saveResult, supabaseEnabled } from './supabase';

/** Destinos del outbox: registrar a la persona y guardar su puntaje en Evius, y copiar el resultado a Supabase (ranking). */
export type EviusDestination = 'eviusAttendee' | 'eviusExperience' | 'supabaseResult';

export interface EviusJobPayload {
  attendee: EviusAttendee;
  result: EviusResult;
}

export const outbox = new Outbox<EviusJobPayload, EviusDestination>({
  path: config.evius.outboxPath,
  deliverers: {
    eviusAttendee: (p) => deliverAttendeeToEvius(p.attendee),
    eviusExperience: (p, ctx) => deliverExperienceToEvius(p.attendee, p.result, ctx.idempotencyKey),
    supabaseResult: async (p, ctx) => {
      // Una persona registrada en la tablet que no estaba en el Sheet queda como asistente nuevo en la base compartida.
      await ensureAttendee(
        { cedula: p.attendee.cedula, nombre: p.attendee.nombre, cargo: p.attendee.cargo },
        attendees.find(p.attendee.cedula) ? 'base' : 'nuevo',
      );
      await saveResult({
        idempotencyKey: ctx.idempotencyKey,
        cedula: p.attendee.cedula,
        experience: 'pared',
        score: p.result.score,
        completed: p.result.completed,
        details: {
          lastStep: p.result.lastStep,
          gameScore: p.result.gameScore,
          areas: p.result.areas,
          solutionsViewed: p.result.solutionsViewed,
          durationMs: p.result.durationMs,
          sessionId: p.result.sessionId,
        },
        deviceId: p.result.deviceId,
        playedAt: p.result.endedAt,
        eviusSent: true,
      });
    },
  },
  // El puntaje se envía solo cuando la persona ya quedó registrada en Evius.
  after: { eviusExperience: ['eviusAttendee'] },
  // Sin EVIUS_URL no hay a dónde enviar: todo se acumula en el archivo y se entrega en cuanto se configure.
  enabled: (dest) => (dest === 'supabaseResult' ? supabaseEnabled() : config.evius.mode !== 'off'),
});

/** Encola el resultado de una sesión. Cédula = identificador único; una sesión = una clave de idempotencia. */
export function enqueueSession(attendee: EviusAttendee, rawResult: EviusResult): void {
  // Cada experiencia aporta como máximo `maxScore` puntos al total.
  const result = { ...rawResult, score: Math.min(config.maxScore, rawResult.score) };
  outbox.enqueue({
    idempotencyKey: `${config.evius.eventId || 'evento'}:${attendee.cedula}:${result.sessionId}:${result.endedAt}`,
    payload: { attendee, result },
    destinations: supabaseEnabled() ? ['eviusAttendee', 'eviusExperience', 'supabaseResult'] : ['eviusAttendee', 'eviusExperience'],
    meta: { sessionId: result.sessionId, cedula: attendee.cedula },
  });
}

export interface SessionDelivery {
  status: 'pending' | 'sent';
  attempts: number;
  lastError: string | null;
}

/** Estado de entrega de una sesión: enviada solo si ambos destinos están entregados. */
export function deliveryOfSession(sessionId: number): SessionDelivery {
  let found: SessionDelivery | null = null;
  for (const job of outbox.list()) {
    if (job.meta.sessionId !== sessionId) continue;
    const d = Object.values(job.deliveries);
    const pending = d.filter((x) => x.status === 'pending');
    found = {
      status: pending.length === 0 ? 'sent' : 'pending',
      attempts: Math.max(0, ...d.map((x) => x.attempts)),
      lastError: pending.find((x) => x.lastError)?.lastError ?? null,
    };
  }
  return found ?? { status: 'pending', attempts: 0, lastError: null };
}
