import { useEffect, useState } from 'react';
import { NODES, TEXT } from '../config/content';
import { NodeButton, type NodeState } from '../components/NodeButton/NodeButton';
import { RouteLine, type Point } from '../components/RouteLine/RouteLine';
import { nextStation } from '../state/machine';
import { useSession } from '../state/SessionContext';
import { at } from './layout';
import s from './screens.module.css';

const NODE_W = 340;
const START_X = 200;
const STEP = 380;
const BASE_Y = 640;
const AMPL = 60;

function centerOf(i: number): Point {
  return { x: START_X + i * STEP, y: BASE_Y + (i % 2 === 0 ? -AMPL : AMPL) };
}

export function Home() {
  const { state, act } = useSession();
  const c = state.completed.length;
  const next = nextStation(state);
  const target = Math.min(1, c / 4);
  // La línea avanza hasta el siguiente nodo al entrar.
  const [progress, setProgress] = useState(Math.max(0, (c - 1) / 4));
  useEffect(() => {
    const t = window.setTimeout(() => setProgress(target), 300);
    return () => window.clearTimeout(t);
  }, [target]);

  const points = NODES.map((_, i) => centerOf(i));

  return (
    <div className={s.screen}>
      <h1 className={s.display} style={{ ...at(96, 150, 1728), fontSize: 88, textAlign: 'center' }}>
        {TEXT.home.title}
      </h1>
      <RouteLine
        points={points}
        progress={progress}
        colors={NODES.map((n) => n.color)}
        width={1920}
        height={1280}
      />
      {NODES.map((n, i) => {
        const p = centerOf(i);
        const st: NodeState = n.n <= c ? 'completed' : n.n === next ? 'available' : 'locked';
        return (
          <div key={n.n} style={{ position: 'absolute', left: p.x - NODE_W / 2, top: p.y - 110 }}>
            <NodeButton
              targetId={`node-${n.n}`}
              number={n.n}
              icon={n.icon}
              title={n.title}
              color={n.color}
              state={st}
              onActivate={() => act({ type: 'GO', to: `s${n.n}` as 's1' })}
            />
          </div>
        );
      })}
    </div>
  );
}
