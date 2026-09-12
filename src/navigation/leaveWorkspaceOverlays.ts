/**
 * Close every workspace surface — projects, sequence, documentation, catalog,
 * flows — before switching to another one. Two managers on screen at once is
 * two answers to "where am I".
 */
import { closeDocumentationEditor, setDocumentationEditorHidden } from '@plugins/docs-editor/uiState';
import { closeSequenceEditor } from '@plugins/sequence-editor/uiState';
import {
  closeDataFlowManager,
  closeDataFlowPlayback,
  closeDataFlowSidebar,
} from '@plugins/data-flows/uiState';
import { closeCatalogOverlay } from '@plugins/service-catalog/uiState';
import { closeBranchesOverlay, closeChangeSetsOverlay, closeCompareOverlay } from '@/community/stubs';
import { closeDomainsOverlay } from '@features/domains';
import { closeProjectsOverlay } from '@/state/projectsOverlay';
import { resetNavTrailToDiagram } from '@/navigation/navTrail';

export function leaveWorkspaceOverlays(opts?: {
  /** Keep the docs session mounted (unhide) instead of closing it. */
  keepDocs?: boolean;
  /**
   * Keep the projects manager open — used when *entering* projects so we can
   * close every other surface without briefly extinguishing the one we just
   * opened (or are about to show).
   */
  keepProjects?: boolean;
  /** Reset breadcrumb trail to diagram root. */
  resetTrail?: boolean;
}): void {
  closeSequenceEditor();
  closeCatalogOverlay();
  closeChangeSetsOverlay();
  closeBranchesOverlay();
  closeCompareOverlay();
  closeDomainsOverlay();
  /* Projects is a surface like the rest: opening the catalog or the flows
     means leaving it, not stacking on top of it. */
  if (!opts?.keepProjects) {
    closeProjectsOverlay();
  }
  closeDataFlowManager();
  closeDataFlowPlayback();
  closeDataFlowSidebar();
  if (opts?.keepDocs) {
    setDocumentationEditorHidden(false);
  } else {
    closeDocumentationEditor();
  }
  if (opts?.resetTrail !== false) {
    resetNavTrailToDiagram();
  }
}
