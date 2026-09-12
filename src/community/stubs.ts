/**
 * Local stubs for Cloud-only surfaces that still have call sites in the
 * Community editor shell. Prefer deleting callers over growing this file.
 */

export const ENTRY_HASH = '';

export type DocsYMeta = {
  ownerType: 'system' | 'container' | 'component' | 'code';
  ownerId: string;
};

type TextObserver = () => void;

export type TextLike = {
  toString: () => string;
  delete: (index: number, length: number) => void;
  insert: (index: number, text: string) => void;
  observe: (fn: TextObserver) => void;
  unobserve: (fn: TextObserver) => void;
  length: number;
};

function emptyText(seed = ''): TextLike {
  let value = seed;
  const observers = new Set<TextObserver>();
  const notify = () => observers.forEach((fn) => fn());
  return {
    get length() {
      return value.length;
    },
    toString: () => value,
    delete: (index, length) => {
      value = value.slice(0, index) + value.slice(index + length);
      notify();
    },
    insert: (index, text) => {
      value = value.slice(0, index) + text + value.slice(index);
      notify();
    },
    observe: (fn) => {
      observers.add(fn);
    },
    unobserve: (fn) => {
      observers.delete(fn);
    },
  };
}

export function ensureProjectDocInYDoc(
  _ydoc: unknown,
  _docId: string,
  seed?: {
    title: string;
    markdown: string;
    ownerType: DocsYMeta['ownerType'];
    ownerId: string;
  }
): { markdown: TextLike; title: TextLike } {
  return {
    markdown: emptyText(seed?.markdown ?? ''),
    title: emptyText(seed?.title ?? ''),
  };
}

export function deleteProjectDocFromYDoc(_ydoc: unknown, _docId: string): void {}

export function setProjectDocOwnerInYDoc(
  _ydoc: unknown,
  _docId: string,
  _ownerType: string,
  _ownerId: string
): void {}

/* Overlay no-ops — Cloud rails are gone. */
export function closeChangeSetsOverlay(): void {}
export function getChangeSetsOverlay(): { selectedId?: string | null } | null {
  return null;
}
export function openChangeSetsOverlay(_opts?: unknown): void {}
export function subscribeChangeSetsOverlay(listener: () => void): () => void {
  return () => {
    void listener;
  };
}

export function closeBranchesOverlay(): void {}
export function getBranchesOverlay(): { selectedId?: string | null } | null {
  return null;
}
export function subscribeBranchesOverlay(listener: () => void): () => void {
  return () => {
    void listener;
  };
}

export function closeCompareOverlay(): void {}
export function getCompareOverlay(): unknown {
  return null;
}
export function openCompareOverlay(_opts?: unknown): void {}
export function subscribeCompareOverlay(listener: () => void): () => void {
  return () => {
    void listener;
  };
}
