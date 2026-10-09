import { useCallback, useEffect, useState } from 'react';
import type { AdminState, WallStatus } from '../../shared/protocol';
import s from './admin.module.css';

const BASE = (import.meta.env.VITE_SERVER_URL ?? '').replace(/\/$/, '');
const PIN_KEY = 'enruta.admin.pin';

const WALL_LABEL: Record<WallStatus, string> = {
  offline: 'Desconectada',
  idle: 'Libre',
  assigned: 'Esperando a que la persona empiece',
  playing: 'Jugando',
  finishing: 'Mostrando resultado',
};

function readPin(): string {
  try {
    return sessionStorage.getItem(PIN_KEY) ?? '';
  } catch {
    return '';
  }
}

/** Pantalla del operador (/admin): estado de la pared, cola, envíos a Evius y respaldo. */
export function AdminApp() {
  const [pin, setPin] = useState(readPin);
  const [draft, setDraft] = useState('');
  const [state, setState] = useState<AdminState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const call = useCallback(
    async (path: string, method = 'GET'): Promise<Response> =>
      fetch(BASE + path, { method, headers: { 'x-admin-pin': pin } }),
    [pin],
  );

  const refresh = useCallback(async (): Promise<void> => {
    if (!pin) return;
    try {
      const res = await call('/api/admin/state');
      if (res.status === 401) {
        setError('PIN incorrecto');
        setPin('');
        try {
          sessionStorage.removeItem(PIN_KEY);
        } catch {
          /* ignorar */
        }
        return;
      }
      setState((await res.json()) as AdminState);
      setError(null);
    } catch {
      setError('Sin conexión con el servidor');
    }
  }, [pin, call]);

  useEffect(() => {
    void refresh();
    const iv = window.setInterval(() => void refresh(), 2000);
    return () => window.clearInterval(iv);
  }, [refresh]);

  const act = async (path: string, ok: string, confirmText?: string): Promise<void> => {
    if (confirmText && !window.confirm(confirmText)) return;
    await call(path, 'POST');
    setNotice(ok);
    window.setTimeout(() => setNotice(null), 2500);
    void refresh();
  };

  const upload = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    const res = await fetch(`${BASE}/api/admin/attendees`, { method: 'POST', headers: { 'x-admin-pin': pin, 'Content-Type': 'text/plain' }, body: await file.text() });
    const r = (await res.json()) as { ok: boolean; total?: number; skipped?: number; error?: string };
    setNotice(r.ok ? `Base cargada: ${r.total} personas${r.skipped ? ` (${r.skipped} filas omitidas)` : ''}` : `No se cargó: ${r.error ?? 'error'}`);
    window.setTimeout(() => setNotice(null), 8000);
    void refresh();
  };

  const download = async (): Promise<void> => {
    const res = await call('/api/admin/export.csv');
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sesiones-pared.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!pin) {
    return (
      <div className={s.page}>
        <form
          className={s.login}
          onSubmit={(e) => {
            e.preventDefault();
            try {
              sessionStorage.setItem(PIN_KEY, draft);
            } catch {
              /* ignorar */
            }
            setPin(draft);
          }}
        >
          <h1>Operador · EnRuta</h1>
          <input type="password" inputMode="numeric" placeholder="PIN" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
          <button type="submit">Entrar</button>
          {error && <p className={s.bad}>{error}</p>}
        </form>
      </div>
    );
  }

  return (
    <div className={s.page}>
      <header className={s.header}>
        <h1>Operador · EnRuta</h1>
        {error ? <span className={s.bad}>{error}</span> : <span className={s.ok}>● en línea</span>}
      </header>
      {notice && <div className={s.notice}>{notice}</div>}

      {state && (
        <div className={s.grid}>
          <section className={s.card}>
            <h2>Pared</h2>
            <p className={s.big}>{WALL_LABEL[state.wall]}</p>
            <p>{state.active ? `Turno: ${state.active.nombre} (${state.active.cedula})` : 'Nadie asignado'}</p>
            <div className={s.row}>
              <button disabled={!state.active} onClick={() => void act('/api/admin/skip', 'Turno cancelado', '¿Sacar a esta persona de la pared?')}>
                Saltar turno actual
              </button>
            </div>
          </section>

          <section className={s.card}>
            <h2>Fila ({state.waiting.length})</h2>
            {state.waiting.length === 0 ? <p className={s.muted}>Vacía</p> : (
              <ol>
                {state.waiting.map((w) => <li key={w.queueId}>{w.nombre} <span className={s.muted}>· {w.cedula}</span></li>)}
              </ol>
            )}
            <div className={s.row}>
              <button disabled={state.waiting.length === 0} onClick={() => void act('/api/admin/clear-queue', 'Fila vaciada', '¿Vaciar toda la fila?')}>
                Vaciar fila
              </button>
            </div>
          </section>

          <section className={s.card}>
            <h2>Base de asistentes</h2>
            <p className={s.big}>{state.attendees.total}</p>
            <p className={s.muted}>{state.attendees.source}{state.attendees.loadedAt ? ` · ${new Date(state.attendees.loadedAt).toLocaleTimeString()}` : ''}</p>
            {state.attendees.error && <p className={s.bad}>{state.attendees.error}</p>}
            <div className={s.row}>
              <label className={s.fileBtn}>
                Cargar CSV
                <input type="file" accept=".csv,text/csv" hidden onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
              <button onClick={() => void act('/api/admin/reload-attendees', 'Base recargada')}>Recargar base</button>
            </div>
          </section>

          <section className={s.card}>
            <h2>Evius</h2>
            <p className={s.big}>{state.evius.pending} pendientes</p>
            <p className={s.muted}>
              Modo: {state.evius.mode === 'http' ? 'envío real' : state.evius.mode === 'mock' ? 'simulado' : 'sin configurar (EVIUS_URL)'}
              {' · '}Repetir cédula: {state.replayPolicy === 'allow' ? 'permitido' : 'bloqueado'}
            </p>
            <div className={s.row}>
              <button onClick={() => void act('/api/admin/retry-evius', 'Reintentando envíos')}>Reintentar ahora</button>
              <button onClick={() => void download()}>Descargar CSV</button>
            </div>
          </section>

          <section className={`${s.card} ${s.wide}`}>
            <h2>Últimas sesiones</h2>
            <table>
              <thead><tr><th>Hora</th><th>Persona</th><th>Cédula</th><th>Puntaje</th><th>Estado</th><th>Evius</th></tr></thead>
              <tbody>
                {state.recent.map((r) => (
                  <tr key={r.sessionId}>
                    <td>{new Date(r.endedAt).toLocaleTimeString()}</td>
                    <td>{r.nombre}</td>
                    <td>{r.cedula}</td>
                    <td>{r.score}</td>
                    <td>{r.completed ? 'Completó' : 'Abandonó'}</td>
                    <td className={r.evius === 'sent' ? s.ok : s.bad} title={r.lastError ?? ''}>
                      {r.evius === 'sent' ? 'Enviado' : `Pendiente${r.attempts ? ` (${r.attempts})` : ''}`}
                    </td>
                  </tr>
                ))}
                {state.recent.length === 0 && <tr><td colSpan={6} className={s.muted}>Aún no hay sesiones</td></tr>}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </div>
  );
}
