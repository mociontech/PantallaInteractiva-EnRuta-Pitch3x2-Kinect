import { DwellTarget } from '../../interaction/DwellTarget';
import { Icon } from '../Icon/Icon';
import s from './NodeButton.module.css';

export type NodeState = 'locked' | 'available' | 'hover' | 'completed';

interface Props {
  number: number;
  title: string;
  state: NodeState;
  progress?: number;
  /** Si se pasa, el círculo es un DwellTarget (hitbox Ø 260). Sin esto es solo visual. */
  onActivate?: () => void;
  targetId?: string;
}

const R = 118;
const CIRC = 2 * Math.PI * R;

function Circle({ number, state, progress = 0 }: Pick<Props, 'number' | 'state' | 'progress'>) {
  return (
    <div className={`${s.circle} ${s[state]}`}>
      {progress > 0 && (
        <svg className={s.ring} width="260" height="260" viewBox="0 0 260 260">
          <circle cx="130" cy="130" r={R} strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - progress)} />
        </svg>
      )}
      {state === 'completed' ? (
        <Icon name="check" size={96} />
      ) : (
        <div className={s.content}>
          {state === 'locked' && <Icon name="lock" size={40} />}
          <span className={state === 'locked' ? s.numSmall : s.num}>{number}</span>
        </div>
      )}
    </div>
  );
}

/** Ø 220 (hitbox Ø 260). El título va debajo a 37 px. */
export function NodeButton(props: Props) {
  const { title, state, onActivate, targetId } = props;
  return (
    <div className={s.wrap}>
      {onActivate ? (
        <DwellTarget
          id={targetId}
          onActivate={onActivate}
          disabled={state !== 'available'}
          shape="circle"
          hitboxPadding={20}
          color="var(--white)"
          className={s.targetBox}
        >
          {(v) => (
            <Circle
              number={props.number}
              state={state === 'available' && v.hover ? 'hover' : state}
              progress={v.progress}
            />
          )}
        </DwellTarget>
      ) : (
        <Circle number={props.number} state={state} progress={props.progress} />
      )}
      <div className={s.title}>{title}</div>
    </div>
  );
}
