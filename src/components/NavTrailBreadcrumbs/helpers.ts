import { requestDiagramFocus } from '@/navigation/diagramFocusBus';
import { type NavTrailFrame } from '@/navigation/navTrail';
import {
  closeDocumentationEditor,
  getDocumentationEditorSession,
  setDocumentationEditorHidden,
} from '@plugins/docs-editor/uiState';
import {
  closeSequenceEditor,
  getSequenceEditorSession,
} from '@plugins/sequence-editor/uiState';
import { leaveCatalogOrFlows } from '@/navigation/leaveCatalogOrFlows';
import { NAV_TRAIL_OFFSET_PX } from './constants';

export function frameLabel(frame: NavTrailFrame, t: (k: string) => string): string {
  if (frame.kind === 'diagram') return t('nav_trail_diagram');
  if (frame.kind === 'catalog') return t('nav_trail_catalog');
  if (frame.kind === 'flows') return t('nav_trail_flows');
  if (frame.kind === 'documentation') return frame.label || t('nav_trail_documentation');
  if (frame.kind === 'sequence') return frame.label || t('nav_trail_sequence');
  return frame.label;
}

/**
 * Restore UI to match a trail frame after goToNavTrail truncated the stack.
 */
export function restoreNavTrailFrame(
  frame: NavTrailFrame,
  opts: { navigate: (to: string) => void; pathname: string }
): void {
  const docs = getDocumentationEditorSession();
  const sequence = getSequenceEditorSession();

  if (frame.kind === 'diagram') {
    if (sequence) closeSequenceEditor();
    if (docs) {
      setDocumentationEditorHidden(false);
      closeDocumentationEditor();
    }
    leaveCatalogOrFlows(opts.pathname, opts.navigate);
    return;
  }

  if (frame.kind === 'catalog' || frame.kind === 'flows') {
    if (sequence) closeSequenceEditor();
    if (docs) {
      setDocumentationEditorHidden(false);
      closeDocumentationEditor();
    }
    if (frame.path) opts.navigate(frame.path);
    return;
  }

  if (frame.kind === 'documentation') {
    if (sequence) closeSequenceEditor();
    if (docs) setDocumentationEditorHidden(false);
    leaveCatalogOrFlows(opts.pathname, opts.navigate);
    return;
  }

  if (frame.kind === 'sequence') {
    if (docs) setDocumentationEditorHidden(true);
    leaveCatalogOrFlows(opts.pathname, opts.navigate);
    return;
  }

  if (frame.kind === 'element') {
    if (sequence) closeSequenceEditor();
    if (docs) setDocumentationEditorHidden(true);
    leaveCatalogOrFlows(opts.pathname, opts.navigate);
    if (frame.focusId) requestDiagramFocus(frame.focusId);
  }
}

export function useNavTrailOffsetPx(): number {
  return NAV_TRAIL_OFFSET_PX;
}
