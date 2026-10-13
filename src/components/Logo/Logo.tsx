import { LOGO } from '../../assets';

/**
 * Logo "EnRuta | Cámara de Comercio Cartagena" de creatividad: 5 piezas SVG compuestas con las medidas del diseño
 * (839 × 135,6; medidas tomadas del grupo del Figma, pantalla 2880 px de ancho).
 */
const W = 839;
const H = 135.6;

export function Logo({ width = 559 }: { width?: number }) {
  const k = width / W;
  const box = (x: number, y: number, w: number, h: number) => ({
    position: 'absolute' as const, left: x * k, top: y * k, width: w * k, height: h * k,
  });
  return (
    <div style={{ position: 'relative', width: W * k, height: H * k }} role="img" aria-label="EnRuta · Cámara de Comercio de Cartagena">
      <img alt="" src={LOGO.mark} style={box(0, 0, 196.4, 135.6)} />
      <img alt="" src={LOGO.swoosh} style={box(130.5, 55.1, 139.6, 97)} />
      <img alt="" src={LOGO.detail} style={box(90.7, 62.2, 105.6, 73.4)} />
      <img alt="" src={LOGO.wordmark} style={box(228.7, 16.9, 373.1, 77.8)} />
      <img alt="" src={LOGO.camara} style={box(652, 0, 186.9, 135.6)} />
    </div>
  );
}
