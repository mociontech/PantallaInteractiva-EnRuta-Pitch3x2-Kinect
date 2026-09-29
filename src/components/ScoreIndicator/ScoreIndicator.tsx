import { useEffect, useRef, useState } from 'react';
import s from './ScoreIndicator.module.css';

/** Estrella + número de 56 px. Al sumar muestra un "+N" flotante. */
export function ScoreIndicator({ score }: { score: number }) {
  const prev = useRef(score);
  const [gain, setGain] = useState<{ n: number; key: number } | null>(null);

  useEffect(() => {
    const diff = score - prev.current;
    prev.current = score;
    if (diff > 0) {
      const key = Date.now();
      setGain({ n: diff, key });
      const t = window.setTimeout(() => setGain((g) => (g && g.key === key ? null : g)), 1200);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [score]);

  return (
    <div className={s.root}>
      <span className={s.star}>★</span>
      <span className={s.value}>{score}</span>
      {gain && <span key={gain.key} className={s.gain}>+{gain.n}</span>}
    </div>
  );
}
