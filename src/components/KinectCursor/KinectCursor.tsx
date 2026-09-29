import { useEffect, useRef } from 'react';
import { cursor } from '../../input/cursorStore';
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
    const loop = (): void => {
      const el = root.current;
      if (el) {
        el.style.transform = `translate3d(${cursor.x}px, ${cursor.y}px, 0)`;
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
