/** Placeholder de iconografía (Fase 2 reemplaza por SVG de marca). */
const GLYPHS: Record<string, string> = {
  user: '☺', chart: '▲', route: '⤳', grid: '▦', plant: '✿', book: '▤', expert: '★',
  flag: '⚑', network: '⚭', info: 'i', calendar: '▣', gear: '⚙', bolt: '↯', mail: '✉',
  list: '≡', hand: '✋', target: '◎', lock: '🔒', check: '✓',
};

export function Icon({ name, size = 64 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size, fontSize: Math.max(28, size * 0.6), fontWeight: 800, lineHeight: 1,
      }}
    >
      {GLYPHS[name] ?? '●'}
    </span>
  );
}
