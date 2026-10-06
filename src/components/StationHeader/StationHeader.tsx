import type { CSSProperties } from 'react';
import s from './StationHeader.module.css';

interface Props {
  badge: string;
  number: number;
  title: string;
  instruction?: string;
  /** Ancho del bloque de texto (px). */
  width?: number;
  /** Tamaño del H1 (px). Por defecto 93 (140 del diseño ÷ 1,5). */
  titleSize?: number;
  style?: CSSProperties;
}

/** Número en círculo, badge de tipo (INFORMATIVO / JUEGO n), H1 e instrucción, en blanco sobre el fondo azul. */
export function StationHeader({ badge, number, title, instruction, width = 985, titleSize = 93, style }: Props) {
  return (
    <div className={s.root} style={style}>
      <div className={s.num}>{number}</div>
      <div className={s.text} style={{ width }}>
        <span className={s.badge}>{badge}</span>
        <h1 className={s.h1} style={{ fontSize: titleSize, lineHeight: `${Math.round(titleSize * 1.08)}px` }}>
          {title}
        </h1>
        {instruction && <p className={s.instr}>{instruction}</p>}
      </div>
    </div>
  );
}
