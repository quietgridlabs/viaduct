/**
 * Whether the design-system panel is open, and which system it lands on.
 *
 * Same shape as the change-set and branch overlays: a full workspace surface,
 * so the flag lives outside the component that opens it.
 */

type DesignSystemsOverlaySession = {
  selectedName?: string;
} | null;

type Listener = () => void;

type Store = {
  session: DesignSystemsOverlaySession;
  listeners: Set<Listener>;
};

const STORE_KEY = '__c4DesignSystemsOverlayUi__';

function getStore(): Store {
  const g = globalThis as typeof globalThis & { [STORE_KEY]?: Store };
  const store = (g[STORE_KEY] ??= { session: null, listeners: new Set() });
  store.session ??= null;
  return store;
}

function emit() {
  getStore().listeners.forEach((l) => l());
}

export function subscribeDesignSystemsOverlay(listener: Listener): () => void {
  getStore().listeners.add(listener);
  return () => getStore().listeners.delete(listener);
}

export function getDesignSystemsOverlay(): DesignSystemsOverlaySession {
  return getStore().session;
}

export function openDesignSystemsOverlay(
  next?: NonNullable<DesignSystemsOverlaySession>
): void {
  getStore().session = { selectedName: next?.selectedName };
  emit();
}

export function closeDesignSystemsOverlay(): void {
  if (!getStore().session) return;
  getStore().session = null;
  emit();
}
