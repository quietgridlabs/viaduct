/** Floating UI on the diagram canvas (nav, tools rail, side panels). */
export const CANVAS_CHROME_INSET = '12px';
export const CANVAS_CHROME_TOP = '12px';
export const CANVAS_CHROME_Z = 1650;

/**
 * When the top chrome row is narrower than this, captions (Instruments,
 * Systems, Donate, Sign in, …) hide and only icons remain. Named off the
 * row itself so a squeezed canvas (side panel open) compact-modes even on
 * a wide monitor.
 */
export const WORKSPACE_CHROME_COMPACT_MAX = '72rem';

/** CSS for the top chrome row. Pair with `data-nav-label` / `data-nav-compact-icon`. */
export const workspaceChromeRowCss = {
  containerType: 'inline-size',
  [`@container (max-width: ${WORKSPACE_CHROME_COMPACT_MAX})`]: {
    '& [data-nav-label]': { display: 'none !important' },
    '& [data-nav-compact-icon]': { display: 'inline-flex !important' },
  },
} as const;

/** Compact app footer bar — overlays must stop above this. */
export const APP_FOOTER_HEIGHT = '36px';
export const APP_FOOTER_Z = 1700;
export const APP_FOOTER_OFFSET = `calc(${APP_FOOTER_HEIGHT} + env(safe-area-inset-bottom, 0px))`;

/** Side panels start below the top nav bar. */
export const SIDE_PANEL_TOP = '64px';
export const SIDE_PANEL_INSET = CANVAS_CHROME_INSET;
export const SIDE_PANEL_Z = 1450;

/**
 * The chrome bar every full-screen manager wears (branches, compare, change
 * sets, catalog, domains, flows, projects).
 *
 * One height for all of them, because they overlay one another: opening the
 * comparator over the branches list with a shorter bar — an icon button where
 * the other has a labelled one — left a strip of the branches header showing
 * behind it.
 *
 * 56px is what a bar with a labelled `size="sm"` button already measures
 * (36px of button between 10px of padding); the ones carrying only 28px icon
 * buttons grow to meet it.
 */
export const MANAGER_BAR_MIN_H = '56px';

/** Main workspace surface below floating nav chrome. */
export const WORKSPACE_CONTENT_TOP = SIDE_PANEL_TOP;

/** Full-screen editors (docs, sequence, magic flow, catalog) sit above canvas chrome. */
export const WORKSPACE_EDITOR_Z = 1500;

/** Global navigation surfaces (projects drawer) stay above the workspace editors. */
export const WORKSPACE_DRAWER_Z = 1550;

/** Popovers inside full-screen editors (select menus, etc.). */
export const WORKSPACE_EDITOR_OVERLAY_Z = 1600;

/**
 * Popper-driven layers (select, combobox, menu, tooltip).
 * Zag writes `z-index: var(--z-index)` inline on every positioner, so this must
 * be published as that CSS variable — a `zIndex` prop alone is always overridden.
 */
export const POPPER_LAYER_Z = 2000;

export const sidePanelHeight = `calc(100vh - ${SIDE_PANEL_TOP} - ${SIDE_PANEL_INSET} - ${APP_FOOTER_OFFSET} - ${SIDE_PANEL_INSET})`;
