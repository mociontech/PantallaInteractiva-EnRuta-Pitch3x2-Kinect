import { useEffect } from 'react';
import { InactivityPrompt } from './components/InactivityPrompt/InactivityPrompt';
import { STATIC_MODE, requestedScreen } from './config/mode';
import { REGISTRATION } from './config/registration';
import { serverLink } from './services/serverLink';
import { touchActivity } from './state/activity';
import { useInactivity } from './state/useInactivity';
import { useWallSync } from './state/useWallSync';
import { KinectCursor } from './components/KinectCursor/KinectCursor';
import { Stage } from './components/Stage/Stage';
import { TransitionOverlay } from './components/TransitionOverlay/TransitionOverlay';
import { DebugOverlay, isDebug } from './dev/DebugOverlay';
import { toggleTech, useTechHidden } from './dev/techUi';
import { DwellProvider } from './interaction/DwellContext';
import { useInputProvider } from './input/useCursor';
import { CalibrationScreen } from './screens/Calibration';
import { CreateAccount } from './screens/CreateAccount';
import { Diagnosis } from './screens/Diagnosis';
import { DiscoverRoute } from './screens/DiscoverRoute';
import { Frame } from './screens/Frame';
import { GrowthGame } from './screens/GrowthGame';
import { Home } from './screens/Home';
import { Idle } from './screens/Idle';
import { Instructions } from './screens/Instructions';
import { Result } from './screens/Result';
import { Solutions } from './screens/Solutions';
import { SessionProvider, useSession } from './state/SessionContext';
import type { Screen } from './state/machine';

const SCREENS: Record<Screen, () => JSX.Element> = {
  idle: Idle, instructions: Instructions, calibration: CalibrationScreen, home: Home, s1: CreateAccount, s2: Diagnosis, s3: DiscoverRoute,
  s4: Solutions, s5: GrowthGame, result: Result,
};

function Current() {
  const { state, transitioning, act } = useSession();
  useEffect(() => {
    const to = requestedScreen();
    if (to) act({ type: 'DEBUG_JUMP', to });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useWallSync();
  const warn = useInactivity();
  const View = SCREENS[state.screen];
  return (
    <>
      <View key={state.screen} />
      <Frame />
      {warn !== null && <InactivityPrompt secondsLeft={warn} onContinue={touchActivity} />}
      <TransitionOverlay active={transitioning} />
    </>
  );
}

export function App() {
  const debug = isDebug();
  const techHidden = useTechHidden();
  useInputProvider();

  // Con registro, la pared se conecta al servidor local para recibir a quien se registre en la tablet.
  useEffect(() => {
    if (!REGISTRATION.enabled) return undefined;
    serverLink.start();
    return () => serverLink.stop();
  }, []);

  useEffect(() => {
    // Con lo técnico oculto la pared se ve como en producción (sin puntero del sistema).
    document.body.dataset.kiosk = debug && !techHidden ? 'false' : 'true';
    document.body.dataset.static = STATIC_MODE ? 'true' : 'false';
    const noMenu = (e: Event): void => e.preventDefault();
    window.addEventListener('contextmenu', noMenu);
    return () => window.removeEventListener('contextmenu', noMenu);
  }, [debug, techHidden]);

  // Tecla H: oculta o muestra todo lo técnico (cámara, cajas de botones y datos). Solo con ?debug=1.
  useEffect(() => {
    if (!debug) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.toLowerCase() !== 'h') return;
      const t = e.target;
      if (t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      toggleTech();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [debug]);

  return (
    <DwellProvider>
      <Stage>
        <SessionProvider>
          <Current />
          {debug && !STATIC_MODE && !techHidden && <DebugOverlay />}
        </SessionProvider>
        {!STATIC_MODE && <KinectCursor />}
      </Stage>
    </DwellProvider>
  );
}
