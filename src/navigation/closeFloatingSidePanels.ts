import { closeArchToolsPanel } from '@plugins/arch-tools/uiState';
import { closeDataFlowSidebar } from '@plugins/data-flows/uiState';
import { closeDocumentationSidebar } from '@plugins/docs-editor/uiState';
import { closeSequenceDiagramsSidebar } from '@plugins/sequence-editor/uiState';

/** Close list-style right panels so the element editor can occupy the same slot. */
export function closeFloatingSidePanels() {
  closeArchToolsPanel();
  closeDocumentationSidebar();
  closeSequenceDiagramsSidebar();
  closeDataFlowSidebar();
}
