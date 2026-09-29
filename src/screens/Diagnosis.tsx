import { AREAS, NODES, TEXT, type AreaId } from '../config/content';
import { CTAButton } from '../components/CTAButton/CTAButton';
import { Icon } from '../components/Icon/Icon';
import { StationHeader } from '../components/StationHeader/StationHeader';
import { DwellTarget } from '../interaction/DwellTarget';
import { useSession } from '../state/SessionContext';
import { at } from './layout';
import s from './screens.module.css';

const node = NODES[1]!;
const CX = 1372;
const CY = 640;
const A = 290; // semidiagonal horizontal
const B = 270; // semidiagonal vertical

// Rombo: arriba, izquierda, derecha, abajo.
const LAYOUT: ReadonlyArray<{ id: AreaId; x: number; y: number }> = [
  { id: 'vender', x: CX, y: CY - B },
  { id: 'organizar', x: CX - A, y: CY },
  { id: 'aprender', x: CX + A, y: CY },
  { id: 'conectar', x: CX, y: CY + B },
];

export function Diagnosis() {
  const { state, act } = useSession();
  const count = state.areas.length;
  const full = count === 2;

  return (
    <div className={s.screen}>
      <StationHeader
        style={at(96, 140)}
        badge={TEXT.badge.game1}
        number={2}
        title={TEXT.s2.title}
        instruction={TEXT.s2.instruction}
        color={node.color}
        width={700}
      />
      <div style={{ ...at(96, 830), fontSize: 72, fontWeight: 800 }}>{TEXT.s2.counter(count)}</div>

      {LAYOUT.map(({ id, x, y }) => {
        const def = AREAS[id];
        const selected = state.areas.includes(id);
        const dim = full && !selected;
        return (
          <div
            key={id}
            style={{
              position: 'absolute', left: x - 200, top: y - 130, width: 400,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              opacity: dim ? 0.3 : 1, transition: 'opacity 0.3s ease',
            }}
          >
            <DwellTarget
              id={`area-${id}`}
              shape="circle"
              hitboxPadding={20}
              color={def.color}
              disabled={dim}
              onActivate={() => act({ type: 'TOGGLE_AREA', area: id })}
              style={{ width: 260, height: 260 }}
            >
              {(v) => (
                <div
                  style={{
                    width: 260, height: 260, borderRadius: '50%',
                    background: selected ? def.color : 'var(--navy-2)',
                    color: selected ? 'var(--navy)' : 'var(--white)',
                    border: `8px solid ${def.color}`,
                    boxShadow: `0 0 ${selected || v.hover ? 60 : 24}px ${def.color}`,
                    transform: v.hover ? 'scale(1.08)' : 'none',
                    transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Icon name={selected ? 'check' : def.icon} size={110} />
                </div>
              )}
            </DwellTarget>
            <div className={s.t36} style={{ marginTop: 16, textAlign: 'center', width: 400 }}>{def.title}</div>
          </div>
        );
      })}

      {full && (
        <div className={s.fadeIn}>
          <CTAButton
            id="s2-continue"
            label={TEXT.cta.continue}
            onActivate={() => act({ type: 'COMPLETE_STATION', n: 2 })}
            style={{ position: 'absolute', left: 96, top: 930 }}
          />
        </div>
      )}
    </div>
  );
}
