import { useState } from 'react';
import { Background } from '../components/Background/Background';
import { CTAButton } from '../components/CTAButton/CTAButton';
import { InfoCard } from '../components/InfoCard/InfoCard';
import { StationHeader } from '../components/StationHeader/StationHeader';
import { VideoContentPanel } from '../components/VideoContentPanel/VideoContentPanel';
import { SOLUTIONS, SOLUTIONS_GRID, TEXT, type SolutionId } from '../config/content';
import { FEATURES } from '../config/experience';
import { DwellTarget } from '../interaction/DwellTarget';
import { useSession } from '../state/SessionContext';
import { at } from './layout';
import s from './screens.module.css';

const CARD_W = 476;
const CARD_H = 307;
const COL_X = [187, 722, 1256] as const;
const ROW_Y = [351, 717] as const;

export function Solutions() {
  const { state, act } = useSession();
  const [video, setVideo] = useState<SolutionId | null>(null);
  const seen = state.solutionsViewed.length;
  const allSeen = seen >= SOLUTIONS_GRID.length;

  return (
    <div className={s.screen}>
      <Background kind="plain" />
      <StationHeader
        style={at(183, 139)}
        badge={TEXT.badge.info}
        number={4}
        title={TEXT.s4.title}
        titleSize={67}
        width={1500}
      />

      {SOLUTIONS_GRID.map((id, i) => {
        const def = SOLUTIONS[id];
        return (
          <DwellTarget
            key={id}
            id={`sol-${id}`}
            color="var(--orange)"
            hitboxPadding={16}
            style={at(COL_X[i % 3] as number, ROW_Y[Math.floor(i / 3)] as number, CARD_W, CARD_H)}
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
        label={TEXT.s4.cta}
        width={805}
        disabled={seen < 1}
        onActivate={() => act({ type: 'COMPLETE_STATION', n: 4 })}
        style={{ position: 'absolute', left: 116, top: 1088 }}
      />
      {allSeen && (
        <p className={`${s.t33} ${s.fadeIn}`} style={{ ...at(960, 1086, 690), margin: 0 }}>{TEXT.s4.allSeen}</p>
      )}

      {video && <VideoContentPanel src={`/videos/${video}.mp4`} onEnd={() => setVideo(null)} />}
    </div>
  );
}
