import { LAYOUT, STAGE } from '../config/experience';
import { TEXT } from '../config/content';
import { ProgressIndicator } from '../components/ProgressIndicator/ProgressIndicator';
import { ScoreIndicator } from '../components/ScoreIndicator/ScoreIndicator';
import { useSession } from '../state/SessionContext';
import s from './screens.module.css';

/** Header (120 px, sin interactivos) y footer (200 px) fijos en todas las pantallas menos IDLE. */
export function Frame() {
  const { state, score } = useSession();
  if (state.screen === 'idle' || state.screen === 'instructions' || state.screen === 'calibration') return null;
  return (
    <>
      <div
        style={{
          position: 'absolute', left: LAYOUT.marginX, right: LAYOUT.marginX, top: 0, height: LAYOUT.header,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        {/* [CONFIRMAR] Logos oficiales en Fase 2 */}
        <div className={s.logoBox} style={{ width: 300, height: 88 }}>
          <span className={s.logoName} style={{ fontSize: 44 }}>{TEXT.brand}</span>
        </div>
        <div className={s.logoBox} style={{ width: 300, height: 88 }}>
          <span className={s.logoSub} style={{ letterSpacing: 2, marginTop: 0 }}>CCC</span>
        </div>
      </div>
      <div
        style={{
          position: 'absolute', left: LAYOUT.marginX, right: LAYOUT.marginX,
          top: STAGE.height - LAYOUT.footer + 80, height: 80,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <ProgressIndicator completed={state.completed.length} />
        <ScoreIndicator score={score} />
      </div>
    </>
  );
}
