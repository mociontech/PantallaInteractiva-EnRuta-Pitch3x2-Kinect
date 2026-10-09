import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ICONS, TABLET } from '../assets';
import { OfflineError, api } from './api';
import { T, greetingName } from './content';
import s from './tablet.module.css';

const W = 1920;
const H = 1200;
const IDLE_RESET_MS = 60_000;
const DONE_RESET_MS = 15_000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Screen =
  | { name: 'attract' }
  | { name: 'cedula' }
  | { name: 'datos'; prefillNombre: string }
  | { name: 'listo'; queueId: number; nombre: string; position: number };

function Logo({ x, y, width }: { x: number; y: number; width: number }) {
  return <img alt="EnRuta" src={TABLET.logo} className={s.logo} style={{ left: x, top: y, width, height: width * (259 / 1150) }} />;
}

function Field({ y, bad, icon, children }: { y: number; bad?: boolean; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className={`${s.field} ${bad ? s.fieldBad : ''}`} style={{ top: y }}>
      {icon}
      {children}
    </div>
  );
}

const userIcon = <img alt="" src={ICONS['field-user']} className={s.fieldIcon} />;
const mailIcon = (
  <svg className={s.fieldIcon} viewBox="0 0 28 28" fill="none" stroke="#02245b" strokeWidth="2.2" strokeLinejoin="round" style={{ top: 32, width: 30, height: 30 }}>
    <rect x="2" y="5" width="24" height="18" rx="3" />
    <path d="M3 8l11 8 11-8" />
  </svg>
);

/** Para revisar el diseño sin recorrer el flujo: /registro?s=cedula|datos|listo|espera (solo con ?debug=1 o en desarrollo). */
function initialScreen(): Screen {
  const q = new URLSearchParams(window.location.search);
  if (!import.meta.env.DEV && q.get('debug') !== '1') return { name: 'attract' };
  switch (q.get('s')) {
    case 'cedula': return { name: 'cedula' };
    case 'datos': return { name: 'datos', prefillNombre: '' };
    case 'listo': return { name: 'listo', queueId: 0, nombre: 'Ana María Pérez Gómez', position: 0 };
    case 'espera': return { name: 'listo', queueId: 0, nombre: 'Ana María Pérez Gómez', position: 2 };
    default: return { name: 'attract' };
  }
}

/**
 * Tablet de registro. El diseño de creatividad cubre: inicio, validación de cédula y el enlace "Regístrate".
 * Las pantallas de datos de nuevo usuario y de confirmación siguen su estilo (pendientes de diseño).
 */
