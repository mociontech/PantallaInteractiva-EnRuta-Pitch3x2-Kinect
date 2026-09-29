import { useState } from 'react';
import { NODES, SOLUTIONS, SOLUTIONS_GRID, TEXT, type SolutionId } from '../config/content';
import { FEATURES } from '../config/experience';
import { CTAButton } from '../components/CTAButton/CTAButton';
import { InfoCard } from '../components/InfoCard/InfoCard';
import { StationHeader } from '../components/StationHeader/StationHeader';
import { VideoContentPanel } from '../components/VideoContentPanel/VideoContentPanel';
import { DwellTarget } from '../interaction/DwellTarget';
import { useSession } from '../state/SessionContext';
import { at } from './layout';
import s from './screens.module.css';

const node = NODES[3]!;
const CARD_W = 520;
const CARD_H = 336;
const GAP = 64;
const X0 = (1920 - (3 * CARD_W + 2 * GAP)) / 2;
const Y0 = 356;

export function Solutions() {
  const { state, act } = useSession();
  const [video, setVideo] = useState<SolutionId | null>(null);
  const canContinue = state.solutionsViewed.length >= 1;

  return (
    <div className={s.screen}>
      <StationHeader
        style={at(96, 140)}
        badge={TEXT.badge.info}
        number={4}
        title={TEXT.s4.title}
        color={node.color}
        width={1100}
      />

      {SOLUTIONS_GRID.map((id, i) => {
        const def = SOLUTIONS[id];
        const col = i % 3;
        const row = Math.floor(i / 3);
        return (
          <DwellTarget
            key={id}
            id={`sol-${id}`}
            color={def.color}
            hitboxPadding={16}
            style={at(X0 + col * (CARD_W + GAP), Y0 + row * (CARD_H + GAP), CARD_W, CARD_H)}
            onActivate={() => {
              act({ type: 'VIEW_SOLUTION', id });
              if (FEATURES.solutionVideos) setVideo(id);
            }}
          >
            {(v) => (
              <InfoCard
                icon={def.icon}
                title={def.title}
                text={def.short}
                color={def.color}
                hover={v.hover}
                progress={v.progress}
                seen={state.solutionsViewed.includes(id)}
              />
            )}
          </DwellTarget>
        );
      })}

      <CTAButton
        id="s4-continue"
        label={TEXT.cta.continue}
        disabled={!canContinue}
        onActivate={() => act({ type: 'COMPLETE_STATION', n: 4 })}
        style={{ position: 'absolute', left: 1404, top: 200 }}
      />

      {video && <VideoContentPanel src={`/videos/${video}.mp4`} onEnd={() => setVideo(null)} />}
    </div>
  );
}
