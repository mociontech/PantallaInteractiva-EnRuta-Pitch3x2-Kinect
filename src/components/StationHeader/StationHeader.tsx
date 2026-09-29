import type { CSSProperties } from 'react';
import s from './StationHeader.module.css';

interface Props {
  badge: string;
  number: number;
  title: string;
  instruction?: string;
  color: string;
  /** Ancho máximo del bloque de texto (px). Por defecto ocupa todo el ancho útil. */
  width?: number;
  style?: CSSProperties;
}

/** Badge de tipo, número, H1 (88 px) e instrucción, en el color de la estación. */
export function StationHeader({ badge, number, title, instruction, color, width = 1500, style }: Props) {
  return (
    <div className={s.root} style={{ ['--c' as string]: color, ...style }}>
      <div className={s.num}>{number}</div>
      <div className={s.text} style={{ width }}>
        <span className={s.badge}>{badge}</span>
        <h1 className={s.h1}>{title}</h1>
        {instruction && <p className={s.instr}>{instruction}</p>}
      </div>
    </div>
  );
}
