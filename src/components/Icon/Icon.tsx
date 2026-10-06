import { ICONS } from '../../assets';

/** Glifos de texto para lo que no es un SVG de creatividad. */
const GLYPHS: Record<string, string> = { check: '✓' };

interface Props {
  name: string;
  size?: number;
  /** Fuerza el icono a blanco (los SVG de creatividad vienen en negro o blanco). */
  white?: boolean;
  /** Fuerza el icono a negro. */
  black?: boolean;
}

/** Icono de marca (SVG de Figma) dentro de una caja cuadrada de `size` px. */
export function Icon({ name, size = 64, white = false, black = false }: Props) {
  const src = ICONS[name];
  if (src) {
    return (
      <img
        alt=""
        src={src}
        width={size}
        height={size}
        style={{
          objectFit: 'contain',
          display: 'block',
          filter: white ? 'brightness(0) invert(1)' : black ? 'brightness(0)' : undefined,
        }}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size, fontSize: Math.max(28, size * 0.7), fontWeight: 800, lineHeight: 1,
      }}
    >
      {GLYPHS[name] ?? '●'}
    </span>
  );
}
