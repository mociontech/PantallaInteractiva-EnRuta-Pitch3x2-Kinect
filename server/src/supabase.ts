import { config } from './config';

/**
 * Cliente mínimo de Supabase (PostgREST por fetch, sin dependencias). Usa la clave de servicio: solo del lado servidor.
 * Las funciones LANZAN si no se pudo confirmar, para que el outbox reintente.
 */

export const supabaseEnabled = (): boolean => config.supabase.url !== '' && config.supabase.key !== '';

async function rest(route: string, init: { method: string; body?: unknown; prefer?: string }): Promise<unknown> {
  const { url, key } = config.supabase;
  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  if (init.prefer) headers.Prefer = init.prefer;
  const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${route}`, {
    method: init.method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${init.method} ${route.split('?')[0]} -> HTTP ${res.status}: ${text.slice(0, 160).replace(/\s+/g, ' ')}`);
  return text ? (JSON.parse(text) as unknown) : null;
}

export interface SupabaseAttendee {
  cedula: string;
  nombre: string;
  cargo: string;
}

/** Sube/actualiza la base de asistentes (la cédula es la llave). */
export async function upsertAttendees(list: SupabaseAttendee[]): Promise<number> {
  const now = new Date().toISOString();
  for (let i = 0; i < list.length; i += 500) {
    const rows = list.slice(i, i + 500).map((a) => ({ cedula: a.cedula, nombre: a.nombre, cargo: a.cargo, origen: 'base', updated_at: now }));
    await rest('attendees?on_conflict=cedula', { method: 'POST', body: rows, prefer: 'resolution=merge-duplicates,return=minimal' });
  }
  return list.length;
}

/** Asegura que la persona exista como asistente. Quien no estaba en la base queda como 'nuevo'; nunca pisa a uno existente. */
export async function ensureAttendee(a: SupabaseAttendee, origen: 'base' | 'nuevo'): Promise<void> {
  await rest('attendees?on_conflict=cedula', {
    method: 'POST',
    body: { cedula: a.cedula, nombre: a.nombre, cargo: a.cargo, origen },
    prefer: 'resolution=ignore-duplicates,return=minimal',
  });
}

export interface SupabaseResult {
  idempotencyKey: string;
  cedula: string;
  experience: 'pared' | 'triptico' | 'insta';
  score: number;
  completed: boolean;
  details: Record<string, unknown>;
  deviceId: string;
  playedAt: string;
  /** true: la pared ya lo entrega a Evius por su propia cola; así el barredor no lo reenvía. */
  eviusSent?: boolean;
}

/** ¿Ya hay un resultado de esta persona en esta experiencia? (una sola participación por experiencia) */
export async function hasPlayed(cedula: string, experience: 'pared' | 'triptico' | 'insta'): Promise<boolean> {
  const rows = (await rest(`results?cedula=eq.${encodeURIComponent(cedula)}&experience=eq.${experience}&select=id&limit=1`, { method: 'GET' })) as unknown[];
  return rows.length > 0;
}

/** Borra los resultados de una cédula (todas las experiencias o una) para poder repetir. No deshace lo ya enviado a Evius. */
export async function resetParticipation(cedula: string, experience?: 'pared' | 'triptico' | 'insta'): Promise<void> {
  const exp = experience ? `&experience=eq.${experience}` : '';
  await rest(`results?cedula=eq.${encodeURIComponent(cedula)}${exp}`, { method: 'DELETE', prefer: 'return=minimal' });
}

/** Guarda un resultado. Idempotente: la misma clave no se duplica. Devuelve false si esa persona ya tenía resultado en esta experiencia. */
export async function saveResult(r: SupabaseResult): Promise<boolean> {
  try {
    await saveResultRaw(r);
    return true;
  } catch (err) {
    // 409 = índice único (cédula, experiencia): ya participó. No se reintenta (quedaría atascado).
    if (err instanceof Error && /HTTP 409/.test(err.message)) return false;
    throw err;
  }
}

async function saveResultRaw(r: SupabaseResult): Promise<void> {
  await rest('results?on_conflict=idempotency_key', {
    method: 'POST',
    prefer: 'resolution=ignore-duplicates,return=minimal',
    body: {
      idempotency_key: r.idempotencyKey,
      cedula: r.cedula,
      experience: r.experience,
      score: r.score,
      completed: r.completed,
      details: r.details,
      device_id: r.deviceId,
      played_at: r.playedAt,
      ...(r.eviusSent ? { evius_sent_at: new Date().toISOString() } : {}),
    },
  });
}

export interface RankingRow {
  nombre: string;
  cargo: string;
  total: number;
  partidas: number;
  experiencias: number;
  pared: number;
  triptico: number;
  insta: number;
}

/** Ranking global (suma de las 3 experiencias). No incluye la cédula. */
export async function ranking(limit: number): Promise<RankingRow[]> {
  const cols = 'nombre,cargo,total,partidas,experiencias,pared,triptico,insta';
  return (await rest(`ranking?select=${cols}&limit=${Math.max(1, Math.min(200, limit))}`, { method: 'GET' })) as RankingRow[];
}

export interface PendingResult {
  id: string;
  cedula: string;
  experience: 'pared' | 'triptico' | 'insta';
  score: number;
  completed: boolean;
  details: Record<string, unknown>;
  device_id: string | null;
  played_at: string;
  idempotency_key: string;
}

/** Resultados que todavía no llegaron a Evius (más viejos que `minAgeMs`, para no pisar el envío inmediato de cada experiencia). */
export async function pendingEvius(limit: number, minAgeMs: number): Promise<PendingResult[]> {
  const before = new Date(Date.now() - minAgeMs).toISOString();
  return (await rest(`results?evius_sent_at=is.null&created_at=lt.${encodeURIComponent(before)}&order=created_at.asc&limit=${limit}`, { method: 'GET' })) as PendingResult[];
}

export async function markEviusSent(id: string): Promise<void> {
  await rest(`results?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', prefer: 'return=minimal', body: { evius_sent_at: new Date().toISOString() } });
}

export async function attendeeByCedula(cedula: string): Promise<{ nombre: string; cargo: string } | null> {
  const rows = (await rest(`attendees?cedula=eq.${encodeURIComponent(cedula)}&select=nombre,cargo&limit=1`, { method: 'GET' })) as Array<{ nombre: string; cargo: string }>;
  return rows[0] ?? null;
}
