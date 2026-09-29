import { TIMING } from '../../config/experience';
import s from './TransitionOverlay.module.css';

/** Barrido de 600 ms; cubre la pantalla por completo a mitad de camino. Bloquea el input. */
export function TransitionOverlay({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className={s.root}>
      <div className={s.sweep} style={{ animationDuration: `${TIMING.transitionBlockMs}ms` }}>
        <div className={s.edge} />
      </div>
    </div>
  );
}
