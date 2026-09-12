import { useColorMode } from '@contexts/ColorModeContext';
import type { PaletteMode } from '@theme/theme';
import type { SystemStyleObject } from '@chakra-ui/react';

export const GLASS_BLUR = 'blur(20px) saturate(1.35)';

/** Bars / nav / tools — slightly tighter than the old 18px pills. */
export const GLASS_RADIUS_BAR = '10px';
/** Side panels, dialogs, editor shells. */
export const GLASS_RADIUS_WINDOW = '10px';
/** Menus / popovers. */
export const GLASS_RADIUS_MENU = '8px';

type GlassChrome = {
  shadow: string;
  shadowMd: string;
  border: string;
};

function glassStroke(mode: PaletteMode): string {
  return mode === 'light' ? 'rgba(40, 28, 18, 0.16)' : 'rgba(255, 255, 255, 0.13)';
}

function glassLift(mode: PaletteMode, elevated = false): string {
  if (mode === 'light') {
    return elevated
      ? '0 12px 32px rgba(40, 28, 18, 0.12)'
      : '0 4px 16px rgba(40, 28, 18, 0.08)';
  }
  return elevated
    ? '0 16px 40px rgba(0, 0, 0, 0.48)'
    : '0 6px 20px rgba(0, 0, 0, 0.32)';
}

export function getGlassBackdrop(mode: PaletteMode): string {
  return mode === 'light' ? 'blackAlpha.450' : 'blackAlpha.700';
}

export function getGlassPanelStyles(mode: PaletteMode, _chrome: GlassChrome) {
  const isLight = mode === 'light';
  return {
    bg: isLight ? 'rgba(255, 255, 255, 0.72)' : 'rgba(28, 26, 32, 0.78)',
    backdropFilter: GLASS_BLUR,
    WebkitBackdropFilter: GLASS_BLUR,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: glassStroke(mode),
    boxShadow: glassLift(mode),
  };
}

export function getGlassDialogStyles(mode: PaletteMode, _chrome: GlassChrome) {
  return {
    ...getGlassPanelStyles(mode, _chrome),
    borderRadius: GLASS_RADIUS_WINDOW,
    boxShadow: glassLift(mode, true),
  };
}

export function getGlassDrawerStyles(mode: PaletteMode, chrome: GlassChrome) {
  return {
    ...getGlassPanelStyles(mode, chrome),
    borderRadius: '0',
    borderTopWidth: '0',
    borderRightWidth: '0',
    borderBottomWidth: '0',
    borderLeftWidth: '1px',
  };
}

/**
 * Floating side panel — rounded modal from the edge.
 *
 * The same glass as every other panel. It used to be its own recipe, darker
 * and half again as transparent, which put the edit panel and the project
 * navigator side by side in two different greys with the board showing through
 * one of them more than the other. Only the corner and the lift are its own.
 */
export function getGlassSidePanelStyles(mode: PaletteMode, chrome: GlassChrome) {
  return {
    ...getGlassPanelStyles(mode, chrome),
    borderRadius: GLASS_RADIUS_WINDOW,
    boxShadow: glassLift(mode, true),
  };
}

/** Embedded editor split panes — mostly opaque, slight glass. */
export function getGlassEditorPanelStyles(mode: PaletteMode, _chrome: GlassChrome) {
  const isLight = mode === 'light';
  return {
    bg: isLight ? 'rgba(255, 255, 255, 0.88)' : 'rgba(28, 26, 32, 0.9)',
    backdropFilter: 'blur(20px) saturate(1.4)',
    WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: glassStroke(mode),
    borderRadius: GLASS_RADIUS_WINDOW,
    boxShadow: glassLift(mode),
  };
}

/** Floating chrome on canvas (nav bar, tools rail, peers dock). */
export function getGlassFloatBarStyles(mode: PaletteMode, _chrome: GlassChrome) {
  const isLight = mode === 'light';
  return {
    bg: isLight ? 'rgba(255, 255, 255, 0.72)' : 'rgba(28, 26, 32, 0.82)',
    backdropFilter: 'blur(20px) saturate(1.4)',
    WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: glassStroke(mode),
    borderRadius: GLASS_RADIUS_BAR,
    boxShadow: glassLift(mode),
  };
}

/** Context / dropdown menus — same glass as dialogs, tighter radius. */
export function getGlassMenuStyles(mode: PaletteMode, _chrome: GlassChrome) {
  const isLight = mode === 'light';
  return {
    bg: isLight ? 'rgba(255, 255, 255, 0.78)' : 'rgba(28, 26, 32, 0.88)',
    backdropFilter: GLASS_BLUR,
    WebkitBackdropFilter: GLASS_BLUR,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: glassStroke(mode),
    borderRadius: GLASS_RADIUS_MENU,
    boxShadow: glassLift(mode, true),
    py: '4px',
  };
}

/** @deprecated Use floatBar — kept for dialog/back-compat call sites. */
export function getGlassNavPillStyles(mode: PaletteMode, chrome: GlassChrome) {
  return getGlassFloatBarStyles(mode, chrome);
}

export const glassScrollbarStyles: SystemStyleObject = {
  scrollbarWidth: 'thin',
  scrollbarColor: 'rgba(142, 136, 148, 0.45) transparent',
  '&::-webkit-scrollbar': { width: '5px' },
  '&::-webkit-scrollbar-track': { bg: 'transparent' },
  '&::-webkit-scrollbar-thumb': {
    bg: 'rgba(142, 136, 148, 0.35)',
    borderRadius: 'full',
  },
  '&::-webkit-scrollbar-thumb:hover': {
    bg: 'rgba(142, 136, 148, 0.55)',
  },
};

export function useGlassSurface() {
  const { mode, chrome } = useColorMode();
  return {
    backdrop: getGlassBackdrop(mode),
    panel: getGlassPanelStyles(mode, chrome),
    dialog: getGlassDialogStyles(mode, chrome),
    drawer: getGlassDrawerStyles(mode, chrome),
    sidePanel: getGlassSidePanelStyles(mode, chrome),
    editorPanel: getGlassEditorPanelStyles(mode, chrome),
    floatBar: getGlassFloatBarStyles(mode, chrome),
    navPill: getGlassFloatBarStyles(mode, chrome),
    menu: getGlassMenuStyles(mode, chrome),
    scrollbar: glassScrollbarStyles,
  };
}
