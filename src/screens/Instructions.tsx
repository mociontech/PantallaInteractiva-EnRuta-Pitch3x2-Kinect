import { useState } from 'react';
import { TEXT } from '../config/content';
import { TIMING } from '../config/experience';
import { CTAButton } from '../components/CTAButton/CTAButton';
import { Icon } from '../components/Icon/Icon';
import { DwellTarget } from '../interaction/DwellTarget';
import { useSession } from '../state/SessionContext';
import { at } from './layout';
import s from './screens.module.css';

const CARD_W = 520;
const GAP = 64;
const X0 = (1920 - (3 * CARD_W + 2 * GAP)) / 2;

/** Cómo usar la experiencia, con un objetivo de práctica para aprender el dwell. */
export function Instructions() {
  const { act } = useSession();
  const [practiced, setPracticed] = useState(false);

  return (
    <div className={s.screen}>
      <h1 className={s.display} style={{ ...at(96, 150, 1728), fontSize: 88, textAlign: 'center' }}>
        {TEXT.instructions.title}
      </h1>

      {TEXT.instructions.steps.map((st, i) => (
        <div
          key={st.text}
          className={s.fadeIn}
          style={{
            ...at(X0 + i * (CARD_W + GAP), 330, CARD_W, 380),
            animationDelay: `${i * 0.25}s`,
            background: 'var(--navy-2)',
            border: '4px solid var(--electric)',
            borderRadius: 28,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 24, padding: 32, textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 56, fontWeight: 800 }}>{i + 1}</div>
          <Icon name={st.icon} size={110} />
          <div className={s.t36}>{st.text}</div>
        </div>
      ))}

      <DwellTarget
        id="practice"
        shape="circle"
        hitboxPadding={20}
        color="var(--electric)"
        disabled={practiced}
        onActivate={() => setPracticed(true)}
        style={at(X0, 790, 220, 220)}
      >
        {(v) => (
          <div
            style={{
              width: 220, height: 220, borderRadius: '50%',
              background: practiced ? 'var(--electric)' : 'var(--navy-2)',
              color: practiced ? 'var(--navy)' : 'var(--white)',
              border: '8px solid var(--electric)',
              transform: v.hover ? 'scale(1.1)' : 'none',
              transition: 'transform 0.25s ease',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon name={practiced ? 'check' : 'target'} size={110} />
          </div>
        )}
      </DwellTarget>
      <div className={s.t36} style={at(X0 + 260, 850, 640)}>
        {practiced ? TEXT.instructions.practiceDone : TEXT.instructions.practice}
      </div>

      <CTAButton
        id="instructions-continue"
        label={TEXT.instructions.cta}
        dwellMs={TIMING.dwellCtaMs}
        disabled={!practiced}
        onActivate={() => act({ type: 'GO', to: 'home' })}
        style={{ position: 'absolute', left: 1404, top: 830 }}
      />
    </div>
  );
}
