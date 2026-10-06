import { Icon } from '../Icon/Icon';
import s from './InfoCard.module.css';

interface Props {
  icon: string;
  title: string;
  text: string;
  /** Explorada: borde naranja y descripción visible. */
  seen?: boolean;
  hover?: boolean;
  progress?: number;
}

/** 476×307. Reposo: icono y título. Hover: se amplía y revela la descripción. Explorada: borde naranja. */
export function InfoCard({ icon, title, text, seen = false, hover = false, progress = 0 }: Props) {
  const open = hover || seen;
  return (
    <div className={`${s.card} ${hover ? s.hover : ''} ${seen ? s.seen : ''}`}>
      <div className={s.icon}><Icon name={icon} size={66} /></div>
      <div className={s.title}>{title}</div>
      <div className={`${s.text} ${open ? s.open : ''}`}>{text}</div>
      <div className={s.bar}><div className={s.barFill} style={{ transform: `scaleX(${progress})` }} /></div>
    </div>
  );
}