export function TabletApp() {
  const [scale, setScale] = useState(1);
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [cedula, setCedula] = useState('');
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [queueInfo, setQueueInfo] = useState<{ position: number; status: string } | null>(null);
  const resetTimer = useRef<number | null>(null);

  useEffect(() => {
    const fit = (): void => setScale(Math.min(window.innerWidth / W, window.innerHeight / H));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const goAttract = useCallback((): void => {
    setScreen({ name: 'attract' });
    setCedula('');
    setNombre('');
    setCorreo('');
    setConsent(false);
    setMessage(null);
    setTouched(false);
    setQueueInfo(null);
  }, []);

  // Vuelve al inicio tras un rato sin tocar (la persona se fue a mitad del registro).
  useEffect(() => {
    const arm = (): void => {
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
      if (screen.name === 'attract') return;
      resetTimer.current = window.setTimeout(goAttract, screen.name === 'listo' ? DONE_RESET_MS : IDLE_RESET_MS);
    };
    arm();
    window.addEventListener('pointerdown', arm);
    window.addEventListener('keydown', arm);
    return () => {
      window.removeEventListener('pointerdown', arm);
      window.removeEventListener('keydown', arm);
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    };
  }, [screen, goAttract]);

  // En la confirmación se sigue la fila en vivo.
  useEffect(() => {
    if (screen.name !== 'listo') return undefined;
    const id = screen.queueId;
    setQueueInfo({ position: screen.position, status: screen.position === 0 ? 'active' : 'waiting' });
    const iv = window.setInterval(() => {
      api.queue(id).then((q) => setQueueInfo({ position: q.position, status: q.status })).catch(() => undefined);
    }, 2000);
    return () => window.clearInterval(iv);
  }, [screen]);

  const fail = (err: unknown): void => {
    setMessage(err instanceof OfflineError ? T.errors.offline : T.errors.server);
  };

  const submitCedula = async (): Promise<void> => {
    setTouched(true);
    if (cedula.length < 5 || busy) {
      setMessage(T.cedula.invalid);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const r = await api.register(cedula);
      if (!r.ok) {
        setMessage(r.error === 'already_played' ? T.errors.alreadyPlayed : r.error === 'invalid_cedula' ? T.cedula.invalid : T.errors.server);
      } else if (r.status === 'queued') {
        setScreen({ name: 'listo', queueId: r.queueId, nombre: r.nombre, position: r.position });
      } else {
        setNombre(r.nombre ?? '');
        setTouched(false);
        setScreen({ name: 'datos', prefillNombre: r.nombre ?? '' });
      }
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const submitDatos = async (): Promise<void> => {
    setTouched(true);
    const needsCedula = cedula.length < 5;
    if (busy) return;
    if (needsCedula) return setMessage(T.cedula.invalid);
    if (nombre.trim().length < 3) return setMessage(T.datos.invalidName);
    if (!EMAIL.test(correo.trim())) return setMessage(T.datos.invalidEmail);
    if (!consent) return setMessage(T.datos.consentRequired);
    setBusy(true);
    setMessage(null);
    try {
      const r = await api.registerNew({ cedula, nombre: nombre.trim(), correo: correo.trim(), consent });
      if (!r.ok) {
        setMessage(
          r.error === 'invalid_name' ? T.datos.invalidName
            : r.error === 'invalid_email' ? T.datos.invalidEmail
              : r.error === 'consent_required' ? T.datos.consentRequired
                : r.error === 'invalid_cedula' ? T.cedula.invalid
                  : r.error === 'already_played' ? T.errors.alreadyPlayed : T.errors.server,
        );
      } else if (r.status === 'queued') {
        setScreen({ name: 'listo', queueId: r.queueId, nombre: r.nombre, position: r.position });
      }
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const stageStyle: CSSProperties = { transform: `translate(-50%, -50%) scale(${scale})` };
  const isForm = screen.name !== 'attract';

  return (
    <div className={s.wrap}>
      <div className={s.stage} style={stageStyle}>
        <img alt="" src={isForm ? TABLET.bgForm : TABLET.bgIdle} className={s.bg} />

        {screen.name === 'attract' && (
          <>
            <Logo x={385} y={386} width={1150} />
            <div className={s.attractText}>{T.attract}</div>
            <button type="button" className={s.fill} aria-label={T.attract} onClick={() => setScreen({ name: 'cedula' })} />
          </>
        )}

        {screen.name === 'cedula' && (
          <>
            <button type="button" className={`${s.link} ${s.linkBack}`} onClick={goAttract}>‹ {T.cedula.back}</button>
            <Logo x={551} y={115} width={818} />
            <div className={s.title} style={{ top: 399, height: 78, fontSize: 97, lineHeight: '78px' }}>{T.cedula.title}</div>
            <Field y={561} icon={userIcon} bad={touched && cedula.length < 5}>
              <input
                className={s.input}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                autoFocus
                maxLength={12}
                placeholder={T.cedula.placeholder}
                value={cedula}
                enterKeyHint="go"
                onChange={(e) => {
                  setCedula(e.target.value.replace(/\D/g, ''));
                  setMessage(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submitCedula();
                }}
              />
            </Field>
            <button type="button" className={s.btn} style={{ top: 723 }} disabled={busy} onClick={() => void submitCedula()}>
              {T.cedula.cta}
            </button>
            {message && <div className={s.error} style={{ top: 880 }}>{message}</div>}
            <button
              type="button"
              className={`${s.link} ${s.linkBig}`}
              style={{ top: message ? 1010 : 944 }}
              onClick={() => {
                setMessage(null);
                setTouched(false);
                setScreen({ name: 'datos', prefillNombre: '' });
              }}
            >
              {T.cedula.register}
            </button>
          </>
        )}

        {screen.name === 'datos' && (
          <DatosForm
            confirm={screen.prefillNombre !== ''}
            needsCedula={cedula.length < 5}
            cedula={cedula}
            nombre={nombre}
            correo={correo}
            consent={consent}
            touched={touched}
            busy={busy}
            message={message}
            onCedula={(v) => { setCedula(v); setMessage(null); }}
            onNombre={(v) => { setNombre(v); setMessage(null); }}
            onCorreo={(v) => { setCorreo(v); setMessage(null); }}
            onConsent={() => { setConsent((c) => !c); setMessage(null); }}
            onBack={() => { setMessage(null); setScreen({ name: 'cedula' }); }}
            onSubmit={() => void submitDatos()}
          />
        )}

        {screen.name === 'listo' && (
          <>
            <Logo x={551} y={115} width={818} />
            <div className={s.check}>✓</div>
            <div className={s.hello}>{T.listo.hello(greetingName(screen.nombre))}</div>
            <div className={s.sub}>
              {queueInfo?.status === 'playing' ? T.listo.playing
                : (queueInfo?.position ?? screen.position) === 0 ? T.listo.turn
                  : T.listo.waiting(queueInfo?.position ?? screen.position)}
            </div>
            {(queueInfo?.position ?? screen.position) > 0 && <div className={s.hint}>{T.listo.waitingHint}</div>}
            <button type="button" className={`${s.btn} ${s.btnWide} ${s.btnGhost}`} style={{ top: 930 }} onClick={goAttract}>
              {T.listo.next}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

interface DatosProps {
  /** La base ya conocía a la persona (nombre prefijado): solo falta el correo. */
  confirm: boolean;
  needsCedula: boolean;
  cedula: string;
  nombre: string;
  correo: string;
  consent: boolean;
  touched: boolean;
  busy: boolean;
  message: string | null;
  onCedula: (v: string) => void;
  onNombre: (v: string) => void;
  onCorreo: (v: string) => void;
  onConsent: () => void;
  onBack: () => void;
  onSubmit: () => void;
}

/** Datos de quien no está en la base: más compacto para que el teclado no tape los campos. */
function DatosForm(p: DatosProps) {
  const first = 330;
  const step = 120;
  let row = 0;
  const y = (): number => first + step * row++;
  const yCedula = p.needsCedula ? y() : 0;
  const yNombre = y();
  const yCorreo = y();
  const yConsent = first + step * row + 4;
  const yButton = yConsent + 150;
  return (
    <>
      <button type="button" className={`${s.link} ${s.linkBack}`} onClick={p.onBack}>‹ {T.datos.back}</button>
      <Logo x={680} y={60} width={560} />
      <div
        className={s.title}
        style={{ top: 205, height: 90, fontSize: p.confirm ? 72 : 80, lineHeight: '90px', left: 360, width: 1200, whiteSpace: 'nowrap' }}
      >
        {p.confirm ? T.datos.confirmTitle : T.datos.title}
      </div>

      {p.needsCedula && (
        <Field y={yCedula} icon={userIcon} bad={p.touched && p.cedula.length < 5}>
          <input
            className={s.input} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" maxLength={12}
            placeholder={T.datos.cedula} value={p.cedula} enterKeyHint="next"
            onChange={(e) => p.onCedula(e.target.value.replace(/\D/g, ''))}
          />
        </Field>
      )}
      <Field y={yNombre} icon={userIcon} bad={p.touched && p.nombre.trim().length < 3}>
        <input
          className={s.input} type="text" autoComplete="off" autoCapitalize="words" maxLength={120}
          placeholder={T.datos.nombre} value={p.nombre} enterKeyHint="next"
          onChange={(e) => p.onNombre(e.target.value)}
        />
      </Field>
      <Field y={yCorreo} icon={mailIcon} bad={p.touched && !EMAIL.test(p.correo.trim())}>
        <input
          className={s.input} type="email" inputMode="email" autoComplete="off" autoCapitalize="none" maxLength={120}
          placeholder={T.datos.correo} value={p.correo} enterKeyHint="done"
          onChange={(e) => p.onCorreo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
      </Field>

      <button type="button" className={s.consent} style={{ top: yConsent }} onClick={p.onConsent}>
        <span className={`${s.box} ${p.consent ? s.boxOn : ''} ${p.touched && !p.consent ? s.boxBad : ''}`}>{p.consent ? '✓' : ''}</span>
        <span className={s.consentText}>{T.datos.consent}</span>
      </button>

      <button type="button" className={s.btn} style={{ top: yButton }} disabled={p.busy} onClick={p.onSubmit}>
        {T.datos.cta}
      </button>
      {p.message && <div className={s.error} style={{ top: yButton + 150 > 1100 ? yButton - 120 : yButton + 150 }}>{p.message}</div>}
    </>
  );
}
