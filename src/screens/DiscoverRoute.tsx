import { useEffect, useState } from 'react';
import { Background } from '../components/Background/Background';
import { CTAButton } from '../components/CTAButton/CTAButton';
import { Icon } from '../components/Icon/Icon';
import { RouteLine } from '../components/RouteLine/RouteLine';
import { StationHeader } from '../components/StationHeader/StationHeader';
import { AREAS, AREA_ORDER, TEXT, type AreaId } from '../config/content';
import { STATIC_MODE } from '../config/mode';
import { useSession } from '../state/SessionContext';
import { at } from './layout';
import s from './screens.module.css';

const HUB = { x: 954, y: 671 };
const HUB_D = 229;
const PILL_X = 1165;
const PILL_W = 645;
const PILL_H = 133;
const PILL_TOPS = [271, 438, 605, 771, 938] as const;

interface Item {
  key: string;
  label: string;
  icon: string;
  area?: AreaId;
}

/** Las 4 necesidades y "Eventos", como en el diseño de creatividad. */
const ITEMS: readonly Item[] = [
  ...AREA_ORDER.map((id) => ({ key: id, label: AREAS[id].pill, icon: AREAS[id].iconDark, area: id })),
  { key: 'eventos', label: TEXT.s3.extraPill.label, icon: TEXT.s3.extraPill.icon },
];

export function DiscoverRoute() {
  const { state, act } = useSession();
  const [drawn, setDrawn] = useState(STATIC_MODE ? ITEMS.length : 0); // ramas dibujadas 0..5

  useEffect(() => {
    if (STATIC_MODE) return undefined;
    const ids = ITEMS.map((_, i) => window.setTimeout(() => setDrawn(i + 1), 600 + i * 700));
    return () => ids.forEach((t) => window.clearTimeout(t));
  }, []);

  const done = drawn >= ITEMS.length;

  return (
    <div className={s.screen}>
      <Background kind="swoosh" />
      <StationHeader
        style={at(113, 225)}
        badge={TEXT.badge.info}
        number={3}
        title={TEXT.s3.title}
        width={600}
      />

      {ITEMS.map((it, i) => {
        const top = PILL_TOPS[i] as number;
        const cy = top + PILL_H / 2;
        const chosen = it.area !== undefined && state.areas.includes(it.area);
        const visible = drawn > i;
        return (
          <div key={it.key}>
            <RouteLine
              points={[{ x: HUB.x + HUB_D / 2, y: HUB.y }, { x: PILL_X, y: cy }]}
              progress={visible ? 1 : 0}
              colors={['var(--white)', 'var(--white)']}
              width={1920}
              height={1280}
              strokeWidth={4}
              showPending={false}
            />
            <div
              className={s.route}
              style={{
                ...at(PILL_X, top, PILL_W, PILL_H), boxSizing: 'border-box',
                opacity: visible ? 1 : 0.25,
                borderColor: chosen && visible ? 'var(--orange)' : 'var(--white)',
                transform: chosen && visible ? 'scale(1.04)' : 'none',
              }}
            >
              <span className={s.routeIcon}><Icon name={it.icon} size={62} /></span>
              <span style={{ textTransform: it.area ? 'uppercase' : 'none' }}>{it.label}</span>
            </div>
          </div>
        );
      })}

      <div
        style={{
          ...at(HUB.x - HUB_D / 2, HUB.y - HUB_D / 2, HUB_D, HUB_D), boxSizing: 'border-box', borderRadius: '50%',
          background: 'var(--surface)', border: '6px solid var(--orange)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Icon name="company" size={91} />
      </div>
      <div className={s.t37} style={{ ...at(HUB.x - 177, HUB.y + HUB_D / 2 + 22, 354), textAlign: 'center' }}>
        {TEXT.s3.company}
      </div>

      <CTAButton
        id="s3-continue"
        label={TEXT.cta.continue}
        disabled={!done}
        onActivate={() => act({ type: 'COMPLETE_STATION', n: 3 })}
        style={{ position: 'absolute', left: 113, top: 1011 }}
      />
    </div>
  );
}
