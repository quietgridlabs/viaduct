import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';

/** Client-only diagram position — not persisted on the server / Yjs snapshot. */
export type EditorNavSlice = Pick<
  FlatC4Model,
  'viewLevel' | 'activeSystemId' | 'activeContainerId' | 'activeComponentId'
>;

export function readEditorNav(model: FlatC4Model): EditorNavSlice {
  return {
    viewLevel: model.viewLevel,
    activeSystemId: model.activeSystemId,
    activeContainerId: model.activeContainerId,
    activeComponentId: model.activeComponentId,
  };
}

/**
 * REST/Yjs snapshots always arrive at system level. Keep where the user was
 * looking when a focus-refetch re-hydrates over a live canvas.
 */
export function withPreservedEditorNav(
  next: FlatC4Model,
  prevNav: EditorNavSlice | null | undefined
): FlatC4Model {
  if (!prevNav?.viewLevel) return next;
  return {
    ...next,
    viewLevel: prevNav.viewLevel,
    activeSystemId: prevNav.activeSystemId,
    activeContainerId: prevNav.activeContainerId,
    activeComponentId: prevNav.activeComponentId,
  };
}
