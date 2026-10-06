import { useCallback, useEffect, useRef, useState } from 'react';
import { Background } from '../components/Background/Background';
import { GrowthPlant } from '../components/GrowthPlant/GrowthPlant';
import { Icon } from '../components/Icon/Icon';
import {
  OBSTACLES, SOLUTIONS, SOLUTIONS_GRID, TEXT, type ObstacleId, type SolutionId,
} from '../config/content';
import { GAME, SCORE } from '../config/experience';
import { STATIC_MODE } from '../config/mode';
import { DwellTarget } from '../interaction/DwellTarget';
import { useSession } from '../state/SessionContext';
import { at } from './layout';
import s from './screens.module.css';

const CENTER = { x: 960, y: 640 };
const RX = 620;
const RY = 260;
/** Ángulos (grados) de los puestos alrededor de la planta; se evita abajo (planta y barra). */
const ANGLES = [-90, -45, 0, 45, 135, 180, 225] as const;
const SLOTS = ANGLES.length;
const OBSTACLE_IDS = Object.keys(OBSTACLES) as ObstacleId[];

function slotPos(slot: number): { x: number; y: number } {
  const a = ((ANGLES[slot] ?? 0) * Math.PI) / 180;
  return { x: CENTER.x + Math.cos(a) * RX, y: CENTER.y + Math.sin(a) * RY };
}

type Item =
  | { uid: number; kind: 'good'; id: SolutionId; slot: number }
  | { uid: number; kind: 'bad'; id: ObstacleId; slot: number };

interface Pop {
  uid: number;
  x: number;
  y: number;
  text: string;
}

function fmt(ms: number): string {
  const t = Math.ceil(Math.max(0, ms) / 1000);
  return `00:${String(t).padStart(2, '0')}`;
}

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)] as T;
}

