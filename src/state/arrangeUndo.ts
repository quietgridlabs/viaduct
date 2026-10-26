/**
 * The one arrange you are allowed to take back.
 *
 * Arranging rewrites every position and every line on the view at once, and
 * there is no undo anywhere in the editor — so the button was a bet: press it
 * and either it came out better or you rebuilt the layout by hand. Holding the
 * previous state until the answer is "keep" turns that into a look.
 *
 * Kept outside React because the button lives in the canvas toolbar and the
 * bar that asks lives in the workspace above it, with the whole canvas in
 * between; the rest of this app bridges that distance the same way.
 */

export type ArrangeUndo = {
  /** How many cards moved, for the bar to say what happened. */
  moved: number;
  /** The view it happened on. Reverting into a different one would be wrong. */
  viewKey: string;
  revert: () => void;
} | null;

let current: ArrangeUndo = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function setArrangeUndo(next: ArrangeUndo): void {
  current = next;
  emit();
}

export function clearArrangeUndo(): void {
  if (!current) return;
  current = null;
  emit();
}

export function getArrangeUndo(): ArrangeUndo {
  return current;
}

export function subscribeArrangeUndo(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
