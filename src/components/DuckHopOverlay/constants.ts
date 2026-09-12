import type { HopDirection } from '@utils/duckHopNav';

export const DUCK_SIZE = 36;

/** Long enough to read as a flight, short enough not to lag the canvas pan. */
export const DUCK_GLIDE_MS = 380;
/** The landing squash, and how long it plays. */
export const RUBBER_HOP_MS = 580;

/* Changing level rebuilds the canvas: the duck waits, then keeps asking for a
   perch until React Flow has laid the new nodes out. */
export const DRILL_PLACE_DELAY_MS = 120;
export const DRILL_PLACE_RETRIES = 10;
/** Frames to keep trying for a perch that is not on screen yet. */
export const TELEPORT_RETRIES = 16;

export const HOP_QUACK_LINES = [
  'quack quack!',
  'quack quack',
  'quack quack?',
  'quack quack!!',
  'quack quack…',
];

export const HOP_QUACK_MIN_MS = 4_000;
export const HOP_QUACK_MAX_MS = 11_000;
/** Idle chatter fires on most, not all, of its scheduled turns. */
export const HOP_QUACK_ODDS = 0.72;

/*
 * How talkative each moment is. Bumping into something she cannot do gets a
 * complaint more often than a successful hop gets a cheer.
 */
export const QUACK_ODDS_ON_REFUSAL = 0.55;
export const QUACK_ODDS_ON_DRILL = 0.45;
export const QUACK_ODDS_ON_HOP = 0.22;

/** Below this, a hop is vertical enough that turning would just twitch. */
export const FACING_DEADZONE_PX = 8;

export const ARROW_DIRECTIONS: Record<string, HopDirection> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};
