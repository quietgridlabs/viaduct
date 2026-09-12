export type SequenceEditLock = {
  diagramKey: string;
  name: string;
  clientId: number;
};

export function makeSequenceDiagramKey(
  ownerType: string,
  ownerId: string,
  diagramId: string
): string {
  return `${ownerType}:${ownerId}:${diagramId}`;
}

type SequenceCollabApi = {
  enabled: boolean;
  setLock: (diagramKey: string | null) => void;
  getLock: (diagramKey: string) => SequenceEditLock | null;
};

const listeners = new Set<() => void>();

/** Stable empty snapshot — never allocate a fresh [] in getSnapshot. */
const EMPTY_LOCKS: SequenceEditLock[] = [];
let locks: SequenceEditLock[] = EMPTY_LOCKS;

const noopApi: SequenceCollabApi = {
  enabled: false,
  setLock: () => undefined,
  getLock: () => null,
};

let api: SequenceCollabApi = noopApi;

function emitLocks() {
  listeners.forEach((l) => l());
}

/** Called from useYjsProject when collab is live. */
export function bindSequenceCollab(next: {
  setLock: (diagramKey: string | null) => void;
  getLock: (diagramKey: string) => SequenceEditLock | null;
}): void {
  api = {
    enabled: true,
    setLock: next.setLock,
    getLock: next.getLock,
  };
  emitLocks();
}

export function unbindSequenceCollab(): void {
  locks = EMPTY_LOCKS;
  api = noopApi;
  emitLocks();
}

export function publishSequenceLocks(next: SequenceEditLock[]): void {
  locks = next.length ? next : EMPTY_LOCKS;
  emitLocks();
}

export function getSequenceCollabApi(): SequenceCollabApi {
  return api;
}

export function subscribeSequenceLocks(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Must return a stable reference when contents are unchanged (useSyncExternalStore). */
export function getSequenceLocksSnapshot(): SequenceEditLock[] {
  return locks;
}
