import { INPUT } from '../config/experience';
import type { InputProvider, InputSample } from './InputProvider';
import { link, pushActivate, pushSample } from './cursorStore';

/*
 * CONTRATO CON TOUCHDESIGNER [CONFIRMAR]
 * Todo lo que depende del formato del mensaje vive en este archivo.
 * WebSocket DAT -> JSON: { x: 0..1, y: 0..1 (0 = arriba), tracked: boolean, activate?: boolean }
 * `activate` solo se usa si INPUT.dwellSource === 'td'.
 * No se aplica suavizado ni filtros: la señal se consume tal cual llega.
 */

interface TdMessage extends InputSample {
  activate?: boolean;
}

function isTdMessage(v: unknown): v is TdMessage {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.x === 'number' && typeof o.y === 'number' && typeof o.tracked === 'boolean';
}

export class TouchDesignerInput implements InputProvider {
  readonly kind = 'td' as const;
  private ws: WebSocket | null = null;
  private retry: number | null = null;
  private stopped = false;

  private connect(): void {
    link.status = 'connecting';
    const ws = new WebSocket(INPUT.tdWsUrl);
    this.ws = ws;
    ws.onopen = () => {
      link.status = 'open';
    };
    ws.onmessage = (ev: MessageEvent<unknown>) => {
      if (typeof ev.data !== 'string') return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (!isTdMessage(parsed)) return;
      pushSample({ x: parsed.x, y: parsed.y, tracked: parsed.tracked });
      if (INPUT.dwellSource === 'td' && parsed.activate) pushActivate();
    };
    ws.onclose = () => {
      link.status = 'closed';
      pushSample({ x: 0.5, y: 0.5, tracked: false });
      if (!this.stopped) this.retry = window.setTimeout(() => this.connect(), INPUT.reconnectMs);
    };
    ws.onerror = () => ws.close();
  }

  start(): void {
    link.kind = 'td';
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.retry !== null) window.clearTimeout(this.retry);
    this.ws?.close();
  }
}
