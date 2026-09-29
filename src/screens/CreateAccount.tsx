import { useEffect, useState } from 'react';
import { NODES, TEXT } from '../config/content';
import { CTAButton } from '../components/CTAButton/CTAButton';
import { Icon } from '../components/Icon/Icon';
import { StationHeader } from '../components/StationHeader/StationHeader';
import { useSession } from '../state/SessionContext';
import { at } from './layout';
import s from './screens.module.css';

const node = NODES[0]!;

export function CreateAccount() {
  const { act } = useSession();
  const [shown, setShown] = useState(0); // 0 = nada, 1 = tablet, 2..4 = beneficios

  useEffect(() => {
    const ids = [0, 1, 2, 3].map((i) => window.setTimeout(() => setShown(i + 1), 500 + i * 1100));
    return () => ids.forEach((t) => window.clearTimeout(t));
  }, []);

  const done = shown >= 4;

  return (
    <div className={s.screen}>
      <StationHeader
        style={at(96, 140)}
        badge={TEXT.badge.info}
        number={1}
        title={TEXT.s1.title}
        instruction={TEXT.s1.instruction}
        color={node.color}
      />

      {shown >= 1 && (
        <div
          className={`${s.logoBox} ${s.fadeIn}`}
          style={{ ...at(180, 450, 460, 560), background: 'var(--navy-2)', borderColor: node.color, gap: 24 }}
        >
          <span className={s.logoName}>{TEXT.brand}</span>
          <span className={s.t36}>{TEXT.s1.tabletLabel}</span>
        </div>
      )}

      {TEXT.s1.benefits.map((b, i) =>
        shown >= i + 2 ? (
          <div
            key={b.text}
            className={`${s.pill} ${s.fadeIn}`}
            style={{ ...at(820, 470 + i * 150, 900, 120), ['--c' as string]: node.color }}
          >
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
            style={{ position: 'absolute', left: 1404, top: 930 }}
          />
        </div>
      )}
    </div>
  );
}
