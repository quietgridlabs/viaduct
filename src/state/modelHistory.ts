/**
 * What Ctrl/⌘+Z takes back.
 *
 * Every edit in the editor — a card deleted, a connection drawn, a name
 * changed, a block dragged — lands in one store, and until now none of it
 * could be taken back: the only undo in the app was the one arrange held onto
 * (see arrangeUndo.ts), and a deleted element was simply gone.
 *
 * Whole-model snapshots rather than a log of inverse operations. Edits reach
 * the store from two dozen places — the canvas, the side panels, the domain
 * and data-flow pages, import — and each would have to describe how to undo
 * itself, which is a promise the next feature quietly breaks. A snapshot is
 * taken from the store's own `subscribe`, so anything that writes to the model
 * is covered by construction, including code written after this.
 *
 * The stack lives outside React because the thing that fills it (the store)
 * and the thing that empties it (a key press handled in the workspace) have no
 * owner in common, and because it must survive the canvas remounting between
 * levels. It is deliberately not persisted: a reload is not an edit, and
 * offering to undo a change from last week against a model that has moved on
 * since would be worse than offering nothing.
 */
import { useFlatC4Store, type FlatC4Model } from '@archivisio/c4-modelizer-sdk';

/**
 * Where the editor is looking. Never part of what an undo restores — drilling
 * into a container is not an edit, and being thrown back up a level because
 * you pressed undo would be its own bug.
 */
const VIEW_KEYS = [
  'viewLevel',
  'activeSystemId',
  'activeContainerId',
  'activeComponentId',
] as const;

/** How far back it is worth keeping. Each entry is a model. */
const LIMIT = 50;

/**
 * Edits closer together than this came from one gesture, so they take one
 * press to undo.
 *
 * Deleting a selection of five cards is five calls into the store, and
 * dragging a selection is one call per card. Treated as five steps, undo would
 * put the selection back one card at a time, which is not what the person did
 * and not what they expect to take back.
 */
const COALESCE_MS = 350;

type Model = FlatC4Model;

/* The app hangs its own collections off the model — docs, data flows, domains,
   design systems — so history has to read it by key, not by the four the SDK
   declares. */
const loose = (model: Model): Record<string, unknown> =>
  model as unknown as Record<string, unknown>;

let past: Model[] = [];
let lastPushAt = 0;
/* Counted, not a flag: a load inside a remote apply would otherwise switch
   recording back on halfway through the outer one. */
let suspended = 0;
let stop: (() => void) | null = null;
let watchers = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Everything about the model except where the editor happens to be looking. */
function contentKeys(a: Model, b: Model): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const view of VIEW_KEYS) keys.delete(view);
  return [...keys];
}

/**
 * Did anything but the view change?
 *
 * By reference, which is what the store gives us: every writer rebuilds the
 * collection it touched and passes the rest through untouched, so a view
 * change leaves all of them identical. Cheap enough to run on every write,
 * which is the point — the deep comparison is saved for the one press.
 */
function changedContent(prev: Model, next: Model): boolean {
  return contentKeys(prev, next).some((key) => loose(prev)[key] !== loose(next)[key]);
}

function contentFingerprint(model: Model): string {
  const content: Record<string, unknown> = {};
  for (const key of Object.keys(model).sort()) {
    if ((VIEW_KEYS as readonly string[]).includes(key)) continue;
    content[key] = loose(model)[key];
  }
  try {
    return JSON.stringify(content);
  } catch {
    /* A model that cannot be serialised is one we cannot compare; treat it as
       different rather than silently swallowing the press. */
    return Math.random().toString();
  }
}

function record(prev: Model, next: Model): void {
  if (suspended > 0) return;
  if (!changedContent(prev, next)) return;

  const now = Date.now();
  if (past.length && now - lastPushAt < COALESCE_MS) {
    /* Same gesture: the snapshot already on top is from before it started,
       which is exactly what this edit should undo to. */
    lastPushAt = now;
    return;
  }
  past.push(prev);
  if (past.length > LIMIT) past.shift();
  lastPushAt = now;
  emit();
}

/**
 * Start watching the store. Returns the matching stop.
 *
 * Reference-counted so two mounts — the editor and, say, a page that keeps it
 * alive behind an overlay — do not leave the stack recording twice or stop it
 * from under each other.
 */
export function startModelHistory(): () => void {
  watchers += 1;
  if (watchers === 1) {
    stop = useFlatC4Store.subscribe(
      (state) => state.model,
      (model, prev) => record(prev, model)
    );
  }
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    watchers -= 1;
    if (watchers === 0) {
      stop?.();
      stop = null;
      clearModelHistory();
    }
  };
}

/** True when there is a step to take back. */
export function canUndoModel(): boolean {
  return past.length > 0;
}

export function subscribeModelHistory(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Put the model back one step. Says whether there was one.
 *
 * The view is left exactly where it is: what comes back is the content, onto
 * the level the person is reading now.
 */
export function undoModelChange(): boolean {
  const store = useFlatC4Store.getState();
  while (past.length) {
    const prev = past.pop()!;
    const current = store.model;
    /* A snapshot that matches what is on screen would undo to nothing and
       look like a dead key, so keep walking back to one that differs. */
    if (contentFingerprint(prev) === contentFingerprint(current)) continue;

    const view: Partial<Model> = {};
    for (const key of VIEW_KEYS) {
      (view as Record<string, unknown>)[key] = loose(current)[key];
    }
    suspended += 1;
    try {
      store.setModel({ ...prev, ...view });
    } finally {
      suspended -= 1;
    }
    /* The next edit starts its own step rather than folding into whatever was
       being coalesced when undo interrupted it. */
    lastPushAt = 0;
    emit();
    return true;
  }
  emit();
  return false;
}

/**
 * Run something without recording it.
 *
 * For writes that are not the person's edit: a remote collaborator's change
 * arriving over the wire, or a project being loaded into the store. Undoing
 * either would mean "take back something I never did".
 */
export function suspendModelHistory<T>(run: () => T): T {
  suspended += 1;
  try {
    return run();
  } finally {
    suspended -= 1;
  }
}

/** Forget everything — a different document is in the store now. */
export function clearModelHistory(): void {
  if (!past.length) {
    lastPushAt = 0;
    return;
  }
  past = [];
  lastPushAt = 0;
  emit();
}
