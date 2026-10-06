import { useEffect, useState } from 'react';
import { ICONS } from '../assets';
import { Background } from '../components/Background/Background';
import { CTAButton } from '../components/CTAButton/CTAButton';
import { QRFinal } from '../components/QRFinal/QRFinal';
import { AREAS, NODES, TEXT } from '../config/content';
import { QR, TIMING } from '../config/experience';
import { useSession } from '../state/SessionContext';
import { at } from './layout';
import s from './screens.module.css';

const ROUTE_Y = 874;

export function Result() {
  const { state, score, act } = useSession();
  const [left, setLeft] = useState<number>(TIMING.resultCountdownMs);

  useEffect(() => {
    const t0 = performance.now();
    const iv = window.setInterval(() => {
      const remaining = TIMING.resultCountdownMs - (performance.now() - t0);
      setLeft(remaining);
      if (remaining <= 0) {
        window.clearInterval(iv);
        act({ type: 'RESET' });
      }
    }, 250);
    return () => window.clearInterval(iv);
  }, [act]);

  const url = QR.appendSessionId && state.sessionId ? `${QR.url}?s=${state.sessionId}` : QR.url;

  return (
    <div className={s.screen}>
      <Background kind="plain" />

      <h1 style={{ ...at(96, 196), margin: 0, fontSize: 127, lineHeight: '143px', fontWeight: 800, color: 'var(--white)', whiteSpace: 'nowrap' }}>
        {TEXT.result.title}
      </h1>

      <div style={at(95, 545)}>
        <div className={s.t33}>{TEXT.result.score}</div>
        <div style={{ fontSize: 67, lineHeight: '72px', fontWeight: 800, color: 'var(--white)' }}>{score}</div>
      </div>

      <div style={{ ...at(95, 684, 800), display: 'flex', flexDirection: 'column', gap: 16 }}>
        <span className={s.t33}>{TEXT.result.areas}</span>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {state.areas.map((a) => (
            <span key={a} className={s.chip}>{AREAS[a].title}</span>
          ))}
        </div>
      </div>

      <img
        alt=""
        src={ICONS['plant-final']}
        style={{ position: 'absolute', left: 900, top: 353, width: 324, height: 414 }}
      />

      {/* Ruta completa: 5 hitos naranja unidos por una línea */}
      <div style={{ ...at(96 + 44, ROUTE_Y + 42, 760, 5), background: 'var(--orange)' }} />
      {NODES.map((n, i) => (
        <div
          key={n.n}
          style={{
            ...at(96 + i * 190, ROUTE_Y, 88, 88), borderRadius: '50%', background: 'var(--orange)', color: 'var(--navy)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 800,
          }}
        >
          ✓
        </div>
      ))}

      <div style={at(1307, 395)}><QRFinal url={url} /></div>

      <div className={s.t33} style={{ ...at(0, 1027, 500), textAlign: 'right' }}>
        {TEXT.result.countdown(Math.ceil(Math.max(0, left) / 1000))}
      </div>
      <CTAButton
        id="result-restart"
        label={TEXT.result.restart}
        dwellMs={TIMING.dwellCtaMs}
        onActivate={() => act({ type: 'RESET' })}
        style={{ position: 'absolute', left: 96, top: 1083 }}
      />
    </div>
  );
}
