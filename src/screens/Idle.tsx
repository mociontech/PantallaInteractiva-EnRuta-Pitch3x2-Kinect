import { useEffect } from 'react';
import { ICONS } from '../assets';
import { Background } from '../components/Background/Background';
import { CTAButton } from '../components/CTAButton/CTAButton';
import { Icon } from '../components/Icon/Icon';
import { Logo } from '../components/Logo/Logo';
import { IDLE_CATEGORIES, TEXT } from '../config/content';
import { TIMING } from '../config/experience';
import { useTracked } from '../input/useCursor';
import { useSession } from '../state/SessionContext';
import { at } from './layout';
import s from './screens.module.css';

/** Centros (x) de las 6 categorías, medidos del diseño de creatividad (2880 ÷ 1,5). */
const CAT_X = [169, 473, 782, 1077, 1379, 1675] as const;
const CAT_SIZE = 120;
const CAT_TOP = 735;

export function Idle() {
  const { act } = useSession();
  const tracked = useTracked();

  // Operador: tecla C abre la calibración.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key.toLowerCase() === 'c') act({ type: 'CALIBRATE' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [act]);

  return (
    <div className={s.screen}>
      <Background kind="idle" />

      <div style={at(96, 113)}><Logo width={450} /></div>

      <h1
        style={{
          ...at(96, 296, 1761), margin: 0, fontSize: 127, lineHeight: '130px', fontWeight: 800, color: 'var(--white)',
        }}
      >
        {TEXT.idle.titleBefore}
        <span style={{ color: 'var(--orange)' }}>{TEXT.idle.titleAccent}</span>
        {TEXT.idle.titleAfter}
      </h1>
      <p style={{ ...at(96, 565), margin: 0, fontSize: 51, lineHeight: '64px', fontWeight: 600, color: 'var(--white)', whiteSpace: 'nowrap' }}>
        {TEXT.idle.subtitle}
      </p>

      {IDLE_CATEGORIES.map((c, i) => {
        const x = CAT_X[i] as number;
        return (
          <div key={c.label}>
            {c.ownGraphic ? (
              // El SVG ya incluye círculo, icono y brillo (se extiende fuera de la caja de 120 px).
              <img
                alt=""
                src={ICONS[c.icon]}
                style={{ position: 'absolute', left: x - CAT_SIZE / 2 - 26.7, top: CAT_TOP - 24, width: 173.3, height: 173.3 }}
              />
            ) : (
              <div
                style={{
                  ...at(x - CAT_SIZE / 2, CAT_TOP, CAT_SIZE, CAT_SIZE),
                  borderRadius: '50%', background: c.color, boxShadow: `0 3px 14px ${c.color}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Icon name={c.icon} size={43} />
              </div>
            )}
            <div
              style={{
                position: 'absolute', left: x - 170, top: 875, width: 340, textAlign: 'center',
                fontSize: 33, lineHeight: '43px', fontWeight: 600, color: 'var(--white)',
              }}
            >
              {c.label}
            </div>
          </div>
        );
      })}

      <p style={{ ...at(96, 1033, 1001), margin: 0, fontSize: 51, lineHeight: '55px', fontWeight: 800, color: 'var(--white)' }}>
        {TEXT.idle.prompt}
      </p>
      <CTAButton
        id="idle-start"
        label={TEXT.idle.cta}
        dwellMs={TIMING.dwellCtaMs}
        disabled={!tracked}
        onActivate={() => act({ type: 'START' })}
        style={{ position: 'absolute', left: 1359, top: 1018 }}
      />
    </div>
  );
}
