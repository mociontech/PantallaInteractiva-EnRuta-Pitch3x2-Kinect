import { useEffect, useState } from 'react';
import { Background } from '../components/Background/Background';
import { NodeButton, type NodeState } from '../components/NodeButton/NodeButton';
import { RouteLine, type Point } from '../components/RouteLine/RouteLine';
import { NODES, TEXT } from '../config/content';
import { STATIC_MODE } from '../config/mode';
import { nextStation } from '../state/machine';
import { useSession } from '../state/SessionContext';
import { at } from './layout';
import s from './screens.module.css';

const NODE_W = 340;
const START_X = 200;
const STEP = 380;
/** Centro vertical de los nodos: alternan arriba/abajo (medido del diseño de creatividad). */
const Y_UP = 604;
const Y_DOWN = 724;

function centerOf(i: number): Point {
  return { x: START_X + i * STEP, y: i % 2 === 0 ? Y_UP : Y_DOWN };
}

export function Home() {
  const { state, act } = useSession();
  const c = state.completed.length;
  const next = nextStation(state);
  // La línea naranja llega hasta el nodo disponible y adelanta el siguiente tramo, como en el diseño.
  const target = Math.min(1, (c + 1) / 4);
  const [progress, setProgress] = useState(STATIC_MODE ? target : Math.max(0, c / 4));
  useEffect(() => {
    const t = window.setTimeout(() => setProgress(target), 300);
    return () => window.clearTimeout(t);
  }, [target]);

  const points = NODES.map((_, i) => centerOf(i));

  return (
    <div className={s.screen}>
      <Background kind="plain" />
      <h1 className={s.h1} style={{ ...at(0, 296, 1920), textAlign: 'center' }}>{TEXT.home.title}</h1>

      <RouteLine
        points={points}
        progress={progress}
        colors={['var(--orange)', 'var(--orange)']}
        width={1920}
        height={1280}
        strokeWidth={6}
      />
      {NODES.map((n, i) => {
        const p = centerOf(i);
        const st: NodeState = n.n <= c ? 'completed' : n.n === next ? 'available' : 'locked';
        return (
          <div key={n.n} style={{ position: 'absolute', left: p.x - NODE_W / 2, top: p.y - 110 }}>
            <NodeButton
              targetId={`node-${n.n}`}
              number={n.n}
              title={n.title}
              state={st}
              onActivate={() => act({ type: 'GO', to: `s${n.n}` as 's1' })}
            />
          </div>
        );
      })}
    </div>
  );
}
