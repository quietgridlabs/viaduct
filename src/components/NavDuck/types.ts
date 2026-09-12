import type { QuackQuip } from '@components/QuackBubble';
import type { ESCAPE_STEPS } from './constants';

export type EscapePhase = (typeof ESCAPE_STEPS)[number]['phase'];
export type Quip = QuackQuip;
export type Anchor = { top: number; left: number };
export type NavDuckProps = { size?: number };

export type EscapingDuckProps = {
  anchor: Anchor;
  phase: EscapePhase;
  size: number;
  quip: Quip | null;
};