export function GrowthGame() {
  const { state, act } = useSession();
  const [items, setItems] = useState<Item[]>(
    STATIC_MODE
      ? [
          { uid: 1, kind: 'good', id: 'formacion', slot: 5 },
          { uid: 2, kind: 'bad', id: 'financiacion', slot: 2 },
          { uid: 3, kind: 'good', id: 'programas', slot: 0 },
        ]
      : [],
  );
  const [pops, setPops] = useState<Pop[]>([]);
  const [left, setLeft] = useState<number>(STATIC_MODE ? 20_000 : GAME.durationMs);
  const [ended, setEnded] = useState(false);
  const itemsRef = useRef<Item[]>([]);
  const uid = useRef(0);
  itemsRef.current = items;

  const remove = useCallback((id: number) => setItems((l) => l.filter((i) => i.uid !== id)), []);

  // Temporizador y fin del juego.
  useEffect(() => {
    if (STATIC_MODE) return undefined;
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
    if (ended || STATIC_MODE) return undefined;
    const timers: number[] = [];
    const spawn = window.setInterval(() => {
      const cur = itemsRef.current;
      if (cur.length >= GAME.maxItems) return;
      const used = new Set(cur.map((i) => i.slot));
      const free = Array.from({ length: SLOTS }, (_, i) => i).filter((i) => !used.has(i));
      const slot = free[Math.floor(Math.random() * free.length)];
      if (slot === undefined) return;
      const bad = Math.random() < GAME.obstacleChance;
      const item: Item = bad
        ? { uid: ++uid.current, kind: 'bad', id: pick(OBSTACLE_IDS), slot }
        : { uid: ++uid.current, kind: 'good', id: pick(SOLUTIONS_GRID), slot };
      setItems((l) => [...l, item]);
      timers.push(window.setTimeout(() => remove(item.uid), GAME.itemLifeMs));
    }, GAME.spawnEveryMs);
    return () => {
      window.clearInterval(spawn);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [ended, remove]);

  const touch = (item: Item): void => {
    remove(item.uid);
    const p = slotPos(item.slot);
    const good = item.kind === 'good';
    act({ type: 'ADD_GAME_SCORE', points: good ? SCORE.gameItem : -GAME.obstaclePenalty });
    const pop: Pop = { uid: item.uid, x: p.x, y: p.y, text: good ? `+${SCORE.gameItem}` : `−${GAME.obstaclePenalty}` };
    setPops((l) => [...l, pop]);
    window.setTimeout(() => setPops((l) => l.filter((x) => x.uid !== pop.uid)), 900);
  };

  const barProgress = Math.min(1, state.gameScore / GAME.targetPoints);
  const stage = Math.min(4, Math.floor(barProgress * 5));

  return (
    <div className={s.screen}>
      <Background kind="swoosh" />

      {/* Cabecera del juego (diseño de creatividad) */}
      <div
        style={{
          ...at(96, 155, 96, 96), boxSizing: 'border-box', borderRadius: '50%', border: '6px solid var(--white)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56, fontWeight: 800, color: 'var(--white)',
        }}
      >
        5
      </div>
      <span
        style={{
          ...at(233, 98), boxSizing: 'border-box', fontSize: 33, fontWeight: 800, letterSpacing: 2, color: 'var(--white)',
          border: '3px solid var(--white)', borderRadius: 999, padding: '4px 36px',
        }}
      >
        {TEXT.badge.game3}
      </span>
      <p style={{ ...at(233, 164, 1200), margin: 0, fontSize: 47, lineHeight: '55px', fontWeight: 600, color: 'var(--white)', whiteSpace: 'pre-line' }}>
        {TEXT.s5.instruction}
      </p>

      <div style={at(96, 1081, 400)}>
        <div className={s.hudLabel} style={{ fontSize: 33 }}>{TEXT.s5.time}</div>
        <div className={s.hudValue}>{fmt(left)}</div>
      </div>
      <div style={{ ...at(1526, 130, 298), textAlign: 'right' }}>
        <div className={s.hudLabel}>{TEXT.s5.points}</div>
        <div className={s.hudValue}>{state.gameScore}</div>
      </div>

      <div style={{ position: 'absolute', left: CENTER.x - 180, top: 437 }}>
        <GrowthPlant stage={stage} progress={barProgress} showBar={false} />
      </div>

      {items.map((it) => {
        const def = it.kind === 'good' ? SOLUTIONS[it.id] : OBSTACLES[it.id];
        const p = slotPos(it.slot);
        return (
          <div
            key={it.uid}
            style={{
              position: 'absolute', left: p.x - 91, top: p.y - 91, width: 182, height: 182,
              animation: `itemLife ${GAME.itemLifeMs}ms linear forwards`,
            }}
          >
            <DwellTarget
              id={`item-${it.uid}`}
              mode="contact"
              shape="circle"
              hitboxPadding={0}
              color="var(--orange)"
              onActivate={() => touch(it)}
              style={{ width: 182, height: 182 }}
            >
              <div style={{ width: 182, height: 182, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div
                  style={{
                    width: 149, height: 149, borderRadius: '50%', background: 'var(--white)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Icon name={def.icon} size={80} black />
                </div>
              </div>
            </DwellTarget>
            <div
              style={{
                width: 300, marginLeft: -59, textAlign: 'center', fontSize: 28, lineHeight: '30px', fontWeight: 600, color: 'var(--white)',
              }}
            >
              {def.title}
            </div>
          </div>
        );
      })}

      {pops.map((p) => (
        <div
          key={p.uid}
          style={{
            ...at(p.x - 80, p.y - 120, 160), textAlign: 'center', fontSize: 56, fontWeight: 800,
            color: p.text.startsWith('+') ? 'var(--orange)' : 'var(--white)', animation: 'popUp 0.9s ease-out forwards',
          }}
        >
          {p.text}
        </div>
      ))}

      <div
        style={{
          ...at(96, 1023, 1728, 28), boxSizing: 'border-box', borderRadius: 14, background: 'var(--surface)',
          border: '2px solid var(--track)', overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%', background: 'var(--orange)', transformOrigin: 'left',
            transform: `scaleX(${barProgress})`, transition: 'transform 0.4s ease',
          }}
        />
      </div>

      {ended && (
        <div
          className={s.fadeIn}
          style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(2, 36, 91, 0.82)', fontSize: 110, fontWeight: 800, textAlign: 'center', padding: 96,
            color: 'var(--white)', lineHeight: '120px',
          }}
        >
          {TEXT.s5.end}
        </div>
      )}
      <style>{`
        @keyframes itemLife { 0% { opacity: 0; transform: scale(.6) } 10% { opacity: 1; transform: scale(1) } 80% { opacity: 1 } 100% { opacity: 0 } }
        @keyframes popUp { from { transform: translateY(0); opacity: 1 } to { transform: translateY(-70px); opacity: 0 } }
      `}</style>
    </div>
  );
}
