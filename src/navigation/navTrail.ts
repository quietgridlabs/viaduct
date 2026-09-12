/**
 * In-memory multi-step navigation trail for overlays + catalog ↔ diagram.
 * Do not use browser history / navigate(-1) — C4 view lives in hash pushState.
 */

export type NavTrailKind =
  | 'diagram'
  | 'catalog'
  | 'flows'
  | 'documentation'
  | 'sequence'
  | 'element';

export type NavTrailFrame = {
  id: string;
  kind: NavTrailKind;
  label: string;
  /** Focus / open this C4 element when restoring an element frame. */
  focusId?: string;
  /** Catalog route to restore. */
  path?: string;
};

type Listener = () => void;

type NavTrailStore = {
  frames: NavTrailFrame[];
  forwardFrames: NavTrailFrame[];
  listeners: Set<Listener>;
};

const STORE_KEY = '__c4NavTrail__';

function getStore(): NavTrailStore {
  const g = globalThis as typeof globalThis & { [STORE_KEY]?: NavTrailStore };
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = { frames: [], forwardFrames: [], listeners: new Set() };
  }
  return g[STORE_KEY];
}

function clearForwardStack(): void {
  getStore().forwardFrames = [];
}

function emit() {
  getStore().listeners.forEach((l) => l());
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function diagramFrame(): NavTrailFrame {
  return { id: 'diagram', kind: 'diagram', label: 'Diagram' };
}

function ensureDiagramRoot(frames: NavTrailFrame[]): NavTrailFrame[] {
  if (frames.length === 0) return [diagramFrame()];
  if (frames[0].kind !== 'diagram') return [diagramFrame(), ...frames];
  return frames;
}

export function subscribeNavTrail(listener: Listener): () => void {
  const { listeners } = getStore();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getNavTrail(): NavTrailFrame[] {
  return getStore().frames;
}

export function getNavTrailSnapshot(): NavTrailFrame[] {
  return getStore().frames;
}

/** Seed diagram as root if empty; no-op if already started. */
export function ensureNavTrailRoot(): void {
  const store = getStore();
  if (store.frames.length > 0) return;
  store.frames = [diagramFrame()];
  emit();
}

export function pushNavTrail(
  frame: Omit<NavTrailFrame, 'id'> & { id?: string }
): string {
  const store = getStore();
  clearForwardStack();
  let frames = ensureDiagramRoot(store.frames);
  const last = frames[frames.length - 1];
  if (
    last &&
    last.kind === frame.kind &&
    last.label === frame.label &&
    last.focusId === frame.focusId &&
    last.path === frame.path
  ) {
    store.frames = frames;
    return last.id;
  }
  /* Only one diagram is open at a time, so opening another is not a step
     deeper — it takes the place of the one before it. What led there (a
     document, say) stays in the trail. */
  if (frame.kind === 'sequence') {
    while (frames[frames.length - 1]?.kind === 'sequence') {
      frames = frames.slice(0, -1);
    }
  }

  // Opening a top-level surface replaces deeper stack after diagram.
  if (frame.kind === 'catalog' || frame.kind === 'documentation' || frame.kind === 'flows') {
    const root = frames[0]?.kind === 'diagram' ? [frames[0]] : [diagramFrame()];
    const id = frame.id || newId(frame.kind);
    store.frames = [...root, { ...frame, id }];
    emit();
    return id;
  }
  const id = frame.id || newId(frame.kind);
  store.frames = [...frames, { ...frame, id }];
  emit();
  return id;
}

/** Truncate trail to `id` (inclusive) and return that frame. */
export function goToNavTrail(id: string): NavTrailFrame | null {
  const store = getStore();
  const idx = store.frames.findIndex((f) => f.id === id);
  if (idx < 0) return null;
  clearForwardStack();
  const target = store.frames[idx];
  store.frames = store.frames.slice(0, idx + 1);
  emit();
  return target;
}

export function popNavTrail(): NavTrailFrame | null {
  const store = getStore();
  if (store.frames.length <= 1) return store.frames[0] ?? null;
  const removed = store.frames[store.frames.length - 1]!;
  store.frames = store.frames.slice(0, -1);
  store.forwardFrames.push(removed);
  emit();
  return store.frames[store.frames.length - 1] ?? null;
}

/** Re-apply the last trail frame popped via back. */
export function forwardNavTrail(): NavTrailFrame | null {
  const store = getStore();
  if (store.forwardFrames.length === 0) return null;
  const frame = store.forwardFrames.pop()!;
  store.frames = [...store.frames, frame];
  emit();
  return frame;
}

export function canForwardNavTrail(): boolean {
  return getStore().forwardFrames.length > 0;
}

export function clearNavTrail(): void {
  getStore().frames = [];
  clearForwardStack();
  emit();
}

export function resetNavTrailToDiagram(): void {
  getStore().frames = [diagramFrame()];
  clearForwardStack();
  emit();
}
