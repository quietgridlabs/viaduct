import { useSyncExternalStore } from 'react';

/*
 * How the canvas is painted, per person and per browser.
 *
 * Technology colours make a dense diagram easy to scan by stack, but they also
 * turn it into a mosaic — some people read structure better when every element
 * looks the same and only shape and text carry meaning. Both are legitimate, so
 * neither is hard-coded.
 *
 * Kept outside React on purpose: the readers are React Flow nodes and edges,
 * which render in their own subtree, and a context provider high in the app
 * would re-render the whole canvas on unrelated updates.
 */

const STORAGE_KEY = 'c4-canvas-prefs';

/** `technology` paints with the element's stack colour; `neutral` with grey. */
export type ColorSource = 'technology' | 'neutral';

export type CanvasPrefs = {
  /** Element cards: accent, border, header wash and tint. */
  nodeColors: ColorSource;
  /** Relationship lines, their arrowheads and labels. */
  edgeColors: ColorSource;
};

export const DEFAULT_CANVAS_PREFS: CanvasPrefs = {
  nodeColors: 'technology',
  edgeColors: 'technology',
};

function isColorSource(value: unknown): value is ColorSource {
  return value === 'technology' || value === 'neutral';
}

function read(): CanvasPrefs {
  if (typeof window === 'undefined') return DEFAULT_CANVAS_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CANVAS_PREFS;
    const parsed = JSON.parse(raw) as Partial<CanvasPrefs>;
    return {
      nodeColors: isColorSource(parsed.nodeColors)
        ? parsed.nodeColors
        : DEFAULT_CANVAS_PREFS.nodeColors,
      edgeColors: isColorSource(parsed.edgeColors)
        ? parsed.edgeColors
        : DEFAULT_CANVAS_PREFS.edgeColors,
    };
  } catch {
    /* Corrupt or unavailable storage must not take the canvas down. */
    return DEFAULT_CANVAS_PREFS;
  }
}

let current: CanvasPrefs = read();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Stable snapshot: `useSyncExternalStore` compares by identity. */
function getSnapshot(): CanvasPrefs {
  return current;
}

function getServerSnapshot(): CanvasPrefs {
  return DEFAULT_CANVAS_PREFS;
}

export function setCanvasPrefs(patch: Partial<CanvasPrefs>): void {
  const next = { ...current, ...patch };
  if (next.nodeColors === current.nodeColors && next.edgeColors === current.edgeColors) {
    return;
  }
  current = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* Private mode — the choice still applies for this session. */
  }
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* one bad listener must not stop the others */
    }
  });
}

/** Current preferences outside React — for tests and non-component callers. */
export function getCanvasPrefs(): CanvasPrefs {
  return current;
}

export function useCanvasPrefs(): CanvasPrefs {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Tests only — the module holds its state for the life of the tab. */
export function resetCanvasPrefs(): void {
  current = DEFAULT_CANVAS_PREFS;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  listeners.forEach((listener) => listener());
}
