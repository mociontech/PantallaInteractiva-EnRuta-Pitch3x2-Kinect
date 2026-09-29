import { NODES, TEXT } from '../config/content';
import { TIMING } from '../config/experience';
import { CTAButton } from '../components/CTAButton/CTAButton';
import { useTracked } from '../input/useCursor';
import { useSession } from '../state/SessionContext';
import { at, centered } from './layout';
import s from './screens.module.css';

export function Idle() {
  const { act } = useSession();
  const tracked = useTracked();
  return (
    <div className={s.screen}>
      <div className={s.logoBox} style={{ ...at(96, 80, 420, 130) }}>
        <span className={s.logoName}>{TEXT.brand}</span>
        <span className={s.logoSub}>{TEXT.brandSub}</span>
      </div>

      <h1 className={s.display} style={at(96, 230, 1400)}>{TEXT.idle.display}</h1>
      <p className={s.h2} style={at(96, 570, 1728)}>{TEXT.idle.subtitle}</p>
      <div className={s.accent} style={at(96, 665)} />
      <p className={s.t36} style={at(96, 705, 1200)}>{TEXT.idle.slogan}</p>

      {NODES.map((n, i) => (
        <div
          key={n.n}
          style={{
            ...centered(240 + i * 360, 850, 120, 120),
            borderRadius: '50%',
            border: `6px solid ${n.color}`,
            animation: `pulseDot 3s ease-in-out ${i * 0.5}s infinite`,
          }}
        />
      ))}

      <p className={s.t48} style={at(96, 985, 1000)}>{TEXT.idle.prompt}</p>
      <CTAButton
        id="idle-start"
        label={TEXT.idle.cta}
        dwellMs={TIMING.dwellCtaMs}
        disabled={!tracked}
        onActivate={() => act({ type: 'START' })}
        style={{ position: 'absolute', left: 1404, top: 960 }}
      />
      <style>{`@keyframes pulseDot { 0%,100% { transform: scale(1); opacity: .5 } 20% { transform: scale(1.25); opacity: 1 } 40% { transform: scale(1); opacity: .5 } }`}</style>
    </div>
  );
}
