import { useEffect, useState } from 'react';
import { Background } from '../components/Background/Background';
import { CTAButton } from '../components/CTAButton/CTAButton';
import { Icon } from '../components/Icon/Icon';
import { StationHeader } from '../components/StationHeader/StationHeader';
import { TEXT } from '../config/content';
import { STATIC_MODE } from '../config/mode';
import { useSession } from '../state/SessionContext';
import { at } from './layout';
import s from './screens.module.css';

const PILL_TOPS = [473, 623, 774] as const;

export function CreateAccount() {
  const { act } = useSession();
  const [shown, setShown] = useState(STATIC_MODE ? 4 : 0); // 0 = nada, 1 = tablet, 2..4 = beneficios

  useEffect(() => {
    if (STATIC_MODE) return undefined;
    const ids = [0, 1, 2, 3].map((i) => window.setTimeout(() => setShown(i + 1), 500 + i * 1100));
    return () => ids.forEach((t) => window.clearTimeout(t));
  }, []);

  const done = shown >= 4;

  return (
    <div className={s.screen}>
      <Background kind="swoosh" />
      <StationHeader
        style={at(178, 157)}
        badge={TEXT.badge.info}
        number={1}
        title={TEXT.s1.title}
        instruction={TEXT.s1.instruction}
        width={1450}
      />

      {shown >= 1 && (
        <div
          className={s.fadeIn}
          style={{
            ...at(180, 453, 461, 561), boxSizing: 'border-box', border: '3px solid var(--orange)', borderRadius: 24,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24,
          }}
        >
          {/* [CONFIRMAR] creatividad diseñó una pantalla "REGISTRO" (cédula) que podría ir dentro de esta tablet. */}
          <span style={{ fontSize: 56, fontWeight: 800, color: 'var(--white)' }}>{TEXT.brand}</span>
          <span style={{ fontSize: 36, fontWeight: 600, color: 'var(--white)' }}>{TEXT.s1.tabletLabel}</span>
        </div>
      )}

      {TEXT.s1.benefits.map((b, i) =>
        shown >= i + 2 ? (
          <div key={b.text} className={`${s.pill} ${s.fadeIn}`} style={at(821, PILL_TOPS[i] as number, 901, 120)}>
            <span className={s.pillIcon}><Icon name={b.icon} size={56} /></span>
            {b.text}
          </div>
        ) : null,
      )}

      {done && (
        <div className={s.fadeIn}>
          <CTAButton
            id="s1-continue"
            label={TEXT.cta.continue}
            onActivate={() => act({ type: 'COMPLETE_STATION', n: 1 })}
            style={{ position: 'absolute', left: 1303, top: 929 }}
          />
        </div>
      )}
    </div>
  );
}
