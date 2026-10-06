import { useEffect, useRef, useState } from 'react';
import { Background } from '../components/Background/Background';
import { CTAButton } from '../components/CTAButton/CTAButton';
import { Icon } from '../components/Icon/Icon';
import { TEXT } from '../config/content';
import { COURSE, TIMING } from '../config/experience';
import { STATIC_MODE } from '../config/mode';
import { DwellTarget } from '../interaction/DwellTarget';
import { useSession } from '../state/SessionContext';
import { at } from './layout';
import s from './screens.module.css';

const CARD_X = [115, 699, 1284] as const;
const TOTAL = COURSE.points.length;

/** read: tarjetas + punto de práctica · course: recorrido por la pantalla · done: listo para continuar. */
type Phase = 'read' | 'course' | 'done';

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

function initialPhase(): Phase {
  // Solo para capturas/verificación: ?static=1&phase=course|done
  if (!STATIC_MODE) return 'read';
  const q = new URLSearchParams(window.location.search).get('phase');
  return q === 'course' || q === 'done' ? q : 'read';
}

/**
 * Cómo usar la experiencia. Primero un punto de práctica y después un recorrido por varios puntos
 * repartidos por toda la pantalla, para que el usuario sienta la sensibilidad del cursor calibrado.
 */
export function Instructions() {
  const { act } = useSession();
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [idx, setIdx] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  const onPointDone = (): void => {
    if (idx >= TOTAL - 1) {
      setPhase('done');
      return;
    }
    setWaiting(true);
    timer.current = window.setTimeout(() => {
      setIdx((i) => i + 1);
      setWaiting(false);
    }, COURSE.gapMs);
  };

  const done = phase === 'done';
  const point = COURSE.points[idx] as (typeof COURSE.points)[number];

  return (
    <div className={s.screen}>
      <Background kind="swoosh" />

      {phase === 'course' ? (
        <>
          <h1 className={s.h1} style={{ ...at(0, 120, 1920), textAlign: 'center', fontSize: 80, lineHeight: '84px' }}>
            {TEXT.instructions.course.title}
          </h1>
          <p className={s.t37} style={{ ...at(0, 215, 1920), margin: 0, textAlign: 'center' }}>
            {TEXT.instructions.course.hint}
          </p>

          {!waiting && (
            <DwellTarget
              key={idx}
              id={`course-${idx}`}
              shape="circle"
              hitboxPadding={24}
              color="var(--white)"
              dwellMs={COURSE.dwellMs}
              onActivate={onPointDone}
              style={at(point.x - COURSE.diameter / 2, point.y - COURSE.diameter / 2, COURSE.diameter, COURSE.diameter)}
            >
              {(v) => (
                <div
                  className={s.fadeIn}
                  style={{
                    width: COURSE.diameter, height: COURSE.diameter, borderRadius: '50%', boxSizing: 'border-box',
                    background: 'rgba(255, 115, 0, 0.34)', border: '8px solid var(--orange)',
                    transform: v.hover ? 'scale(1.08)' : 'none',
                    boxShadow: v.progress > 0 ? `0 0 0 ${Math.round(v.progress * 16)}px rgba(255,255,255,0.35)` : '0 0 28px var(--orange)',
                    transition: 'transform 0.25s ease',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 80, fontWeight: 800, color: 'var(--white)',
                  }}
                >
                  {idx + 1}
                </div>
              )}
            </DwellTarget>
          )}

          <div
            style={{
              ...at(0, 1090, 1920), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20,
            }}
          >
            {COURSE.points.map((p, i) => (
              <div
                key={`${p.x}-${p.y}`}
                style={{
                  width: 32, height: 32, borderRadius: '50%', boxSizing: 'border-box',
                  border: '3px solid var(--orange)', background: i < idx ? 'var(--orange)' : 'transparent',
                  opacity: i <= idx ? 1 : 0.6,
                }}
              />
            ))}
            <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--white)', marginLeft: 12 }}>
              {TEXT.instructions.course.step(idx + 1, TOTAL)}
            </span>
          </div>
        </>
      ) : (
        <>
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
            disabled={done}
            onActivate={() => setPhase('course')}
            style={at(115, 851, 220, 220)}
          >
            {(v) => (
              <div
                style={{
                  width: 220, height: 220, borderRadius: '50%', boxSizing: 'border-box',
                  background: done ? 'var(--orange)' : 'rgba(255, 115, 0, 0.34)',
                  border: '8px solid var(--orange)',
                  transform: v.hover ? 'scale(1.08)' : 'none',
                  transition: 'transform 0.25s ease',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy)',
                  boxShadow: v.progress > 0 ? `0 0 0 ${Math.round(v.progress * 14)}px rgba(255,255,255,0.35)` : 'none',
                }}
              >
                {done ? <Icon name="check" size={96} /> : <Target size={66} />}
              </div>
            )}
          </DwellTarget>
          <div style={{ ...at(387, 889, 900), fontSize: 53, lineHeight: '60px', fontWeight: 600, color: 'var(--white)' }}>
            {done ? TEXT.instructions.course.done : TEXT.instructions.practice}
          </div>

          <CTAButton
            id="instructions-continue"
            label={TEXT.instructions.cta}
            dwellMs={TIMING.dwellCtaMs}
            disabled={!done}
            onActivate={() => act({ type: 'GO', to: 'home' })}
            style={{ position: 'absolute', left: 1384, top: 885 }}
          />
        </>
      )}
    </div>
  );
}
