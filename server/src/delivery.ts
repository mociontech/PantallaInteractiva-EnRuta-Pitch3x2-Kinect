import { config } from './config';
import { deliverAttendeeToEvius, deliverExperienceToEvius, type EviusAttendee, type EviusResult } from './evius';
import { Outbox } from './outbox';

/** Los únicos dos destinos del outbox: registrar a la persona y guardar su puntaje. */
export type EviusDestination = 'eviusAttendee' | 'eviusExperience';

export interface EviusJobPayload {
  attendee: EviusAttendee;
  result: EviusResult;
}

export const outbox = new Outbox<EviusJobPayload, EviusDestination>({
  path: config.evius.outboxPath,
  deliverers: {
    eviusAttendee: (p) => deliverAttendeeToEvius(p.attendee),
    eviusExperience: (p, ctx) => deliverExperienceToEvius(p.attendee, p.result, ctx.idempotencyKey),
  },
  // El puntaje se envía solo cuando la persona ya quedó registrada en Evius.
  after: { eviusExperience: ['eviusAttendee'] },
  // Sin EVIUS_URL no hay a dónde enviar: todo se acumula en el archivo y se entrega en cuanto se configure.
  enabled: () => config.evius.mode !== 'off',
});

/** Encola el resultado de una sesión. Cédula = identificador único; una sesión = una clave de idempotencia. */
export function enqueueSession(attendee: EviusAttendee, result: EviusResult): void {
  outbox.enqueue({
    idempotencyKey: `${config.evius.eventId || 'evento'}:${attendee.cedula}:${result.sessionId}:${result.endedAt}`,
    payload: { attendee, result },
    destinations: ['eviusAttendee', 'eviusExperience'],
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
