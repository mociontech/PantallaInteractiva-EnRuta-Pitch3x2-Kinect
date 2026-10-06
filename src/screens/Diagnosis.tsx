import { Background } from '../components/Background/Background';
import { CTAButton } from '../components/CTAButton/CTAButton';
import { Icon } from '../components/Icon/Icon';
import { StationHeader } from '../components/StationHeader/StationHeader';
import { AREAS, AREA_ORDER, TEXT, type AreaId } from '../config/content';
import { DwellTarget } from '../interaction/DwellTarget';
import { useSession } from '../state/SessionContext';
import { at } from './layout';
import s from './screens.module.css';

const D = 230; // diámetro (345 ÷ 1,5)
/** Rombo medido del diseño de creatividad (centros de los círculos). */
const CENTERS: Record<AreaId, { x: number; y: number }> = {
  vender: { x: 1393, y: 460 },
  organizar: { x: 1137, y: 699 },
  aprender: { x: 1650, y: 699 },
  conectar: { x: 1393, y: 937 },
};

export function Diagnosis() {
  const { state, act } = useSession();
  const count = state.areas.length;
  const full = count === 2;

  return (
    <div className={s.screen}>
      <Background kind="plain" />
      <StationHeader
        style={at(113, 225)}
        badge={TEXT.badge.game1}
        number={2}
        title={TEXT.s2.title}
        width={745}
      />
      <p style={{ ...at(241, 624, 718), margin: 0, fontSize: 37, lineHeight: '43px', fontWeight: 600, color: 'var(--white)' }}>
        {TEXT.s2.description}
      </p>
      <div style={{ ...at(113, 911), fontSize: 67, lineHeight: '72px', fontWeight: 800, color: 'var(--white)' }}>
        {TEXT.s2.counter(count)}
      </div>
      <div className={s.t37} style={at(1330, 235)}>{TEXT.s2.pick}</div>

      {AREA_ORDER.map((id) => {
        const def = AREAS[id];
        const c = CENTERS[id];
        const selected = state.areas.includes(id);
        const dim = full && !selected;
        return (
          <div
            key={id}
            style={{
              position: 'absolute', left: c.x - 177, top: c.y - D / 2, width: 354,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              opacity: dim ? 0.3 : 1, transition: 'opacity 0.3s ease',
            }}
          >
            <DwellTarget
              id={`area-${id}`}
              shape="circle"
              hitboxPadding={20}
              color="var(--white)"
              disabled={dim}
              onActivate={() => act({ type: 'TOGGLE_AREA', area: id })}
              style={{ width: D, height: D }}
            >
              {(v) => (
                <div
                  style={{
                    width: D, height: D, borderRadius: '50%', boxSizing: 'border-box',
                    background: selected ? 'var(--orange)' : 'var(--surface)',
                    border: '7px solid var(--orange)',
                    boxShadow: `0 0 ${selected || v.hover ? 32 : 16}px var(--orange)`,
                    transform: v.hover ? 'scale(1.06)' : 'none',
                    transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--black)',
                  }}
                >
                  {selected ? <Icon name="check" size={110} /> : <Icon name={def.iconLight} size={90} white />}
                </div>
              )}
            </DwellTarget>
            <div
              style={{
                marginTop: 14, width: 354, textAlign: 'center', textTransform: 'uppercase',
                fontSize: 28, lineHeight: '36px', fontWeight: 600, color: 'var(--white)',
              }}
            >
              {def.title}
            </div>
          </div>
        );
      })}

      <CTAButton
        id="s2-continue"
        label={TEXT.cta.continue}
        disabled={!full}
        onActivate={() => act({ type: 'COMPLETE_STATION', n: 2 })}
        style={{ position: 'absolute', left: 113, top: 1011 }}
      />
    </div>
  );
}
