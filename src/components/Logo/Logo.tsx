import { LOGO } from '../../assets';

/** El logo EnRuta de creatividad viene en 4 piezas SVG; se componen con las medidas del diseño (497×112). */
const W = 497.12;
const H = 112;

export function Logo({ width = 331 }: { width?: number }) {
  const k = width / W;
  const px = (n: number): number => n * k;
  return (
    <div style={{ position: 'relative', width: px(W), height: px(H) }} role="img" aria-label="EnRuta Empresarial">
      <img alt="" src={LOGO.wordmark} style={{ position: 'absolute', left: px(188.92), top: px(13.96), width: px(308.2), height: px(64.3) }} />
      <img alt="" src={LOGO.mark} style={{ position: 'absolute', left: 0, top: 0, width: px(162.26), height: px(112) }} />
      <img alt="" src={LOGO.markDetail} style={{ position: 'absolute', left: px(74.99), top: px(51.34), width: px(87.27), height: px(60.66) }} />
      <img alt="" src={LOGO.sub} style={{ position: 'absolute', left: px(188.91), top: px(94.4), width: px(308.2), height: px(16.54) }} />
    </div>
  );
}
