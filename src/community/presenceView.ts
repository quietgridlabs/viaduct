/** Presence types kept for prop compatibility; Community always has empty peers. */

export type PresenceView = {
  viewLevel: import('@archivisio/c4-modelizer-sdk').ViewLevel | string;
  activeSystemId?: string;
  activeContainerId?: string;
  activeComponentId?: string;
  cursor?: { x: number; y: number } | null;
};

export function presenceViewEqual(a?: PresenceView | null, b?: PresenceView | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.viewLevel === b.viewLevel &&
    a.activeSystemId === b.activeSystemId &&
    a.activeContainerId === b.activeContainerId &&
    a.activeComponentId === b.activeComponentId
  );
}

export function samePresenceView(a?: PresenceView | null, b?: PresenceView | null): boolean {
  return presenceViewEqual(a, b);
}
