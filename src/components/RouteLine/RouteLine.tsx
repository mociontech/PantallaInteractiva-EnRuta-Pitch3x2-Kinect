import { useId } from 'react';
import s from './RouteLine.module.css';

export interface Point {
  x: number;
  y: number;
}

interface Props {
  points: readonly Point[];
  /** 0..1 a lo largo de toda la ruta. */
  progress: number;
  colors: readonly string[];
  /** Ancho/alto del lienzo SVG (px de Stage). */
  width: number;
  height: number;
  strokeWidth?: number;
  /** Curva suave (horizontal) entre puntos. */
  curve?: boolean;
}

function buildPath(pts: readonly Point[], curve: boolean): string {
  const first = pts[0];
  if (!first) return '';
  let d = `M ${first.x} ${first.y}`;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1] as Point;
    const q = pts[i] as Point;
    if (curve) {
      const mx = (p.x + q.x) / 2;
      d += ` C ${mx} ${p.y}, ${mx} ${q.y}, ${q.x} ${q.y}`;
    } else {
      d += ` L ${q.x} ${q.y}`;
    }
  }
  return d;
}

/** Path SVG animado con stroke-dashoffset. Tramo pendiente punteado en muted. */
export function RouteLine({ points, progress, colors, width, height, strokeWidth = 12, curve = true }: Props) {
  const gid = useId();
  const d = buildPath(points, curve);
  const first = points[0];
  const last = points[points.length - 1];
  return (
    <svg className={s.svg} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient
          id={gid}
          gradientUnits="userSpaceOnUse"
          x1={first?.x ?? 0} y1="0" x2={last?.x ?? width} y2="0"
        >
          {colors.map((c, i) => (
            <stop key={i} offset={`${(i / Math.max(1, colors.length - 1)) * 100}%`} stopColor={c} />
          ))}
        </linearGradient>
      </defs>
      <path d={d} className={s.pending} strokeWidth={strokeWidth / 2} />
      <path
        d={d}
        pathLength={1}
        className={s.glow}
        stroke={`url(#${gid})`}
        strokeWidth={strokeWidth + 8}
        strokeDasharray="1"
        strokeDashoffset={1 - progress}
      />
      <path
        d={d}
        pathLength={1}
        className={s.line}
        stroke={`url(#${gid})`}
        strokeWidth={strokeWidth}
        strokeDasharray="1"
        strokeDashoffset={1 - progress}
      />
    </svg>
  );
}
