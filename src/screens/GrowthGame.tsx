import { useCallback, useEffect, useRef, useState } from 'react';
import { NODES, SOLUTIONS, SOLUTIONS_GRID, TEXT, type SolutionId } from '../config/content';
import { GAME, SCORE } from '../config/experience';
import { GrowthPlant } from '../components/GrowthPlant/GrowthPlant';
import { Icon } from '../components/Icon/Icon';
import { DwellTarget } from '../interaction/DwellTarget';
import { useSession } from '../state/SessionContext';
import { at } from './layout';
import s from './screens.module.css';

const node = NODES[4]!;
const CENTER = { x: 960, y: 640 };
const RX = 620;
const RY = 300;
const SLOTS = 8;

function slotPos(slot: number): { x: number; y: number } {
  const a = (slot / SLOTS) * Math.PI * 2 - Math.PI / 2;
  return { x: CENTER.x + Math.cos(a) * RX, y: CENTER.y + Math.sin(a) * RY };
}

interface Item {
  uid: number;
  sol: SolutionId;
  slot: number;
}

function fmt(ms: number): string {
  const t = Math.ceil(Math.max(0, ms) / 1000);
  return `00:${String(t).padStart(2, '0')}`;
}

export function GrowthGame() {
  const { state, act } = useSession();
  const [items, setItems] = useState<Item[]>([]);
  const [left, setLeft] = useState<number>(GAME.durationMs);
  const [ended, setEnded] = useState(false);
  const itemsRef = useRef<Item[]>([]);
  const uid = useRef(0);
  itemsRef.current = items;

  const remove = useCallback((id: number) => setItems((l) => l.filter((i) => i.uid !== id)), []);

  // Temporizador y fin del juego.
  useEffect(() => {
    const t0 = performance.now() + GAME.startDelayMs;
    const iv = window.setInterval(() => {
      const remaining = GAME.durationMs - Math.max(0, performance.now() - t0);
      setLeft(remaining);
      if (remaining <= 0) {
        window.clearInterval(iv);
        setEnded(true);
        setItems([]);
      }
    }, 100);
    return () => window.clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!ended) return undefined;
    const t = window.setTimeout(() => act({ type: 'COMPLETE_STATION', n: 5 }), GAME.endHoldMs);
    return () => window.clearTimeout(t);
  }, [ended, act]);

  // Spawn: máximo GAME.maxItems a la vez, cada uno vive GAME.itemLifeMs.
  useEffect(() => {
    if (ended) return undefined;
    const timers: number[] = [];
    const spawn = window.setInterval(() => {
      const cur = itemsRef.current;
      if (cur.length >= GAME.maxItems) return;
      const used = new Set(cur.map((i) => i.slot));
      const free = Array.from({ length: SLOTS }, (_, i) => i).filter((i) => !used.has(i));
      const slot = free[Math.floor(Math.random() * free.length)];
      if (slot === undefined) return;
      const sol = SOLUTIONS_GRID[Math.floor(Math.random() * SOLUTIONS_GRID.length)] as SolutionId;
      const item: Item = { uid: ++uid.current, sol, slot };
      setItems((l) => [...l, item]);
      timers.push(window.setTimeout(() => remove(item.uid), GAME.itemLifeMs));
    }, GAME.spawnEveryMs);
    return () => {
      window.clearInterval(spawn);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [ended, remove]);

  const collect = (item: Item): void => {
    remove(item.uid);
    act({ type: 'ADD_GAME_SCORE', points: SCORE.gameItem });
  };

  const barProgress = Math.min(1, state.gameScore / GAME.targetPoints);
  const stage = Math.min(4, Math.floor(barProgress * 5));

  return (
    <div className={s.screen}>
      <div className={s.hud} style={at(96, 130)}>
        <span className={s.hudLabel}>{TEXT.s5.time}</span>
        <span className={s.hudValue}>{fmt(left)}</span>
      </div>
      <div className={s.hud} style={{ ...at(1524, 130, 300), alignItems: 'flex-end' }}>
        <span className={s.hudLabel}>{TEXT.s5.points}</span>
        <span className={s.hudValue}>{state.gameScore}</span>
      </div>
      <div style={{ ...at(360, 130, 1200), textAlign: 'center', color: node.color }}>
        <span style={{ fontSize: 28, fontWeight: 800, border: `3px solid ${node.color}`, borderRadius: 999, padding: '4px 24px' }}>
          {TEXT.badge.game2}
        </span>
        <p style={{ margin: '16px 0 0', fontSize: 36, color: 'var(--white)' }}>{TEXT.s5.instruction}</p>
      </div>

      <div style={{ position: 'absolute', left: CENTER.x - 180, top: CENTER.y - 250 }}>
        <GrowthPlant stage={stage} progress={barProgress} showBar={false} />
      </div>

      {items.map((it) => {
        const def = SOLUTIONS[it.sol];
        const p = slotPos(it.slot);
        return (
          <div
            key={it.uid}
            style={{
              position: 'absolute', left: p.x - 110, top: p.y - 110, width: 220, height: 220,
              animation: `itemLife ${GAME.itemLifeMs}ms linear forwards`,
            }}
          >
            <DwellTarget
              id={`item-${it.uid}`}
              mode="contact"
              shape="circle"
              hitboxPadding={0}
              color={def.color}
              onActivate={() => collect(it)}
              style={{ width: 220, height: 220 }}
            >
              <div style={{ width: 220, height: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div
                  style={{
                    width: 180, height: 180, borderRadius: '50%', background: def.color, color: 'var(--navy)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Icon name={def.icon} size={96} />
                </div>
              </div>
            </DwellTarget>
            <div style={{ fontSize: 28, fontWeight: 600, textAlign: 'center', width: 300, marginLeft: -40, lineHeight: 1.1 }}>
              {def.title}
            </div>
          </div>
        );
      })}

      <div
        style={{
          position: 'absolute', left: 96, top: 1010, width: 1728, height: 28, borderRadius: 14,
          background: 'var(--navy-2)', border: `3px solid ${node.color}`, overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%', background: node.color, transformOrigin: 'left',
            transform: `scaleX(${barProgress})`, transition: 'transform 0.4s ease',
          }}
        />
      </div>

      {ended && (
        <div
          className={s.fadeIn}
          style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)', fontSize: 120, fontWeight: 800, textAlign: 'center', padding: 96,
          }}
        >
          {TEXT.s5.end}
        </div>
      )}
      <style>{`@keyframes itemLife { 0% { opacity: 0; transform: scale(.6) } 10% { opacity: 1; transform: scale(1) } 80% { opacity: 1 } 100% { opacity: 0 } }`}</style>
    </div>
  );
}
