import { TIPS_TOUR_STORAGE_KEY } from './constants';

export function markTipsTourSeen() {
  try {
    localStorage.setItem(TIPS_TOUR_STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function hasSeenTipsTour(): boolean {
  try {
    return localStorage.getItem(TIPS_TOUR_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** A step whose target is not on screen is skipped rather than pointed at. */
export function queryTourTarget(id: string): HTMLElement | null {
  try {
    return document.querySelector(`[data-tour="${id}"]`);
  } catch {
    return null;
  }
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
