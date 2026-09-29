import { Icon } from '../Icon/Icon';
import s from './InfoCard.module.css';

interface Props {
  icon: string;
  title: string;
  text: string;
  color: string;
  seen?: boolean;
  hover?: boolean;
  progress?: number;
}

/** ~520×336. Reposo: icono y título. Hover: escala 1.08 y revela el texto. */
export function InfoCard({ icon, title, text, color, seen = false, hover = false, progress = 0 }: Props) {
  return (
    <div className={`${s.card} ${hover ? s.hover : ''}`} style={{ ['--c' as string]: color }}>
      {seen && <div className={s.seen}><Icon name="check" size={48} /></div>}
      <div className={s.icon}><Icon name={icon} size={72} /></div>
      <div className={s.title}>{title}</div>
      <div className={s.text}>{text}</div>
      <div className={s.bar}><div className={s.barFill} style={{ transform: `scaleX(${progress})` }} /></div>
    </div>
  );
}
