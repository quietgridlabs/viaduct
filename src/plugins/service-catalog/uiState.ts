import { trackProductEvent } from '@/metrics';

type CatalogOverlaySession = {
  selectedId?: string;
} | null;

type Listener = () => void;

type CatalogOverlayStore = {
  session: CatalogOverlaySession;
  listeners: Set<Listener>;
};

const STORE_KEY = '__c4CatalogOverlayUi__';

function getStore(): CatalogOverlayStore {
  const g = globalThis as typeof globalThis & { [STORE_KEY]?: CatalogOverlayStore };
  const store = (g[STORE_KEY] ??= {
    session: null,
    listeners: new Set(),
  });
  store.session ??= null;
  return store;
}

function emit() {
  getStore().listeners.forEach((l) => l());
}

export function subscribeCatalogOverlay(listener: Listener): () => void {
  getStore().listeners.add(listener);
  return () => getStore().listeners.delete(listener);
}

export function getCatalogOverlay(): CatalogOverlaySession {
  return getStore().session;
}

export function openCatalogOverlay(next?: NonNullable<CatalogOverlaySession>): void {
  getStore().session = { selectedId: next?.selectedId };
  trackProductEvent('catalog.opened');
  emit();
}

export function closeCatalogOverlay(): void {
  if (!getStore().session) return;
  getStore().session = null;
  emit();
}
