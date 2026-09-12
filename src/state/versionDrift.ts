/**
 * How far the open project has drifted from its newest named version.
 *
 * Pushed by the server over the collaboration socket as it changes, rather than
 * polled: the server recomputes the model on every edit anyway, so it already
 * knows the answer and when it changed. One computation per project serves
 * every open editor, instead of one request per client per debounce window.
 *
 * The HTTP route stays the source for the first paint and for sessions with no
 * socket at all (read-only links, collaboration disabled).
 */

export type VersionDrift = {
  since: { id: string; name: string | null; created_at: string } | null;
  totals: { added: number; removed: number; changed: number; moved: number } | null;
  empty: boolean;
};

type Entry = { projectId: string; drift: VersionDrift } | null;

let current: Entry = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function setVersionDrift(projectId: string, drift: VersionDrift): void {
  current = { projectId, drift };
  emit();
}

/** Called when leaving a project, so the next one does not inherit its answer. */
export function clearVersionDrift(): void {
  if (!current) return;
  current = null;
  emit();
}

export function subscribeVersionDrift(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Stable across calls — `useSyncExternalStore` compares by reference and would
 * loop forever on a fresh object each time.
 */
export function getVersionDriftSnapshot(): Entry {
  return current;
}
