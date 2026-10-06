import { TIMING } from '../../config/experience';
import { DwellTarget } from '../../interaction/DwellTarget';
import s from './ExitButton.module.css';

/** "SALIR" del header de HOME (300×88). Dwell largo para evitar salidas accidentales. */
export function ExitButton({ label, onActivate, id = 'exit' }: { label: string; onActivate: () => void; id?: string }) {
  return (
    <DwellTarget
      id={id}
      onActivate={onActivate}
      dwellMs={TIMING.dwellCtaMs}
      hitboxPadding={16}
      color="var(--orange)"
      style={{ width: 300, height: 88 }}
    >
      {(v) => (
        <div className={`${s.btn} ${v.hover ? s.hover : ''}`}>
          <div className={s.fill} style={{ transform: `scaleX(${v.progress})` }} />
          <span className={s.label}>{label}</span>
        </div>
      )}
    </DwellTarget>
  );
}
