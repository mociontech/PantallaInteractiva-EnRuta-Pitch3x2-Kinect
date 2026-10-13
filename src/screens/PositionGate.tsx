import { useEffect, useRef, useState } from 'react';
import { TEXT } from '../config/content';
import { gate, link as camLink, releaseControl, type GateState } from '../input/cursorStore';

const CANVAS_W = 1000;
const CANVAS_H = 562;

/**
 * Pop-up "Ubícate" tras el registro: muestra la cámara (solo aquí), guía a la persona al centro y a la distancia correcta y,
 * cuando lo sostiene, la fija como usuario (nadie más le quita el control) y se cierra. La cámara no vuelve a verse.
 * Operador: Enter lo salta.
 */
export function PositionGate({ onReady }: { onReady: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const ready = useRef(onReady);
  ready.current = onReady;
  const [view, setView] = useState<{ state: GateState; progress: number; done: boolean }>({ state: 'none', progress: 0, done: false });

  useEffect(() => {
    releaseControl();
    gate.done = false;
    gate.state = 'none';
    gate.progress = 0;
    gate.canvas = canvas.current;
    gate.active = true;

    let raf = 0;
    let doneAt: number | null = null;
    let finished = false;
    const finish = (): void => {
      if (finished) return;
      finished = true;
      ready.current();
    };
    const tick = (): void => {
      const now = performance.now();
      setView((v) =>
        v.state === gate.state && v.done === gate.done && Math.abs(v.progress - gate.progress) < 0.03
          ? v
          : { state: gate.state, progress: gate.progress, done: gate.done },
      );
      if (camLink.status === 'closed') finish(); // sin cámara no hay nada que esperar
      if (gate.done) doneAt ??= now;
      if (doneAt !== null && now - doneAt > 1000) {
        finish();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Enter') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      gate.active = false;
      gate.canvas = null;
    };
  }, []);

  const T = TEXT.position;
  const ok = view.state === 'ok' || view.done;
  const message = view.done ? T.done : T.hint[view.state];

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(7, 16, 48, 0.94)', zIndex: 50 }}>
      <h2 style={{ position: 'absolute', left: 0, width: 1920, top: 130, margin: 0, textAlign: 'center', fontSize: 92, lineHeight: '104px', fontWeight: 800, color: 'var(--white)' }}>
        {T.title}
      </h2>
      <p style={{ position: 'absolute', left: 0, width: 1920, top: 262, margin: 0, textAlign: 'center', fontSize: 44, lineHeight: '56px', fontWeight: 600, color: 'var(--white)' }}>
        {T.subtitle}
      </p>
      <canvas
        ref={canvas}
        width={640}
        height={360}
        style={{
          position: 'absolute', left: (1920 - CANVAS_W) / 2, top: 380, width: CANVAS_W, height: CANVAS_H, background: '#000',
          borderRadius: 28, border: `8px solid ${ok ? '#4ade80' : '#ffffff'}`, boxSizing: 'content-box',
        }}
      />
      <p style={{ position: 'absolute', left: 0, width: 1920, top: 1010, margin: 0, textAlign: 'center', fontSize: 58, lineHeight: '70px', fontWeight: 800, color: ok ? '#4ade80' : 'var(--orange)' }}>
        {message}
      </p>
      <div style={{ position: 'absolute', left: 560, top: 1120, width: 800, height: 16, borderRadius: 8, background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.round((view.done ? 1 : view.progress) * 100)}%`, height: '100%', background: '#4ade80', transition: 'width 120ms linear' }} />
      </div>
    </div>
  );
}
