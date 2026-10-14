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

export interface SupabaseResult {
  idempotencyKey: string;
  cedula: string;
  experience: 'pared' | 'triptico' | 'insta';
  score: number;
  completed: boolean;
  details: Record<string, unknown>;
  deviceId: string;
  playedAt: string;
}

/** Guarda un resultado. Idempotente: la misma clave no se duplica. */
export async function saveResult(r: SupabaseResult): Promise<void> {
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
