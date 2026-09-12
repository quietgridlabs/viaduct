import type { HopDirection } from '@utils/duckHopNav';
import {
  FACING_DEADZONE_PX,
  HOP_QUACK_LINES,
  HOP_QUACK_MAX_MS,
  HOP_QUACK_MIN_MS,
} from './constants';
import type { DuckFacing } from './types';

/** Arrow keys turn her; up and down leave her facing where she was. */
export function facingForDirection(direction: HopDirection, current: DuckFacing): DuckFacing {
  if (direction === 'left') return { flip: true, rotate: 0 };
  if (direction === 'right') return { flip: false, rotate: 0 };
  return { flip: current.flip, rotate: 0 };
}

/** A free hop turns her by where it took her, not by which key was pressed. */
export function facingForDelta(dx: number, current: DuckFacing): DuckFacing {
  if (Math.abs(dx) < FACING_DEADZONE_PX) return { flip: current.flip, rotate: 0 };
  return { flip: dx < 0, rotate: 0 };
}

/** Node ids come from the model and can hold anything a selector would mind. */
export function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && 'escape' in CSS) {
    return CSS.escape(value);
  }
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function randomQuackLine(): string {
  return HOP_QUACK_LINES[Math.floor(Math.random() * HOP_QUACK_LINES.length)];
}

/** When the next unprompted quack is due. */
export function nextQuackDelay(): number {
  return HOP_QUACK_MIN_MS + Math.random() * (HOP_QUACK_MAX_MS - HOP_QUACK_MIN_MS);
}

/** Reads as what it is at the call site: `if (chance(QUACK_ODDS_ON_HOP))`. */
export function chance(odds: number): boolean {
  return Math.random() < odds;
}
