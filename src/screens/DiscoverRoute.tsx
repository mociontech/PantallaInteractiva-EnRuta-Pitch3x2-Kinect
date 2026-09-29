import { useEffect, useState } from 'react';
import { NODES, ROUTE_SOLUTIONS, SOLUTIONS, TEXT } from '../config/content';
import { AREA_TO_SOLUTIONS } from '../config/experience';
import { CTAButton } from '../components/CTAButton/CTAButton';
import { Icon } from '../components/Icon/Icon';
import { NodeButton } from '../components/NodeButton/NodeButton';
import { RouteLine } from '../components/RouteLine/RouteLine';
import { StationHeader } from '../components/StationHeader/StationHeader';
import { useSession } from '../state/SessionContext';
import { at } from './layout';
import s from './screens.module.css';

const node = NODES[2]!;
const HUB = { x: 960, y: 670 };
const PILL_X = 1240;
const PILL_W = 584;
const PILL_H = 120;
const PILL_Y0 = 290;
const PILL_GAP = 40;

export function DiscoverRoute() {
  const { state, act } = useSession();
  const [drawn, setDrawn] = useState(0); // ramas dibujadas 0..5

  useEffect(() => {
    const ids = ROUTE_SOLUTIONS.map((_, i) => window.setTimeout(() => setDrawn(i + 1), 600 + i * 700));
    return () => ids.forEach((t) => window.clearTimeout(t));
  }, []);

  const highlighted = new Set(state.areas.flatMap((a) => AREA_TO_SOLUTIONS[a]));
  const done = drawn >= ROUTE_SOLUTIONS.length;

  return (
    <div className={s.screen}>
      <StationHeader
        style={at(96, 140)}
        badge={TEXT.badge.info}
        number={3}
        title={TEXT.s3.title}
        color={node.color}
        width={700}
      />

      <div style={{ position: 'absolute', left: HUB.x - 110, top: HUB.y - 110 }}>
        <NodeButton number={3} icon="user" title={TEXT.s3.company} color={node.color} state="available" />
      </div>

      {ROUTE_SOLUTIONS.map((id, i) => {
        const def = SOLUTIONS[id];
        const cy = PILL_Y0 + i * (PILL_H + PILL_GAP) + PILL_H / 2;
        const hi = highlighted.has(id);
        return (
          <div key={id}>
            <RouteLine
              points={[{ x: HUB.x + 110, y: HUB.y }, { x: PILL_X, y: cy }]}
              progress={drawn > i ? 1 : 0}
              colors={[node.color, def.color]}
              width={1920}
              height={1280}
              strokeWidth={8}
            />
            <div
              className={s.pill}
              style={{
                ...at(PILL_X, cy - PILL_H / 2, PILL_W, PILL_H),
                ['--c' as string]: def.color,
                opacity: drawn > i ? 1 : 0.25,
                transform: hi && drawn > i ? 'scale(1.06)' : 'none',
                background: hi && drawn > i ? 'var(--navy-2)' : 'var(--navy)',
              }}
            >
              <span className={s.pillIcon}><Icon name={def.icon} size={56} /></span>
              {def.title}
            </div>
          </div>
        );
      })}

      {done && (
        <div className={s.fadeIn}>
          <CTAButton
            id="s3-continue"
            label={TEXT.cta.continue}
            onActivate={() => act({ type: 'COMPLETE_STATION', n: 3 })}
            style={{ position: 'absolute', left: 96, top: 930 }}
          />
        </div>
      )}
    </div>
  );
}
