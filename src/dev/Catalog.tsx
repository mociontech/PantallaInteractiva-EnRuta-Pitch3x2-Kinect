import { useState, type ReactNode } from 'react';
import { NODES, SOLUTIONS } from '../config/content';
import { CTAView } from '../components/CTAButton/CTAButton';
import { GrowthPlant } from '../components/GrowthPlant/GrowthPlant';
import { InfoCard } from '../components/InfoCard/InfoCard';
import { InactivityPrompt } from '../components/InactivityPrompt/InactivityPrompt';
import { NodeButton, type NodeState } from '../components/NodeButton/NodeButton';
import { ProgressIndicator } from '../components/ProgressIndicator/ProgressIndicator';
import { QRFinal } from '../components/QRFinal/QRFinal';
import { RouteLine } from '../components/RouteLine/RouteLine';
import { ScoreIndicator } from '../components/ScoreIndicator/ScoreIndicator';
import { StationHeader } from '../components/StationHeader/StationHeader';
import { TransitionOverlay } from '../components/TransitionOverlay/TransitionOverlay';

/** /dev/components — todos los estados de cada componente (solo en desarrollo, sin escalado). */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 64 }}>
      <h2 style={{ fontSize: 28, borderBottom: '2px solid #555', paddingBottom: 8 }}>{title}</h2>
      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start' }}>{children}</div>
    </section>
  );
}

const STATES: readonly NodeState[] = ['locked', 'available', 'hover', 'completed'];

export function Catalog() {
  const [score, setScore] = useState(40);
  const [overlay, setOverlay] = useState(false);
  const n = NODES[1]!;
  const sol = SOLUTIONS.formacion;

  return (
    <div style={{ height: '100vh', overflow: 'auto', padding: 48, background: 'var(--navy)' }}>
      <h1>Catálogo de componentes</h1>

      <Section title="NodeButton">
        {STATES.map((st) => (
          <div key={st} style={{ position: 'relative' }}>
            <NodeButton number={n.n} title={st} state={st} progress={st === 'hover' ? 0.6 : 0} />
          </div>
        ))}
      </Section>

      <Section title="CTAButton (primary / secondary / hover con progreso / disabled)">
        <CTAView label="Comenzar" />
        <CTAView label="Comenzar" hover progress={0.5} />
        <CTAView label="Volver" variant="secondary" />
        <CTAView label="Continuar" disabled />
      </Section>

      <Section title="InfoCard (reposo / hover / seen)">
        <InfoCard icon={sol.icon} title={sol.title} text={sol.short} />
        <InfoCard icon={sol.icon} title={sol.title} text={sol.short} hover progress={0.5} />
        <InfoCard icon={sol.icon} title={sol.title} text={sol.short} seen />
      </Section>

      <Section title="RouteLine (0 / 0.5 / 1)">
        {[0, 0.5, 1].map((p) => (
          <div key={p} style={{ position: 'relative', width: 700, height: 140 }}>
            <RouteLine
              points={[{ x: 40, y: 70 }, { x: 250, y: 30 }, { x: 460, y: 110 }, { x: 660, y: 70 }]}
              progress={p}
              colors={['var(--orange)', 'var(--orange)']}
              width={700}
              height={140}
            />
          </div>
        ))}
      </Section>

      <Section title="ProgressIndicator / ScoreIndicator">
        <ProgressIndicator completed={2} />
        <ScoreIndicator score={score} />
        <button style={{ fontSize: 28 }} onClick={() => setScore((s) => s + 25)}>+25</button>
      </Section>

      <Section title="StationHeader">
        <StationHeader badge="JUEGO 1" number={2} title="¿Qué quieres fortalecer?" instruction="Elige 2" width={900} />
      </Section>

      <Section title="GrowthPlant (etapas 0–4)">
        {[0, 1, 2, 3, 4].map((st) => (
          <GrowthPlant key={st} stage={st} progress={st / 4} showBar={false} />
        ))}
      </Section>

      <Section title="QRFinal">
        <QRFinal url="https://example.com" />
      </Section>

      <Section title="InactivityPrompt (posición absoluta, se ve en la esquina)">
        <div style={{ position: 'relative', width: 960, height: 640, overflow: 'hidden' }}>
          <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: 1920, height: 1280 }}>
            <InactivityPrompt secondsLeft={10} onContinue={() => undefined} />
          </div>
        </div>
      </Section>

      <Section title="TransitionOverlay">
        <button style={{ fontSize: 28 }} onClick={() => { setOverlay(true); setTimeout(() => setOverlay(false), 600); }}>
          Probar barrido
        </button>
        <div style={{ position: 'relative', width: 480, height: 320, border: '2px solid #555', overflow: 'hidden' }}>
          <TransitionOverlay active={overlay} />
        </div>
      </Section>

      <p style={{ fontSize: 28 }}>
        DwellTarget, KinectCursor, VideoContentPanel y las pantallas se prueban en la app (/) con ?debug=1.
      </p>
    </div>
  );
}
