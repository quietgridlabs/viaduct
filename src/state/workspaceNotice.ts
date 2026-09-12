/**
 * App-wide toast notices (e.g. domain jump denied).
 * EditorPage subscribes and renders ToastNotification.
 */

type Listener = (message: string) => void;

type Store = {
  listeners: Set<Listener>;
};

const STORE_KEY = '__c4WorkspaceNotice__';

function getStore(): Store {
  const g = globalThis as typeof globalThis & { [STORE_KEY]?: Store };
  return (g[STORE_KEY] ??= { listeners: new Set() });
}

export function subscribeWorkspaceNotice(listener: Listener): () => void {
  getStore().listeners.add(listener);
  return () => getStore().listeners.delete(listener);
}

export function showWorkspaceNotice(message: string): void {
  const text = String(message || '').trim();
  if (!text) return;
  getStore().listeners.forEach((l) => l(text));
}
