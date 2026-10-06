import { BG, type BgKind } from '../../assets';

/** Fondo de pantalla completa (1920×1280): red de nodos azul y, según la pantalla, la curva naranja. */
export function Background({ kind }: { kind: BgKind }) {
  return (
    <img
      alt=""
      src={BG[kind]}
      width={1920}
      height={1280}
      style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1280, objectFit: 'cover', pointerEvents: 'none' }}
    />
  );
}
