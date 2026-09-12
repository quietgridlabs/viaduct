import { Fragment, createElement } from 'react';
import type { C4Plugin } from '../registry';
import SequenceDiagramsSidebar from './SequenceDiagramsSidebar';
import SequenceEditorOverlay from './SequenceEditorOverlay';

const plugin: C4Plugin = {
  name: 'sequence-editor',
  version: '0.1.0',
  setup(registry) {
    registry.registerPortal(
      'global-overlay',
      createElement(
        Fragment,
        null,
        createElement(SequenceDiagramsSidebar),
        createElement(SequenceEditorOverlay)
      )
    );
  },
};

export default plugin;

/* The component itself is deliberately not re-exported here. EditorPage
   imports the helpers below from this file, and a value re-export of the
   editing surface would drag Monaco — 4.4 MB raw — into that static graph,
   undoing the lazy boundary in SequenceEditorOverlay. Consumers that really
   want the component import it from './public-api', which nothing on the
   editor's own path touches. */
export {
  openSequenceEditor,
  openSequenceManager,
  tryOpenSequenceEditor,
  closeSequenceEditor,
  setSequenceEditorCanEdit,
  getSequenceEditorCanEdit,
} from './uiState';
export { createStoredDiagram, createEmptyDiagramSource } from './host/diagramHelpers';
export type { StoredSequenceDiagram } from './host/diagramHelpers';
export { buildC4Catalog } from './host/c4Catalog';
export type { C4CatalogParticipant } from './host/c4Catalog';
