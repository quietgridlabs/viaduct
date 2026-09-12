import type { SearchableKind } from '@utils/elementSearch';

/** Global search reaches into other projects, so it asks for a real query. */
export const GLOBAL_SEARCH_MIN_CHARS = 3;
export const GLOBAL_SEARCH_PAGE_SIZE = 20;
/** How close to the bottom counts as asking for the next page. */
export const GLOBAL_SEARCH_LOAD_MORE_PX = 64;
/** Typing settles before the workspace is asked anything. */
export const GLOBAL_SEARCH_DEBOUNCE_MS = 220;
/** Placeholders while a further page loads under results already shown. */
export const GLOBAL_SEARCH_MORE_SKELETON_ROWS = 2;

export const KIND_LABEL: Record<SearchableKind, string> = {
  system: 'catalog_kind_system',
  container: 'catalog_kind_container',
  component: 'catalog_kind_component',
  code: 'catalog_kind_code',
};

/** The field slides out to a fixed width rather than being squeezed. */
export const SEARCH_INPUT_WIDTH = '210px';
export const RESULTS_PANEL_WIDTH = '380px';
export const RESULTS_PANEL_MAX_WIDTH = 'min(380px, calc(100vw - 32px))';
export const RESULTS_PANEL_MAX_HEIGHT = '360px';
