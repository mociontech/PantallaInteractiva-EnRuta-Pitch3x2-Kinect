import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { DwellEngine } from './engine';

const DwellCtx = createContext<DwellEngine | null>(null);

export function DwellProvider({ children }: { children: ReactNode }) {
  const engine = useMemo(() => new DwellEngine(), []);
  useEffect(() => {
    engine.start();
    return () => engine.stop();
  }, [engine]);
  return <DwellCtx.Provider value={engine}>{children}</DwellCtx.Provider>;
}

export function useDwellEngine(): DwellEngine {
  const e = useContext(DwellCtx);
  if (!e) throw new Error('useDwellEngine requiere <DwellProvider>');
  return e;
}
