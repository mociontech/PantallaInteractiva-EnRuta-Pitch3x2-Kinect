import { useSyncExternalStore } from 'react';
import type { AssignedParticipant, ServerToWall, WallToServer } from '../../shared/protocol';
import { REGISTRATION } from '../config/registration';

export interface LinkSnapshot {
  connected: boolean;
  /** Persona que la tablet dejó lista para jugar en la pared. */
  assigned: AssignedParticipant | null;
}

const RECONNECT_MS = 2000;

/**
 * Conexión de la pared con el servidor local (WebSocket). Se reconecta sola. La experiencia nunca se
 * bloquea por el servidor: si no hay conexión, simplemente no hay nadie asignado.
 */
class ServerLink {
  private ws: WebSocket | null = null;
  private timer: number | null = null;
  private stopped = true;
  private snapshot: LinkSnapshot = { connected: false, assigned: null };
  private listeners = new Set<() => void>();
  private cancelHandlers = new Set<() => void>();

  getSnapshot = (): LinkSnapshot => this.snapshot;

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  /** Se ejecuta cuando el servidor cancela el turno (el operador saltó a la persona o venció el tiempo). */
  onCancel(h: () => void): () => void {
    this.cancelHandlers.add(h);
    return () => this.cancelHandlers.delete(h);
  }

  private set(next: Partial<LinkSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...next };
    this.listeners.forEach((l) => l());
  }

  private url(): string {
    const base = REGISTRATION.serverUrl || window.location.origin;
    return `${base.replace(/^http/, 'ws')}/ws`;
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer !== null) window.clearTimeout(this.timer);
    const old = this.ws;
    this.ws = null;
    old?.close();
    this.set({ connected: false, assigned: null });
  }

  private connect(): void {
    const ws = new WebSocket(this.url());
    this.ws = ws;
    // Un socket viejo (cerrado por stop()/reconexión) no debe pisar el estado del actual.
    const current = (): boolean => this.ws === ws;
    ws.onopen = () => {
      if (!current()) return;
      this.set({ connected: true });
      this.send({ t: 'hello' });
    };
    ws.onmessage = (ev: MessageEvent<unknown>) => {
      if (!current() || typeof ev.data !== 'string') return;
      let msg: ServerToWall;
      try {
        msg = JSON.parse(ev.data) as ServerToWall;
      } catch {
        return;
      }
      if (msg.t === 'assign') this.set({ assigned: msg.participant });
      else if (msg.t === 'cancel') {
        this.set({ assigned: null });
        this.cancelHandlers.forEach((h) => h());
      }
    };
    ws.onclose = () => {
      if (!current()) return;
      this.set({ connected: false, assigned: null });
      if (!this.stopped) this.timer = window.setTimeout(() => this.connect(), RECONNECT_MS);
    };
    ws.onerror = () => ws.close();
  }

  send(msg: WallToServer): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  /** Al empezar la sesión la persona asignada deja de estar "esperando". */
  clearAssigned(): void {
    this.set({ assigned: null });
  }
}

export const serverLink = new ServerLink();

export function useServerLink(): LinkSnapshot {
  return useSyncExternalStore(serverLink.subscribe, serverLink.getSnapshot);
}
