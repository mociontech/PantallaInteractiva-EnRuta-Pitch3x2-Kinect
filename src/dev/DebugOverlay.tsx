import { useEffect, useState } from 'react';
import { useDwellEngine } from '../interaction/DwellContext';
import { cursor, link } from '../input/cursorStore';
import { INPUT } from '../config/experience';
import { SCREEN_ORDER, type Screen } from '../state/machine';
import { useSession } from '../state/SessionContext';

export function isDebug(): boolean {
  return import.meta.env.DEV || new URLSearchParams(window.location.search).get('debug') === '1';
}

interface Snap {
  fps: number;
  rects: ReturnType<typeof useDwellEngine>['debugRects'];
  x: number;
  y: number;
  tracked: boolean;
  status: string;
}

/** Overlay de debug: hitboxes, FPS, fuente de input, WS, pantalla y cursor. Atajos 1–8, R, U, T. */
export function DebugOverlay() {
  const engine = useDwellEngine();
  const { state, act } = useSession();
  const [snap, setSnap] = useState<Snap>({ fps: 0, rects: [], x: 0, y: 0, tracked: false, status: '' });

  useEffect(() => {
    let frames = 0;
    let raf = 0;
    const count = (): void => {
      frames++;
      raf = requestAnimationFrame(count);
    };
    raf = requestAnimationFrame(count);
    const iv = window.setInterval(() => {
      setSnap({
        fps: frames * 2, rects: engine.debugRects.slice(),
        x: Math.round(cursor.x), y: Math.round(cursor.y), tracked: cursor.tracked, status: link.status,
      });
      frames = 0;
    }, 500);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(iv);
    };
  }, [engine]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const k = e.key.toLowerCase();
      if (k >= '0' && k <= '9') {
        const to = SCREEN_ORDER[k === '0' ? 9 : Number(k) - 1] as Screen;
        act({ type: 'DEBUG_JUMP', to });
      } else if (k === 'r') act({ type: 'RESET' });
      else if (k === 'u') act({ type: 'DEBUG_UNLOCK_ALL' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [act]);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 2000, pointerEvents: 'none', fontFamily: 'monospace' }}>
      {snap.rects.map((r) => (
        <div
          key={r.id}
          style={{
            position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h,
            border: `2px dashed ${r.disabled ? '#f55' : r.hover ? '#5f5' : '#5cf'}`,
          }}
        >
          <span style={{ fontSize: 20, background: '#000a' }}>{r.id}</span>
        </div>
      ))}
      <div style={{ position: 'absolute', left: 8, top: 8, background: '#000c', padding: 8, fontSize: 20, lineHeight: 1.3 }}>
        {snap.fps} fps · input {link.kind} · ws {snap.status}
        <br />
        pantalla {state.screen} · cursor {snap.x},{snap.y} {snap.tracked ? '' : '(sin tracking)'} · dwell {INPUT.dwellSource}
        <br />
        teclas: 1–9,0 pantallas · R reset · U desbloquear · T tracked (mouse) · flechas y +/- calibran la zona (cam)
      </div>
    </div>
  );
}
