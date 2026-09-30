import { useEffect, useRef, useState, type ReactNode } from 'react';
import { STAGE } from '../../config/experience';
import { STATIC_MODE } from '../../config/mode';
import { useDwellEngine } from '../../interaction/DwellContext';
import s from './Stage.module.css';

/** Escenario fijo de 1920×1280 escalado con letterbox. Todo adentro va en px de referencia. */
export function Stage({ children }: { children: ReactNode }) {
  const engine = useDwellEngine();
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const fit = (): void =>
      setScale(Math.min(window.innerWidth / STAGE.width, window.innerHeight / STAGE.height));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    engine.setStageEl(ref.current);
    return () => engine.setStageEl(null);
  }, [engine]);

  return (
    <div className={STATIC_MODE ? s.staticBox : s.letterbox}>
      <div
        id="stage"
        ref={ref}
        className={STATIC_MODE ? s.staticStage : s.stage}
        style={STATIC_MODE ? undefined : { transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}
