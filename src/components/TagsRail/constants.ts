/** The floating panel above the rail. */
export const TAGS_PANEL_WIDTH = '320px';
export const TAGS_PANEL_MAX_HEIGHT = '280px';

/** Per-tag menu, and the colour submenu hanging off it. */
export const TAG_MENU_MIN_WIDTH = '180px';
export const TAG_COLOR_MENU_MIN_WIDTH = '150px';
export const TAG_COLOR_MENU_MAX_HEIGHT = '260px';

export const TAG_MENU_ICON_SIZE = 14;
/** A swatch is its own mark, so it is sized rather than drawn as an icon. */
export const TAG_SWATCH_SIZE = '13px';
export const TAG_SWATCH_ICON_SIZE = 13;

/**
 * Anything that floats above the panel and is legitimately outside its DOM —
 * a menu or a dialog — must not count as a click away.
 */
export const FLOATING_LAYER_SELECTOR =
  '[data-scope="menu"], [role="dialog"], [role="alertdialog"]';
