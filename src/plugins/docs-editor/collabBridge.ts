export type DocsEditingPeer = {
  docId: string;
  name: string;
  color: string;
  clientId: number;
};

type DocsCollabApi = {
  enabled: boolean;
  getYDoc: () => null;
  getAwareness: () => null;
  setEditingDoc: (docId: string | null) => void;
};

type DocsCollabStore = {
  listeners: Set<() => void>;
  peers: DocsEditingPeer[];
  api: DocsCollabApi;
};

const EMPTY_PEERS: DocsEditingPeer[] = [];

const noopApi: DocsCollabApi = {
  enabled: false,
  getYDoc: () => null,
  getAwareness: () => null,
  setEditingDoc: () => undefined,
};

const STORE_KEY = '__c4DocsCollabBridge__';

function getStore(): DocsCollabStore {
  const g = globalThis as typeof globalThis & { [STORE_KEY]?: DocsCollabStore };
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = {
      listeners: new Set(),
      peers: EMPTY_PEERS,
      api: noopApi,
    };
  }
  return g[STORE_KEY];
}

function emit() {
  getStore().listeners.forEach((l) => l());
}

export function bindDocsCollab(_next: {
  getYDoc: () => unknown;
  getAwareness: () => unknown;
  setEditingDoc: (docId: string | null) => void;
}): void {
  /* Community: collab never enables. */
}

export function unbindDocsCollab(): void {
  const store = getStore();
  store.peers = EMPTY_PEERS;
  store.api = noopApi;
  emit();
}

export function publishDocsEditingPeers(next: DocsEditingPeer[]): void {
  const store = getStore();
  store.peers = next.length ? next : EMPTY_PEERS;
  emit();
}

export function getDocsCollabApi(): DocsCollabApi {
  return getStore().api;
}

export function getDocsEditingPeersSnapshot(): DocsEditingPeer[] {
  return getStore().peers;
}

export function subscribeDocsCollab(listener: () => void): () => void {
  const { listeners } = getStore();
  listeners.add(listener);
  return () => listeners.delete(listener);
}
