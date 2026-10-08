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
  useInputProvider();

  // Con registro, la pared se conecta al servidor local para recibir a quien se registre en la tablet.
  useEffect(() => {
    if (!REGISTRATION.enabled) return undefined;
    serverLink.start();
    return () => serverLink.stop();
  }, []);

  useEffect(() => {
    document.body.dataset.kiosk = debug ? 'false' : 'true';
    document.body.dataset.static = STATIC_MODE ? 'true' : 'false';
    const noMenu = (e: Event): void => e.preventDefault();
    window.addEventListener('contextmenu', noMenu);
    return () => window.removeEventListener('contextmenu', noMenu);
  }, [debug]);

  return (
    <DwellProvider>
      <Stage>
        <SessionProvider>
          <Current />
          {debug && !STATIC_MODE && <DebugOverlay />}
        </SessionProvider>
        {!STATIC_MODE && <KinectCursor />}
      </Stage>
    </DwellProvider>
  );
}
