import { DwellTarget } from '../../interaction/DwellTarget';
import { Icon } from '../Icon/Icon';
import s from './NodeButton.module.css';

export type NodeState = 'locked' | 'available' | 'hover' | 'completed';

interface Props {
  number: number;
  icon: string;
  title: string;
  color: string;
  state: NodeState;
  progress?: number;
  /** Si se pasa, el círculo es un DwellTarget (hitbox Ø 260). Sin esto es solo visual. */
  onActivate?: () => void;
  targetId?: string;
}

const R = 118;
const CIRC = 2 * Math.PI * R;

function Circle({ number, icon, state, progress = 0 }: Omit<Props, 'title'>) {
  return (
    <div className={`${s.circle} ${s[state]}`}>
      {progress > 0 && (
        <svg className={s.ring} width="260" height="260" viewBox="0 0 260 260">
          <circle cx="130" cy="130" r={R} strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - progress)} />
        </svg>
      )}
      <div className={s.content} style={{ color: state === 'completed' ? 'var(--navy)' : undefined }}>
        {state === 'locked' && <Icon name="lock" size={72} />}
        {state === 'completed' && <Icon name="check" size={72} />}
        {(state === 'available' || state === 'hover') && <Icon name={icon} size={72} />}
        <span className={s.num}>{number}</span>
      </div>
    </div>
  );
}

/** Ø 220 (hitbox Ø 260). El título va debajo a 36 px. */
export function NodeButton(props: Props) {
  const { title, color, state, onActivate, targetId } = props;
  return (
    <div className={s.wrap} style={{ ['--c' as string]: color }}>
      {onActivate ? (
        <DwellTarget
          id={targetId}
          onActivate={onActivate}
          disabled={state !== 'available'}
          shape="circle"
          hitboxPadding={20}
          color={color}
          className={s.targetBox}
        >
          {(v) => (
            <Circle
              {...props}
              state={state === 'available' && v.hover ? 'hover' : state}
              progress={v.progress}
            />
          )}
        </DwellTarget>
      ) : (
        <Circle {...props} />
      )}
      <div className={s.title}>{title}</div>
    </div>
  );
}
