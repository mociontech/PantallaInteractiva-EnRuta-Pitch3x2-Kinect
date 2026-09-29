import { useEffect, useSyncExternalStore } from 'react';
import type { InputKind, InputProvider } from './InputProvider';
import { MediaPipeInput } from './MediaPipeInput';
import { MouseInput } from './MouseInput';
import { TouchDesignerInput } from './TouchDesignerInput';
import { getTracked, subscribeTracked } from './cursorStore';

export function resolveInputKind(): InputKind {
  const q = new URLSearchParams(window.location.search).get('input');
  if (q === 'td' || q === 'mouse' || q === 'cam') return q;
  return import.meta.env.DEV ? 'mouse' : 'cam';
}

export function createInput(kind: InputKind): InputProvider {
  if (kind === 'td') return new TouchDesignerInput();
  if (kind === 'cam') return new MediaPipeInput();
  return new MouseInput();
}

/** Arranca el InputProvider elegido por ?input= mientras la app esté montada. */
export function useInputProvider(): InputKind {
  const kind = resolveInputKind();
  useEffect(() => {
    const provider = createInput(kind);
    provider.start();
    return () => provider.stop();
  }, [kind]);
  return kind;
}

export function useTracked(): boolean {
  return useSyncExternalStore(subscribeTracked, getTracked);
}
