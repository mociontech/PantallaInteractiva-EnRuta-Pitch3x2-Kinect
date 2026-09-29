import { TEXT } from '../../config/content';
import { CTAButton } from '../CTAButton/CTAButton';
import s from './VideoContentPanel.module.css';

interface Props {
  src: string;
  onEnd: () => void;
}

/** Panel de 1280×720 centrado: autoplay muted, sin controles nativos, CTA "Volver". */
export function VideoContentPanel({ src, onEnd }: Props) {
  return (
    <div className={s.root}>
      <video className={s.video} src={src} autoPlay muted playsInline preload="auto" onEnded={onEnd} />
      <CTAButton label={TEXT.cta.back} variant="secondary" onActivate={onEnd} className={s.cta} />
    </div>
  );
}
