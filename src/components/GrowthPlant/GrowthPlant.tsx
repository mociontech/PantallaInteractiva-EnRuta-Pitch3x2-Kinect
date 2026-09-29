import s from './GrowthPlant.module.css';

interface Props {
  /** 0..4 */
  stage: number;
  /** 0..1, barra de progreso inferior. */
  progress: number;
  showBar?: boolean;
}

/** Placeholder SVG (Fase 2: planta de marca). 5 etapas de crecimiento. */
export function GrowthPlant({ stage, progress, showBar = true }: Props) {
  const st = Math.max(0, Math.min(4, stage));
  const stemH = 40 + st * 55;
  const leaves = st;
  return (
    <div className={s.root}>
      <svg width="360" height="460" viewBox="0 0 360 460" className={s.svg}>
        <path d="M110 380 L250 380 L230 450 L130 450 Z" className={s.pot} />
        <g className={s.plant} style={{ transformOrigin: '180px 380px' }}>
          <rect x="172" y={380 - stemH} width="16" height={stemH} rx="8" className={s.stem} />
          {Array.from({ length: leaves }, (_, i) => {
            const y = 380 - stemH + 20 + i * 45;
            const dir = i % 2 === 0 ? 1 : -1;
            return (
              <ellipse
                key={i}
                cx={180 + dir * 42}
                cy={y}
                rx="42" ry="20"
                transform={`rotate(${dir * -25} ${180 + dir * 42} ${y})`}
                className={s.leaf}
              />
            );
          })}
          {st >= 4 && <circle cx="180" cy={380 - stemH - 10} r="26" className={s.flower} />}
        </g>
      </svg>
      {showBar && (
        <div className={s.bar}>
          <div className={s.barFill} style={{ transform: `scaleX(${progress})` }} />
        </div>
      )}
    </div>
  );
}
