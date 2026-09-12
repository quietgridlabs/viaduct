import { QUACK_BUBBLE_MS } from '@components/QuackBubble';

/** Where the duck sends you. Kept short — the bubble has to stay small. */
export const QUACK_ERRANDS = [
  'go to ponder',
  'go to refactor',
  'go to bikeshed',
  'go to yak-shave',
  'draw more boxes',
  'go to blame the cache',
  'go to rename things',
  'go to procrastinate',
  'go to touch grass',
  'take a nap',
  'go to ship it',
  'go to waddle',
  'go to you will be free!',
  'free your mind',
  'release the kraken',
  'drink water',
  'take a break',
  'you are better than you think',
  'go catch some waves',
  'six seven',
  'bombordiro crocodilo',
  'dont break my heart',
] as const;

export const BUBBLE_MS = QUACK_BUBBLE_MS;

/** How often a click sends the duck off on its donation guilt-trip. */
export const ESCAPE_ODDS = 0.18;

/** Escape geometry, in px relative to the duck's spot in the system bar. */
export const DROP_Y = 52;
export const OFFSCREEN_MARGIN = 32;
export const PEEK_VISIBLE = 15;

/**
 * The escapade, step by step. Each step owns its transform, how long the move
 * takes, and how long it lingers before the next one.
 */
export const ESCAPE_STEPS = [
  { phase: 'drop', move: 700, hold: 120 },
  { phase: 'out', move: 1700, hold: 0 },
  { phase: 'gone', move: 0, hold: 1200 },
  { phase: 'peek', move: 750, hold: 3200 },
  { phase: 'retreat', move: 900, hold: 900 },
  { phase: 'back', move: 1700, hold: 150 },
  { phase: 'settle', move: 700, hold: 0 },
] as const;

/**
 * The crossing curve. Symmetric, so it is its own mirror — the duck comes back
 * at exactly the speed it left at, at every moment of the trip.
 */
export const PADDLE = 'cubic-bezier(0.45, 0.05, 0.55, 0.95)';

export const PEEK_LINE = 'quack quack, still no donation?';
export const RETURN_LINE = 'quack quack, fine, I will wait.';
