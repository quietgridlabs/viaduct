import type { FlatC4Model, ViewLevel } from '@archivisio/c4-modelizer-sdk';
import type { PresenceView } from '@/community/presenceView';

export type { PresenceView };
export { samePresenceView, presenceViewEqual } from '@/community/presenceView';

export type PresenceUser = {
  clientId: number;
  name: string;
  color: string;
  view: PresenceView;
  kind?: 'gitlab' | 'guest';
};

export type EditingLock = {
  elementId: string;
  name: string;
  clientId: number;
};

export type DragLiveElement = {
  elementId: string;
  x: number;
  y: number;
};

type AwarenessStub = {
  getStates: () => Map<number, { view?: PresenceView; cursor?: { x: number; y: number } | null }>;
};

type Options = {
  enabled?: boolean;
  projectId?: string | null;
  user?: { id: string; name?: string | null; username?: string | null } | null;
  canWrite?: boolean;
  [key: string]: unknown;
};

/** Community: no Yjs. Local editor only. */
export function useYjsProject(_options: Options) {
  return {
    synced: true,
    peers: [] as PresenceUser[],
    awareness: null as AwarenessStub | null,
    setLocalCursor: (_cursor: { x: number; y: number } | null) => {},
    setLocalDragging: (_elements: DragLiveElement[] | null) => {},
    setEditingLock: (_lock: EditingLock | string | null) => {},
    getEditingLock: (_elementId: string) => null as EditingLock | null,
    pushLocalModel: (_model: FlatC4Model) => {},
  };
}

export type { ViewLevel };
