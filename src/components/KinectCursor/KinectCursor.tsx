import { useEffect, useRef } from 'react';
import { CURSOR_FEEL } from '../../config/experience';
import { CLASSIC_CURSOR, FORCE_SMOOTH } from '../../config/mode';
import { CursorSmoother } from '../../input/cursorSmoother';
import { cursor, link } from '../../input/cursorStore';
import s from './KinectCursor.module.css';

const RING_R = 56;
const CIRC = 2 * Math.PI * RING_R;

/**
 * Punto blanco 28 px + halo 96 px + anillo de dwell 120 px.
 * Posición y progreso se escriben por ref en cada rAF; sin estado de React.
 */
export function KinectCursor() {
  const root = useRef<HTMLDivElement>(null);
  const ring = useRef<SVGCircleElement>(null);

  useEffect(() => {
    let raf = 0;
    const smoother = new CursorSmoother(CURSOR_FEEL.smoother);
    let seq = -1;
    let wasTracked = false;
    const loop = (): void => {
      const el = root.current;
      let x = cursor.x;
      let y = cursor.y;
      // Con cámara (o ?smooth=1): se dibuja al ritmo de la pantalla y con imán hacia el botón cercano. ?classic=1 lo apaga.
      if (!CLASSIC_CURSOR && (link.kind === 'cam' || FORCE_SMOOTH)) {
        if (cursor.tracked && !wasTracked) smoother.reset(cursor.x, cursor.y, cursor.t);
        wasTracked = cursor.tracked;
        if (cursor.seq !== seq) {
          seq = cursor.seq;
          smoother.push(cursor.x, cursor.y, cursor.t);
        }
        const p = smoother.frame(performance.now(), link.sampleAgeMs);
        x = p.x;
        y = p.y;
        const m = cursor.magnet;
        if (m.k > 0) {
          x += (m.x - x) * m.k;
          y += (m.y - y) * m.k;
        }
      }
      if (el) {
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        el.style.opacity = cursor.tracked ? '1' : '0';
      }
      const r = ring.current;
      if (r) {
        r.style.strokeDashoffset = String(CIRC * (1 - cursor.progress));
        r.style.stroke = cursor.color;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={root} className={s.root}>
      <div className={s.halo} />
      <svg className={s.ringSvg} width="120" height="120" viewBox="0 0 120 120">
        <circle
          ref={ring}
          className={s.ring}
          cx="60" cy="60" r={RING_R}
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC}
        />
      </svg>
      <div className={s.dot} />
    </div>
  );
}
