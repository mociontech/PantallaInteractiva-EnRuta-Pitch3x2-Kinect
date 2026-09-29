import { useEffect, useSyncExternalStore } from 'react';
import type { InputKind, InputProvider } from './InputProvider';
import { MouseInput } from './MouseInput';
import { TouchDesignerInput } from './TouchDesignerInput';
import { getTracked, subscribeTracked } from './cursorStore';

export function resolveInputKind(): InputKind {
  const q = new URLSearchParams(window.location.search).get('input');
  if (q === 'td' || q === 'mouse') return q;
  return import.meta.env.DEV ? 'mouse' : 'td';
}

export function createInput(kind: InputKind): InputProvider {
  return kind === 'td' ? new TouchDesignerInput() : new MouseInput();
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
