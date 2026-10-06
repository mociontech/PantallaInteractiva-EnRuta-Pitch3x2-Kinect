import type { CSSProperties } from 'react';
import { TIMING } from '../../config/experience';
import { DwellTarget } from '../../interaction/DwellTarget';
import s from './CTAButton.module.css';

interface ViewProps {
  label: string;
  variant?: 'primary' | 'secondary';
  progress?: number;
  hover?: boolean;
  disabled?: boolean;
  /** Ancho en px (alto fijo 140). Por defecto 420. */
  width?: number;
}

/** Solo visual: pastilla naranja con texto azul de 48 px. El dwell llena el botón de izquierda a derecha. */
export function CTAView({ label, variant = 'primary', progress = 0, hover = false, disabled = false, width = 420 }: ViewProps) {
  return (
    <div
      className={`${s.btn} ${s[variant]} ${hover ? s.hover : ''} ${disabled ? s.disabled : ''}`}
      style={{ width }}
    >
      <div className={s.fill} style={{ transform: `scaleX(${progress})` }} />
      <span className={s.label}>{label}</span>
    </div>
  );
}

interface Props {
  label: string;
  onActivate: () => void;
  variant?: 'primary' | 'secondary';
  /** 1500 ms para CTAs críticos (Comenzar, Volver a empezar). */
  dwellMs?: number;
  disabled?: boolean;
  width?: number;
  id?: string;
  className?: string;
  style?: CSSProperties;
}

export function CTAButton({
  label, onActivate, variant = 'primary', dwellMs = TIMING.dwellMs, disabled, width = 420, id, className, style,
}: Props) {
  return (
    <DwellTarget
      id={id}
      onActivate={onActivate}
      dwellMs={dwellMs}
      disabled={disabled}
      hitboxPadding={20}
      color="var(--navy)"
      className={className}
      style={{ width, height: 140, ...style }}
    >
      {(v) => (
        <CTAView label={label} variant={variant} progress={v.progress} hover={v.hover} disabled={disabled} width={width} />
      )}
    </DwellTarget>
  );
}
