import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { TIMING } from '../config/experience';
import { useDwellEngine } from './DwellContext';
import type { TargetMode, TargetOptions, TargetShape, TargetView } from './engine';

export interface DwellTargetProps {
  id?: string;
  onActivate: () => void;
  dwellMs?: number;
  hitboxPadding?: number;
  disabled?: boolean;
  mode?: TargetMode;
  shape?: TargetShape;
  /** Color del anillo de dwell del cursor. */
  color?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode | ((view: TargetView) => ReactNode);
}

/** Wrapper común de todo lo interactivo. Expone hover y progress (0–1). */
export function DwellTarget({
  id,
  onActivate,
  dwellMs = TIMING.dwellMs,
  hitboxPadding = 0,
  disabled = false,
  mode = 'dwell',
  shape = 'rect',
  color = 'var(--white)',
  className,
  style,
  children,
}: DwellTargetProps) {
  const engine = useDwellEngine();
  const autoId = useId();
  const key = id ?? autoId;
  const ref = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<TargetView>({ hover: false, progress: 0 });

  const opts: TargetOptions = {
    dwellMs, padding: hitboxPadding, disabled, mode, shape, color, onActivate,
  };
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const regRef = useRef<ReturnType<typeof engine.register> | null>(null);

  useEffect(() => {
    regRef.current = engine.register(key, () => ref.current, optsRef.current, setView);
    return () => {
      regRef.current = null;
      engine.unregister(key);
    };
  }, [engine, key]);

  // El engine lee reg.opts en cada frame: se mantiene apuntando a las últimas props.
  useEffect(() => {
    if (regRef.current) regRef.current.opts = opts;
  });

  return (
    <div ref={ref} className={className} style={style} data-target={key}>
      {typeof children === 'function' ? children(view) : children}
    </div>
  );
}
