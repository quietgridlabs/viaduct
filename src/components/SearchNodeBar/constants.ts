import { CANVAS_NODE_WIDTH } from '@theme/canvasSurfaces';

/** The clone is dropped centred on the pointer, so its size is needed here. */
export const NODE_WIDTH = CANVAS_NODE_WIDTH;
export const NODE_HEIGHT = 140;

export const PANEL_WIDTH_PX = 380;
export const PANEL_MAX_WIDTH = 'min(380px, calc(100vw - 32px))';
export const RESULTS_MAX_HEIGHT = '360px';
/** Above the canvas chrome — it is anchored to a pointer, not to a corner. */
export const PANEL_Z = 1300;

/** One character matches half the workspace once domains are in play. */
export const SEARCH_MIN_CHARS = 2;
/** Rows revealed per page, locally and per remote request. */
export const SEARCH_PAGE_SIZE = 20;
/** Distance from the bottom of the list that pulls the next page in. */
export const SEARCH_LOAD_MORE_PX = 64;
/** Typing settles before the workspace is asked anything. */
export const SEARCH_DEBOUNCE_MS = 200;
/** Placeholders while a further page loads under results already shown. */
export const SEARCH_MORE_SKELETON_ROWS = 2;

export const KIND_LABEL: Record<string, string> = {
  system: 'catalog_kind_system',
  container: 'catalog_kind_container',
  component: 'catalog_kind_component',
  code: 'catalog_kind_code',
};
