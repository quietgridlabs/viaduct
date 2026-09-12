/*
 * The session ends after four hours in which the person did nothing. The server
 * can only see requests, and the app makes them on its own — the auth
 * heartbeat, the thread poll, the change-set poll — so a tab left open on an
 * empty desk would renew the cookie every few seconds and the timeout would
 * never fire. Only the browser can tell the difference, so it watches real
 * input; `shared/api/http` reads it to mark every unprompted request as idle.
 */

/** Input that means a person is there. Cheap to observe: we only store a time. */
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'mousemove', 'wheel', 'touchstart'] as const;

let lastActivityAt = Date.now();
let listeners = 0;
let detach: (() => void) | null = null;

function mark() {
  lastActivityAt = Date.now();
}

/** Note activity the DOM cannot see — a keystroke swallowed inside an editor. */
export function markUserActive(): void {
  mark();
}

/** True when the person did something after `timestamp`. */
export function userActiveSince(timestamp: number): boolean {
  return lastActivityAt > timestamp;
}

/**
 * When the person last did something.
 *
 * For deciding "have I already acted on this input?", compare against this
 * rather than against the clock: an input and the request it causes can land in
 * the same millisecond, and comparing input-time to now-time then reads a real
 * keystroke as idleness.
 */
export function lastUserActivityAt(): number {
  return lastActivityAt;
}

/**
 * Observe input while at least one caller is interested.
 * @returns unsubscribe; listeners are removed when the last caller leaves.
 */
export function trackUserActivity(): () => void {
  if (typeof window === 'undefined') return () => {};

  if (listeners === 0) {
    /* Capture phase: a stopPropagation deep in the canvas or an editor must not
       make a real keystroke look like idleness. */
    const options = { passive: true, capture: true } as const;
    for (const type of ACTIVITY_EVENTS) window.addEventListener(type, mark, options);
    detach = () => {
      for (const type of ACTIVITY_EVENTS) window.removeEventListener(type, mark, options);
    };
  }
  listeners += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    listeners -= 1;
    if (listeners === 0) {
      detach?.();
      detach = null;
    }
  };
}

/** Tests only — the module keeps its state for the life of the tab. */
export function resetUserActivity(now = Date.now()): void {
  lastActivityAt = now;
}
