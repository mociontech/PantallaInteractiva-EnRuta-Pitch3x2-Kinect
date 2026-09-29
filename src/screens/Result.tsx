import { useEffect, useState } from 'react';
import { AREAS, NODES, TEXT } from '../config/content';
import { QR, TIMING } from '../config/experience';
import { CTAButton } from '../components/CTAButton/CTAButton';
import { GrowthPlant } from '../components/GrowthPlant/GrowthPlant';
import { QRFinal } from '../components/QRFinal/QRFinal';
import { RouteLine, type Point } from '../components/RouteLine/RouteLine';
import { useSession } from '../state/SessionContext';
import { at } from './layout';
import s from './screens.module.css';

const ROUTE_Y = 960;
const routePts: Point[] = NODES.map((_, i) => ({ x: 160 + i * 190, y: ROUTE_Y }));

export function Result() {
  const { state, score, act } = useSession();
  const [left, setLeft] = useState<number>(TIMING.resultCountdownMs);
  const [routeProgress, setRouteProgress] = useState(0);

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
    const p = window.setTimeout(() => setRouteProgress(1), 300);
    return () => {
      window.clearInterval(iv);
      window.clearTimeout(p);
    };
  }, [act]);

  const url = QR.appendSessionId && state.sessionId ? `${QR.url}?s=${state.sessionId}` : QR.url;

  return (
    <div className={s.screen}>
      <h1 className={s.display} style={{ ...at(96, 130, 1200), fontSize: 140 }}>{TEXT.result.title}</h1>

      <div className={s.hud} style={at(96, 330)}>
        <span className={s.hudLabel}>{TEXT.result.score}</span>
        <span className={s.hudValue}>{score}</span>
      </div>

      <div style={{ ...at(96, 470, 800), display: 'flex', flexDirection: 'column', gap: 16 }}>
        <span className={s.hudLabel}>{TEXT.result.areas}</span>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {state.areas.map((a) => (
            <span key={a} className={s.chip} style={{ ['--c' as string]: AREAS[a].color }}>{AREAS[a].title}</span>
          ))}
        </div>
      </div>

      <div style={{ position: 'absolute', left: 900, top: 330, transform: 'scale(0.9)', transformOrigin: 'top left' }}>
        <GrowthPlant stage={4} progress={1} showBar={false} />
      </div>

      <RouteLine
        points={routePts}
        progress={routeProgress}
        colors={NODES.map((n) => n.color)}
        width={1000}
        height={1280}
        strokeWidth={10}
      />
      {NODES.map((n, i) => (
        <div
          key={n.n}
          style={{
            position: 'absolute', left: (routePts[i] as Point).x - 44, top: ROUTE_Y - 44,
            width: 88, height: 88, borderRadius: '50%', background: n.color, color: 'var(--navy)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 800,
          }}
        >
          ✓
        </div>
      ))}

      <div style={at(1344, 220)}><QRFinal url={url} /></div>

      <CTAButton
        id="result-restart"
        label={TEXT.result.restart}
        dwellMs={TIMING.dwellCtaMs}
        onActivate={() => act({ type: 'RESET' })}
        style={{ position: 'absolute', left: 1404, top: 930 }}
      />
      <div className={s.hudLabel} style={{ ...at(1000, 985, 380), textAlign: 'right' }}>
        {TEXT.result.countdown(Math.ceil(Math.max(0, left) / 1000))}
      </div>
    </div>
  );
}
