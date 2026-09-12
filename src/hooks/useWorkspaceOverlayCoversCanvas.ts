import { useSyncExternalStore } from 'react';
import {
  getDocumentationEditorSession,
  subscribeDocumentationEditor,
} from '@plugins/docs-editor/uiState';
import {
  getSequenceEditorSession,
  subscribeSequenceEditor,
} from '@plugins/sequence-editor/uiState';
import {
  getDataFlowManager,
  subscribeDataFlowPlayback,
} from '@plugins/data-flows/uiState';
import {
  getCatalogOverlay,
  subscribeCatalogOverlay,
} from '@plugins/service-catalog/uiState';
import {
  getDomainsOverlay,
  subscribeDomainsOverlay,
} from '@features/domains';
import {
  getProjectsOverlay,
  subscribeProjectsOverlay,
} from '@/state/projectsOverlay';
import {
  getChangeSetsOverlay,
  subscribeChangeSetsOverlay,
  getCompareOverlay,
  subscribeCompareOverlay,
  getBranchesOverlay,
  subscribeBranchesOverlay,
} from '@/community/stubs';

export type WorkspaceOverlayCoverInput = {
  docsOpen: boolean;
  docsHidden: boolean;
  sequenceOpen: boolean;
  dataFlowManagerOpen: boolean;
  catalogOpen: boolean;
  domainsOpen?: boolean;
  projectsOpen?: boolean;
  changeSetsOpen?: boolean;
  branchesOpen?: boolean;
  compareOpen?: boolean;
};

/** True when a glass overlay actually covers the diagram (not a docs peek). */
export function workspaceOverlayCoversCanvas(
  state: WorkspaceOverlayCoverInput
): boolean {
  const docsCovering = state.docsOpen && !state.docsHidden;
  return (
    docsCovering ||
    state.sequenceOpen ||
    state.dataFlowManagerOpen ||
    state.catalogOpen ||
    Boolean(state.domainsOpen) ||
    Boolean(state.projectsOpen) ||
    Boolean(state.changeSetsOpen) ||
    Boolean(state.branchesOpen) ||
    Boolean(state.compareOpen)
  );
}

export function readWorkspaceOverlayCoversCanvas(): boolean {
  const docs = getDocumentationEditorSession();
  return workspaceOverlayCoversCanvas({
    docsOpen: docs != null,
    docsHidden: Boolean(docs?.hidden),
    sequenceOpen: getSequenceEditorSession() != null,
    dataFlowManagerOpen: getDataFlowManager() != null,
    catalogOpen: getCatalogOverlay() != null,
    domainsOpen: getDomainsOverlay() != null,
    projectsOpen: getProjectsOverlay(),
    changeSetsOpen: getChangeSetsOverlay() != null,
    branchesOpen: getBranchesOverlay() != null,
    compareOpen: getCompareOverlay() != null,
  });
}

function subscribeWorkspaceOverlay(listener: () => void): () => void {
  const unsubs = [
    subscribeDocumentationEditor(listener),
    subscribeSequenceEditor(listener),
    /* Same store as manager / sidebar — emit covers every data-flow surface. */
    subscribeDataFlowPlayback(listener),
    subscribeCatalogOverlay(listener),
    subscribeDomainsOverlay(listener),
    subscribeProjectsOverlay(listener),
    subscribeChangeSetsOverlay(listener),
    subscribeBranchesOverlay(listener),
    subscribeCompareOverlay(listener),
  ];
  return () => {
    unsubs.forEach((u) => u());
  };
}

/** Glass overlay is showing over the canvas. Docs peek (`hidden`) is not covering. */
export function useWorkspaceOverlayCoversCanvas(): boolean {
  return useSyncExternalStore(
    subscribeWorkspaceOverlay,
    readWorkspaceOverlayCoversCanvas,
    () => false
  );
}
