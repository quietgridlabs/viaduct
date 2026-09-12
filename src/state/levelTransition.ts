/**
 * "Working on it" while the canvas swaps one C4 level for another.
 *
 * Changing level throws away every node on the board and builds the next
 * level's from scratch, and on a large model that render holds the main thread
 * for a second or more. Nothing marks the wait: the old diagram simply sits
 * there and is replaced, which reads as the app freezing rather than as work
 * in progress.
 *
 * A spinner over a blocking render is only useful if it is *already on screen*
 * when the blocking starts — once React begins, nothing else paints. So the
 * flag is raised, the browser is given a frame to paint it, and only then does
 * the level actually change. `LevelTransitionOverlay` fades in on a delay, so a
 * switch that finishes quickly never shows anything at all.
 *
 * A tiny external store rather than a prop: the thing that starts a level
 * change (a card's drill-down button, the navigation pill) and the thing that
 * has to show the wait (the canvas) sit several layers apart — the same
 * reasoning as diffOverlay.ts, and the same shape of solution.
 */

let pending = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeLevelTransition(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLevelTransitionSnapshot(): boolean {
  return pending;
}

/** Server render has no canvas to cover. */
export function getLevelTransitionServerSnapshot(): boolean {
  return false;
}

/** Resolves after the browser has had a chance to paint. */
function afterPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/*
 * However slow the render, the spinner comes down: a level that fails to
 * arrive must not leave the canvas covered for the rest of the session.
 */
const MAX_HOLD_MS = 8000;

let releaseTimer: ReturnType<typeof setTimeout> | null = null;

function release(): void {
  if (releaseTimer) {
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }
  if (!pending) return;
  pending = false;
  emit();
}

/**
 * Run a level change with the wait shown.
 *
 * @param apply what actually moves the canvas — a `navigateTo*` call
 */
export function runLevelChange(apply: () => void): void {
  /* No window (tests, prerender): nothing can paint, so nothing is gained by
     deferring the change — and deferring it would break the caller. */
  if (typeof requestAnimationFrame !== 'function') {
    apply();
    return;
  }

  if (!pending) {
    pending = true;
    emit();
  }

  if (releaseTimer) clearTimeout(releaseTimer);
  releaseTimer = setTimeout(release, MAX_HOLD_MS);

  void afterPaint()
    .then(() => {
      try {
        apply();
      } finally {
        /* The frame after the level's render is the frame it became visible
           in — the browser could not have got here any earlier. */
        void afterPaint().then(release);
      }
    })
    .catch(release);
}

/** Test hook: drop the flag without waiting for a frame. */
export function resetLevelTransition(): void {
  release();
}
