import { config } from './config';
import { deliverAttendeeToEvius, deliverExperienceToEvius } from './evius';
import { attendeeByCedula, markEviusSent, pendingEvius, supabaseEnabled } from './supabase';

/**
 * Barredor: red de seguridad para el tríptico e Insta Face. Cada una intenta enviar a Evius al terminar; si Evius no
 * respondió, el resultado queda en Supabase con evius_sent_at vacío y este barredor lo reintenta hasta lograrlo.
 * (Los resultados de la pared no pasan por aquí: ya tienen su propia cola con reintento infinito.)
 */
const EVERY_MS = 10_000;
const MIN_AGE_MS = 15_000;
let running = false;

async function sweep(): Promise<void> {
  if (running || !supabaseEnabled() || config.evius.mode === 'off') return;
  running = true;
  try {
    const rows = await pendingEvius(20, MIN_AGE_MS);
    for (const r of rows) {
      const exp = config.evius.experiences[r.experience];
      if (r.experience === 'pared' || !exp?.id) continue;
      try {
        const known = await attendeeByCedula(r.cedula);
        const attendee = { cedula: r.cedula, nombre: known?.nombre ?? r.cedula, cargo: known?.cargo ?? '' };
        await deliverAttendeeToEvius(attendee, exp.name);
        await deliverExperienceToEvius(
          attendee,
          {
            sessionId: 0, score: r.score, completed: r.completed, lastStep: 0, gameScore: 0, areas: [], solutionsViewed: [],
            durationMs: Number(r.details?.durationMs ?? 0), startedAt: null, endedAt: r.played_at, deviceId: r.device_id ?? r.experience,
          },
          r.idempotency_key,
          exp,
        );
        await markEviusSent(r.id);
        console.log(`[barredor] ${r.experience} ${r.cedula} (${r.score} pts) entregado a Evius`);
      } catch (err) {
        console.warn(`[barredor] ${r.experience} ${r.cedula} sigue pendiente: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    console.warn(`[barredor] no se pudo leer Supabase: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    running = false;
  }
}

export function startSweeper(): void {
  setInterval(() => void sweep(), EVERY_MS).unref();
}
