import { NODES, TEXT } from '../../config/content';
import s from './ProgressIndicator.module.css';

/** 5 puntos de 36 px en los colores de los nodos + "2 de 5". */
export function ProgressIndicator({ completed }: { completed: number }) {
  return (
    <div className={s.root}>
      <div className={s.dots}>
        {NODES.map((n) => (
          <div
            key={n.n}
            className={`${s.dot} ${n.n <= completed ? s.done : ''}`}
            style={{ ['--c' as string]: n.color }}
          />
        ))}
      </div>
      <span className={s.label}>{TEXT.progress(completed)}</span>
    </div>
  );
}
