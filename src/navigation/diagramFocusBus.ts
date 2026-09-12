/**
 * Request diagram focus without going through `?focus=` query
 * (for in-editor jumps from docs / trail restore).
 */

type Listener = (request: DiagramFocusRequest) => void;

export type DiagramFocusRequest = {
  id: string;
  /** Monotonic so the same id can be requested twice. */
  requestId: number;
};

type Bus = {
  pending: DiagramFocusRequest | null;
  listeners: Set<Listener>;
  nextId: number;
};

const STORE_KEY = '__c4DiagramFocusBus__';

function getBus(): Bus {
  const g = globalThis as typeof globalThis & { [STORE_KEY]?: Bus };
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = { pending: null, listeners: new Set(), nextId: 1 };
  }
  return g[STORE_KEY];
}

export function subscribeDiagramFocus(listener: Listener): () => void {
  const bus = getBus();
  bus.listeners.add(listener);
  return () => bus.listeners.delete(listener);
}

export function requestDiagramFocus(id: string): void {
  const bus = getBus();
  const request: DiagramFocusRequest = { id, requestId: bus.nextId++ };
  bus.pending = request;
  bus.listeners.forEach((l) => l(request));
}

export function takePendingDiagramFocus(): DiagramFocusRequest | null {
  const bus = getBus();
  const next = bus.pending;
  bus.pending = null;
  return next;
}

export function peekPendingDiagramFocus(): DiagramFocusRequest | null {
  return getBus().pending;
}
