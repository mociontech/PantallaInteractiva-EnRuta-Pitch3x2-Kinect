import { useEffect } from 'react';
import { KinectCursor } from './components/KinectCursor/KinectCursor';
import { Stage } from './components/Stage/Stage';
import { TransitionOverlay } from './components/TransitionOverlay/TransitionOverlay';
import { DebugOverlay, isDebug } from './dev/DebugOverlay';
import { DwellProvider } from './interaction/DwellContext';
import { useInputProvider } from './input/useCursor';
import { CreateAccount } from './screens/CreateAccount';
import { Diagnosis } from './screens/Diagnosis';
import { DiscoverRoute } from './screens/DiscoverRoute';
import { Frame } from './screens/Frame';
import { GrowthGame } from './screens/GrowthGame';
import { Home } from './screens/Home';
import { Idle } from './screens/Idle';
import { Result } from './screens/Result';
import { Solutions } from './screens/Solutions';
import { SessionProvider, useSession } from './state/SessionContext';
import type { Screen } from './state/machine';

const SCREENS: Record<Screen, () => JSX.Element> = {
  idle: Idle, home: Home, s1: CreateAccount, s2: Diagnosis, s3: DiscoverRoute,
  s4: Solutions, s5: GrowthGame, result: Result,
};

function Current() {
  const { state, transitioning } = useSession();
  const View = SCREENS[state.screen];
  return (
    <>
      <View key={state.screen} />
      <Frame />
      <TransitionOverlay active={transitioning} />
    </>
  );
}

export function App() {
  useInputProvider();
  const debug = isDebug();

  useEffect(() => {
    document.body.dataset.kiosk = debug ? 'false' : 'true';
    const noMenu = (e: Event): void => e.preventDefault();
    window.addEventListener('contextmenu', noMenu);
    return () => window.removeEventListener('contextmenu', noMenu);
  }, [debug]);

  return (
    <DwellProvider>
      <Stage>
        <SessionProvider>
          <Current />
          {debug && <DebugOverlay />}
        </SessionProvider>
        <KinectCursor />
      </Stage>
    </DwellProvider>
  );
}
