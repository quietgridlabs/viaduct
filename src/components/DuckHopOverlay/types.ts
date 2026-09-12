import type { QuackQuip } from '@components/QuackBubble';
import type { DuckHopPhase } from '@/state/duckHopGame';

/** Which way the duck is looking. Rotation is kept for future flourishes. */
export type DuckFacing = {
  flip: boolean;
  rotate: number;
};

/** A point in the overlay's own coordinates — its top-left is the origin. */
export type OverlayPoint = { x: number; y: number };

export type DuckSpriteProps = {
  at: OverlayPoint;
  facing: DuckFacing;
  /** Mid-flight between perches: the trip is eased rather than blinked. */
  glide: boolean;
  /** Bumped on every landing so the hop animation restarts. */
  hopTick: number;
  rubberHop: boolean;
  phase: DuckHopPhase;
  quip: QuackQuip | null;
};
