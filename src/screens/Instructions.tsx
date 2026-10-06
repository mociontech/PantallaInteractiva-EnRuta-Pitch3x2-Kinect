import { useState } from 'react';
import { Background } from '../components/Background/Background';
import { CTAButton } from '../components/CTAButton/CTAButton';
import { Icon } from '../components/Icon/Icon';
import { TEXT } from '../config/content';
import { TIMING } from '../config/experience';
import { DwellTarget } from '../interaction/DwellTarget';
import { useSession } from '../state/SessionContext';
import { at } from './layout';
import s from './screens.module.css';

const CARD_X = [115, 699, 1284] as const;

/** Glifo "◎" del diseño: dos anillos concéntricos. */
function Target({ size }: { size: number }) {
  return <span className={s.targetGlyph} style={{ width: size, height: size }} />;
}

function StepIcon({ name }: { name: string }) {
  if (name === 'target') return <Target size={70} />;
  if (name === 'hand') {
    return <span style={{ display: 'inline-block', transform: 'scaleX(-1)' }}><Icon name="hand" size={101} /></span>;
  }
  return <Icon name={name} size={87} />;
}

/** Cómo usar la experiencia, con un objetivo de práctica para aprender el dwell. */
export function Instructions() {
  const { act } = useSession();
  const [practiced, setPracticed] = useState(false);

  return (
    <div className={s.screen}>
      <Background kind="swoosh" />

      <h1 className={s.h1} style={{ ...at(0, 241, 1920), textAlign: 'center', fontSize: 107, lineHeight: '90px' }}>
        {TEXT.instructions.title}
      </h1>

      {TEXT.instructions.steps.map((st, i) => (
        <div key={st.text}>
          <div
            className={s.fadeIn}
            style={{
              ...at(CARD_X[i] as number, 464, 520, 307),
              animationDelay: `${i * 0.25}s`,
              boxSizing: 'border-box',
              border: '5px solid var(--orange)',
              borderRadius: 28,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 22, padding: 32, textAlign: 'center',
            }}
          >
            <StepIcon name={st.icon} />
            <div className={s.t37} style={{ width: 450 }}>{st.text}</div>
          </div>
          <div
            style={{
              ...at((CARD_X[i] as number) + 48, 420, 88, 88), borderRadius: '50%', background: 'var(--orange)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 47, fontWeight: 800, color: 'var(--white)',
            }}
          >
            {i + 1}
          </div>
        </div>
      ))}

      <DwellTarget
        id="practice"
        shape="circle"
        hitboxPadding={20}
        color="var(--white)"
        disabled={practiced}
        onActivate={() => setPracticed(true)}
        style={at(115, 851, 220, 220)}
      >
        {(v) => (
          <div
            style={{
              width: 220, height: 220, borderRadius: '50%', boxSizing: 'border-box',
              background: practiced ? 'var(--orange)' : 'rgba(255, 115, 0, 0.34)',
              border: '8px solid var(--orange)',
              transform: v.hover ? 'scale(1.08)' : 'none',
              transition: 'transform 0.25s ease',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy)',
              boxShadow: v.progress > 0 ? `0 0 0 ${Math.round(v.progress * 14)}px rgba(255,255,255,0.35)` : 'none',
            }}
          >
            {practiced ? <Icon name="check" size={96} /> : <Target size={66} />}
          </div>
        )}
      </DwellTarget>
      <div style={{ ...at(387, 889, 640), fontSize: 53, lineHeight: '60px', fontWeight: 600, color: 'var(--white)' }}>
        {practiced ? TEXT.instructions.practiceDone : TEXT.instructions.practice}
      </div>

      <CTAButton
        id="instructions-continue"
        label={TEXT.instructions.cta}
        dwellMs={TIMING.dwellCtaMs}
        disabled={!practiced}
        onActivate={() => act({ type: 'GO', to: 'home' })}
        style={{ position: 'absolute', left: 1384, top: 885 }}
      />
    </div>
  );
}
