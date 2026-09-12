import { Fragment, createElement } from 'react';
import type { C4Plugin } from '../registry';
import DataFlowPlaybackOverlay from './DataFlowPlaybackOverlay';
import DataFlowsSidebar from './DataFlowsSidebar';

const plugin: C4Plugin = {
  name: 'data-flows',
  version: '0.2.0',
  setup(registry) {
    registry.registerPortal(
      'global-overlay',
      createElement(
        Fragment,
        null,
        createElement(DataFlowsSidebar),
        createElement(DataFlowPlaybackOverlay)
      )
    );
  },
};

export default plugin;

export {
  closeDataFlowPlayback,
  closeDataFlowSidebar,
  getDataFlowPlayback,
  getDataFlowSidebar,
  isDataFlowPlaybackOpen,
  openDataFlowPlayback,
  openDataFlowSidebar,
  patchDataFlowPlayback,
  subscribeDataFlowPlayback,
  toggleDataFlowSidebar,
} from './uiState';
