import { TIP_COUNT } from './constants';
import type { HelperLevel } from './types';

/** The i18n keys for one level's tips, in order. */
export function tipKeys(level: HelperLevel): string[] {
  return Array.from({ length: TIP_COUNT[level] }, (_, i) => `helper_${level}_tip_${i + 1}`);
}

/** Paging wraps in both directions — there is no end of the list to hit. */
export function stepTip(current: number, delta: number, total: number): number {
  if (total <= 0) return 0;
  return (current + delta + total) % total;
}
