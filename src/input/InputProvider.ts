export type InputKind = 'td' | 'mouse' | 'cam';
export type LinkStatus = 'connecting' | 'open' | 'closed' | 'n/a';

/** Señal normalizada. x,y en 0..1 relativos al Stage; y=0 arriba. */
export interface InputSample {
  x: number;
  y: number;
  tracked: boolean;
}

export interface InputProvider {
  readonly kind: InputKind;
  start(): void;
  stop(): void;
}
