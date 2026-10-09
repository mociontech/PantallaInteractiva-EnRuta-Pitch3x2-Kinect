import type { QueueInfo, RegisterResponse } from '../../shared/protocol';

const BASE = (import.meta.env.VITE_SERVER_URL ?? '').replace(/\/$/, '');

/** Error de red / servidor caído (distinto de una respuesta de validación del servidor). */
export class OfflineError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const res = await fetch(BASE + path, { ...init, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new OfflineError(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (err) {
    throw err instanceof OfflineError ? err : new OfflineError(err instanceof Error ? err.message : 'red');
  }
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

export const api = {
  register: (cedula: string): Promise<RegisterResponse> => post('/api/register', { cedula }),
  registerNew: (body: { cedula: string; nombre: string; consent: boolean }): Promise<RegisterResponse> =>
    post('/api/register/new', body),
  queue: (id: number): Promise<QueueInfo> => request(`/api/queue/${id}`),
};
