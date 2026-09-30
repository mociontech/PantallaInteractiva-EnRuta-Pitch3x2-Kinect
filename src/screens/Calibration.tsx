import { useEffect, useRef, useState } from 'react';
import { TEXT } from '../config/content';
import { STAGE } from '../config/experience';
import { CTAButton } from '../components/CTAButton/CTAButton';
import { Icon } from '../components/Icon/Icon';
import {
  calibration, fitCalibration, rawHand, setCalibration,
  type Calibration, type CornerSample,
} from '../input/calibration';
import { link } from '../input/cursorStore';
import { useSession } from '../state/SessionContext';
import { at, centered } from './layout';
import s from './screens.module.css';

/** Puntos objetivo (px de Stage): arriba-izq, arriba-der, abajo-der, abajo-izq. */
const POINTS = [
  { x: 160, y: 260 },
  { x: STAGE.width - 160, y: 260 },
  { x: STAGE.width - 160, y: 1020 },
  { x: 160, y: 1020 },
] as const;

const HOLD_MS = 1500;
/** Máxima desviación (en anchos de hombro) respecto al promedio para considerar la mano quieta. */
const STEADY = 0.35;

type Phase = 'capture' | 'verify' | 'saved';

/** Pantalla de operador (tecla C en IDLE, Esc para salir). Calcula la zona de alcance desde 4 esquinas. */
export function CalibrationScreen() {
  const { act } = useSession();
  const [phase, setPhase] = useState<Phase>('capture');
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [lost, setLost] = useState(false);
  const [failed, setFailed] = useState(false);
  const samples = useRef<CornerSample[]>([]);
  const previous = useRef<Calibration>({ ...calibration });
  const saved = useRef(false);

  // Esc: cancelar y restaurar lo anterior.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      if (!saved.current) setCalibration(previous.current, false);
      act({ type: 'GO', to: 'idle' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [act]);

  // Captura: promedia (u, v) mientras la mano está quieta sobre el punto activo.
  useEffect(() => {
    if (phase !== 'capture') return undefined;
    let raf = 0;
    let t0: number | null = null;
    let n = 0;
    let su = 0;
    let sv = 0;
    const reset = (): void => {
      t0 = null; n = 0; su = 0; sv = 0;
      setProgress(0);
    };
    const loop = (now: number): void => {
      raf = requestAnimationFrame(loop);
      if (!rawHand.valid) {
        setLost(true);
        if (t0 !== null) reset();
        return;
      }
      setLost(false);
      if (t0 === null) t0 = now;
      if (n > 0 && Math.hypot(rawHand.u - su / n, rawHand.v - sv / n) > STEADY) {
        t0 = now; n = 0; su = 0; sv = 0;
      }
      n++; su += rawHand.u; sv += rawHand.v;
      const p = Math.min(1, (now - t0) / HOLD_MS);
      setProgress(p);
      if (p < 1) return;

      const pt = POINTS[step] as (typeof POINTS)[number];
      samples.current[step] = {
        nx: pt.x / STAGE.width, ny: pt.y / STAGE.height, u: su / n, v: sv / n,
      };
      reset();
      if (step < POINTS.length - 1) {
        setStep(step + 1);
        return;
      }
      const fit = fitCalibration(samples.current as unknown as [CornerSample, CornerSample, CornerSample, CornerSample]);
      if (fit) {
        setCalibration(fit, false); // vista previa en vivo; se guarda con "Guardar"
        setFailed(false);
        setPhase('verify');
      } else {
        setFailed(true);
        samples.current = [];
        setStep(0);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, step]);

  // Tras guardar, vuelve a IDLE.
  useEffect(() => {
    if (phase !== 'saved') return undefined;
    const t = window.setTimeout(() => act({ type: 'GO', to: 'idle' }), 1500);
    return () => window.clearTimeout(t);
  }, [phase, act]);

  const retry = (): void => {
    samples.current = [];
    setStep(0);
    setProgress(0);
    setFailed(false);
    setPhase('capture');
  };

  const save = (): void => {
    setCalibration({ ...calibration }, true);
    saved.current = true;
    setPhase('saved');
  };

  if (link.kind !== 'cam') {
    return (
      <div className={s.screen}>
        <h1 className={s.display} style={{ ...at(96, 150, 1728), fontSize: 88 }}>{TEXT.calibration.title}</h1>
        <p className={s.h2} style={at(96, 400, 1728)}>{TEXT.calibration.onlyCam}</p>
        <p className={s.t36} style={at(96, 1150)}>{TEXT.calibration.exit}</p>
      </div>
    );
  }

  const message =
    phase === 'capture'
      ? failed ? TEXT.calibration.failed : lost ? TEXT.calibration.lost : TEXT.calibration.step(step + 1, POINTS.length)
      : phase === 'verify' ? TEXT.calibration.verify : TEXT.calibration.saved;

  return (
    <div className={s.screen}>
      <h1 className={s.display} style={{ ...at(96, 150, 1728), fontSize: 88 }}>{TEXT.calibration.title}</h1>
      <p className={s.h2} style={at(96, 270, 1728)}>{phase === 'capture' && step === 0 && !failed ? TEXT.calibration.intro : message}</p>
      <p className={s.t36} style={at(96, 1150)}>{TEXT.calibration.exit}</p>

      {POINTS.map((p, i) => {
        const active = phase === 'capture' && i === step;
        const done = phase !== 'capture' || i < step;
        return (
          <div key={i} style={centered(p.x, p.y, 160, 160)}>
            <svg width="160" height="160" viewBox="0 0 160 160" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
              <circle cx="80" cy="80" r="72" fill="none" stroke="var(--muted)" strokeWidth="6" />
              {active && (
                <circle
                  cx="80" cy="80" r="72" fill="none" stroke="var(--electric)" strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 72} strokeDashoffset={2 * Math.PI * 72 * (1 - progress)}
                />
              )}
            </svg>
            <div
              style={{
                position: 'absolute', inset: 24, borderRadius: '50%',
                background: done ? 'var(--electric)' : active ? 'var(--white)' : 'var(--navy-2)',
                color: 'var(--navy)', opacity: active || done ? 1 : 0.5,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 56, fontWeight: 800,
              }}
            >
              {done ? <Icon name="check" size={64} /> : i + 1}
            </div>
          </div>
        );
      })}

      {phase === 'verify' && (
        <div className={s.fadeIn}>
          <CTAButton id="cal-save" label={TEXT.calibration.save} onActivate={save} style={{ position: 'absolute', left: 1020, top: 560 }} />
          <CTAButton id="cal-retry" label={TEXT.calibration.retry} variant="secondary" onActivate={retry} style={{ position: 'absolute', left: 480, top: 560 }} />
        </div>
      )}
    </div>
  );
}
