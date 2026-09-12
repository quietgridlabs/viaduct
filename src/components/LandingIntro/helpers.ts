import { SEEN_KEY } from './constants';

/* Session storage, not local: once per visit rather than once per browser —
   someone coming back tomorrow gets the title card again. */
export function alreadySeen(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    /* Private mode: show it, never remember it. */
    return false;
  }
}

export function remember(): void {
  try {
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}
