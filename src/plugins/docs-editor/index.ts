import { Fragment, createElement } from 'react';
import type { C4Plugin } from '../registry';
import DocumentationEditorOverlay from './DocumentationEditorOverlay';
import DocumentationSidebar from './DocumentationSidebar';

const plugin: C4Plugin = {
  name: 'docs-editor',
  version: '0.2.0',
  setup(registry) {
    registry.registerPortal(
      'global-overlay',
      createElement(
        Fragment,
        null,
        createElement(DocumentationSidebar),
        createElement(DocumentationEditorOverlay)
      )
    );
  },
};

export default plugin;

export {
  openDocumentationEditor,
  closeDocumentationEditor,
  setDocumentationEditorHidden,
  setDocumentationContext,
} from './uiState';
