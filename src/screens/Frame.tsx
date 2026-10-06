import { ExitButton } from '../components/ExitButton/ExitButton';
import { Logo } from '../components/Logo/Logo';
import { ProgressIndicator } from '../components/ProgressIndicator/ProgressIndicator';
import { ScoreIndicator } from '../components/ScoreIndicator/ScoreIndicator';
import { TEXT } from '../config/content';
import { LAYOUT } from '../config/experience';
import type { Screen } from '../state/machine';
import { useSession } from '../state/SessionContext';

interface Chrome {
  logo?: boolean;
  exit?: boolean;
  progress?: boolean;
  /** Puntaje: posición vertical (px de Stage); siempre alineado al margen derecho. */
  scoreTop?: number;
}

/**
 * Cromo por pantalla, según el diseño de creatividad: solo HOME lleva logo, SALIR y progreso;
 * el puntaje cambia de lugar entre pantallas; el juego (Estación 5) usa su propio HUD.
 */
const CHROME: Partial<Record<Screen, Chrome>> = {
  home: { logo: true, exit: true, progress: true, scoreTop: 1160 },
  s2: { scoreTop: 1160 },
  s3: { scoreTop: 77 },
  s4: { scoreTop: 1160 },
  result: { scoreTop: 1160 },
};

export function Frame() {
  const { state, score, act } = useSession();
  const c = CHROME[state.screen];
  if (!c) return null;
  const right = LAYOUT.marginX;
  return (
    <>
      {c.logo && (
        <div style={{ position: 'absolute', left: LAYOUT.marginX, top: 92 }}>
          <Logo width={331} />
        </div>
      )}
      {c.exit && (
        <div style={{ position: 'absolute', right, top: 108 }}>
          <ExitButton label={TEXT.home.exit} onActivate={() => act({ type: 'GO', to: 'idle' })} />
        </div>
      )}
      {c.progress && (
        <div style={{ position: 'absolute', left: LAYOUT.marginX, top: 1160, height: 80, display: 'flex', alignItems: 'center' }}>
          <ProgressIndicator completed={state.completed.length} />
        </div>
      )}
      {c.scoreTop !== undefined && (
        <div style={{ position: 'absolute', right, top: c.scoreTop, height: 80, display: 'flex', alignItems: 'center' }}>
          <ScoreIndicator score={score} />
        </div>
      )}
    </>
  );
}
