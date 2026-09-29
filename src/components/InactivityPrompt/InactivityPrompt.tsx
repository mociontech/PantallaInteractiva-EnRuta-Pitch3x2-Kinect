import { TEXT } from '../../config/content';
import { CTAButton } from '../CTAButton/CTAButton';
import s from './InactivityPrompt.module.css';

interface Props {
  secondsLeft: number;
  onContinue: () => void;
}

/** Overlay "¿Sigues ahí?" con cuenta regresiva y CTA "Continuar". */
export function InactivityPrompt({ secondsLeft, onContinue }: Props) {
  return (
    <div className={s.root}>
      <div className={s.title}>{TEXT.inactivity.title}</div>
      <div className={s.count}>{secondsLeft}</div>
      <CTAButton label={TEXT.inactivity.cta} onActivate={onContinue} />
    </div>
  );
}
