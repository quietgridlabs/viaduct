import { withAlpha } from './canvasSurfaces';

/** App light/dark mode — formerly MUI's PaletteMode. */
export type PaletteMode = 'light' | 'dark';

export interface ColorStyle {
  primaryColor: string;
  secondaryColor: string;
  background: string;
  gradient: string;
  gradientHover: string;
  border: string;
  hover: string;
  glow: string;
  gradientStart: string;
  gradientEnd: string;
  hoverGradientStart: string;
  hoverGradientEnd: string;
}

/** UI chrome tokens (toolbar, nav, drawers, dialogs, canvas shell). */
export interface ChromeColors {
  pageBg: string;
  canvasBg: string;
  canvasDot: string;
  edgeStroke: string;
  edgeGlow: string;
  nodeText: string;
  nodeTextMuted: string;
  nodeInsetBg: string;
  nodeInsetBorder: string;
  appBarGradient: string;
  navBg: string;
  drawerBg: string;
  drawerGradient: string;
  dialogBg: string;
  paperMuted: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  /*
   * One rule for the two families, so the app does not look like two products:
   *   • `accent` (blue) belongs to the DIAGRAM — relationships, edges, sequence
   *     activation bars. It is the same colour as `edgeStroke` on purpose.
   *   • `brand` belongs to the CHROME — links, active nav state, secondary
   *     actions, anything a person clicks outside the model.
   * A blue button or a blue link is a bug; a chrome-coloured edge would be
   * one too.
   */
  /** Relationship blue — GitLab blue-400/500. Diagram only. */
  accent: string;
  accentSoft: string;
  /**
   * Chrome neutral — slate on paper, warm stone on the dark board. This is
   * what links, active states and borders are made of, and it is deliberately
   * not a colour: a diagram already carries every colour its technologies
   * bring, and a saturated interface around it reads as one more thing to
   * look at rather than as the frame it is.
   *
   * The one saturated thing left is `bg.brand.emphasis` — amber, on filled
   * primary actions only. Grey everywhere including there was the first
   * attempt and it cost the hierarchy: with nothing saturated left, the main
   * action looked disabled.
   */
  brand: string;
  brandSoft: string;
  brandDark: string;
  /**
   * The chrome accent at a weight that survives on text and small icons —
   * a shade deeper than `brand` on light, a shade lighter on dark.
   */
  brandText: string;
  border: string;
  borderStrong: string;
  /** Focused field outline — neutral, never the active C4 level's colour. */
  borderFocus: string;
  /** Filled neutral action (primary buttons) and the text on it. */
  neutralSolid: string;
  neutralSolidHover: string;
  onNeutralSolid: string;
  iconButtonBg: string;
  iconButtonHover: string;
  titleGradient: string;
  inputBorder: string;
  listHover: string;
  listSelected: string;
  /** Floating surfaces (dialogs, drawers, search). */
  shadow: string;
  /** Controls, icon buttons, chips — subtle raised. */
  shadowSm: string;
  /** Panels, rails, header — mid elevation. */
  shadowMd: string;
  /** Pressed / inset interactive state. */
  shadowInset: string;
}

/**
 * One base hue per C4 level, shared by the canvas, the chrome tokens in
 * `chakra-system.ts` and anything else that needs to say "this is a container".
 * They are the product's own GitLab-family palette, not framework defaults, so a
 * diagram reads as part of the app in both themes — same hue in light and dark,
 * only the lightness changes.
 */
export const C4_BASE_COLORS = {
  system: { light: '#1f75cb', dark: '#428fdc' },
  container: { light: '#108548', dark: '#2da160' },
  component: { light: '#ab6e1f', dark: '#cd8528' },
  code: { light: '#6b4fbb', dark: '#8b6fd4' },
  connection: { light: '#1f75cb', dark: '#5b9fe0' },
} as const;

/** Hover tint of a base hue — one shade brighter in dark, one deeper in light. */
const C4_HOVER_COLORS = {
  system: { light: '#1a63ad', dark: '#63a6e9' },
  container: { light: '#0c6b3a', dark: '#4cbb82' },
  component: { light: '#8c5a19', dark: '#e0a33e' },
  code: { light: '#573f9c', dark: '#a58ce0' },
  connection: { light: '#1a63ad', dark: '#7eb3e8' },
} as const;

type C4Level = keyof typeof C4_BASE_COLORS;

/** Derive the full ColorStyle from a level's base hue, so themes cannot drift. */
function makeC4ColorStyle(level: C4Level, mode: PaletteMode): ColorStyle {
  const base = C4_BASE_COLORS[level][mode];
  const hover = C4_HOVER_COLORS[level][mode];
  const light = mode === 'light';
  return {
    primaryColor: base,
    secondaryColor: hover,
    background: withAlpha(base, light ? 0.08 : 0.14),
    gradient: withAlpha(base, light ? 0.1 : 0.16),
    gradientHover: withAlpha(base, light ? 0.16 : 0.24),
    border: base,
    hover,
    glow: `0 0 16px ${withAlpha(base, light ? 0.18 : 0.28)}`,
    gradientStart: base,
    gradientEnd: base,
    hoverGradientStart: withAlpha(base, light ? 0.16 : 0.24),
    hoverGradientEnd: withAlpha(base, light ? 0.16 : 0.24),
  };
}

function makeC4Colors(mode: PaletteMode) {
  return {
    system: makeC4ColorStyle('system', mode),
    container: makeC4ColorStyle('container', mode),
    component: makeC4ColorStyle('component', mode),
    code: makeC4ColorStyle('code', mode),
    connection: makeC4ColorStyle('connection', mode),
  };
}

const darkC4Colors = makeC4Colors('dark');
const lightC4Colors = makeC4Colors('light');

export const darkChrome: ChromeColors = {
  // Cool slate shell, graphite chrome, blue for the model
  pageBg: '#101318',
  /* Deeper than the panels on purpose — cards have to lift off the board.
     Paired with NODE_SURFACE.dark in canvasSurfaces.ts; move both or neither. */
  canvasBg: '#13161c',
  canvasDot: 'rgba(200, 214, 232, 0.14)',
  edgeStroke: '#5b9fe0',
  edgeGlow: 'none',
  nodeText: '#e8edf5',
  nodeTextMuted: 'rgba(232, 237, 245, 0.72)',
  nodeInsetBg: 'rgba(214, 228, 245, 0.05)',
  nodeInsetBorder: 'rgba(214, 228, 245, 0.1)',
  appBarGradient: '#1d2027',
  navBg: '#1d2027',
  drawerBg: '#181b22',
  drawerGradient: '#181b22',
  dialogBg: '#1a1d24',
  paperMuted: 'rgba(214, 228, 245, 0.035)',
  textPrimary: '#e8edf5',
  textSecondary: '#b6c0cf',
  textMuted: '#8b94a3',
  accent: '#5b9fe0',
  accentSoft: '#7eb3e8',
  brand: '#a9998a',
  brandSoft: '#c0b2a4',
  brandDark: '#8a7b6d',
  brandText: '#bfb2a4',
  border: 'rgba(88, 98, 118, 0.75)',
  borderStrong: '#59637a',
  borderFocus: 'rgba(240, 245, 252, 0.92)',
  neutralSolid: '#e8edf5',
  neutralSolidHover: '#ffffff',
  onNeutralSolid: '#101318',
  iconButtonBg: 'rgba(214, 228, 245, 0.08)',
  iconButtonHover: 'rgba(255, 255, 255, 0.16)',
  titleGradient: '#bfb2a4',
  inputBorder: '#6b7488',
  listHover: 'rgba(255, 255, 255, 0.12)',
  listSelected: 'rgba(169, 153, 138, 0.2)',
  shadow:
    '0 12px 40px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(214, 228, 245, 0.07)',
  shadowSm:
    'inset 0 1px 0 rgba(214, 228, 245, 0.1), 0 1px 2px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(214, 228, 245, 0.06)',
  shadowMd:
    'inset 0 1px 0 rgba(214, 228, 245, 0.08), 0 4px 16px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(214, 228, 245, 0.07)',
  shadowInset:
    'inset 0 2px 4px rgba(0, 0, 0, 0.45), inset 0 0 0 1px rgba(214, 228, 245, 0.04)',
};

export const lightChrome: ChromeColors = {
  // Cool near-white shell, graphite chrome, blue for the model
  pageBg: '#f7f8fa',
  /* Almost the same value as a card — on a light board the separation is done
     by a hairline and a shadow, not by fill. That reads as paper and keeps the
     board quiet. The dark theme cannot borrow the trick: a shadow is invisible
     on near-black, so there NODE_SURFACE.dark has to carry it by tone. */
  canvasBg: '#fbfbfc',
  canvasDot: 'rgba(15, 23, 42, 0.12)',
  edgeStroke: '#1f75cb',
  edgeGlow: 'none',
  nodeText: '#0f172a',
  nodeTextMuted: 'rgba(15, 23, 42, 0.68)',
  nodeInsetBg: 'rgba(15, 23, 42, 0.035)',
  nodeInsetBorder: 'rgba(15, 23, 42, 0.08)',
  appBarGradient: '#ffffff',
  navBg: '#ffffff',
  drawerBg: '#ffffff',
  drawerGradient: '#ffffff',
  dialogBg: '#ffffff',
  paperMuted: 'rgba(15, 23, 42, 0.03)',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#64748b',
  accent: '#1f75cb',
  accentSoft: '#3d8fd9',
  brand: '#474d59',
  brandSoft: '#5f6673',
  brandDark: '#333944',
  brandText: '#3d434e',
  border: 'rgba(15, 23, 42, 0.14)',
  borderStrong: '#94a3b8',
  borderFocus: '#0f172a',
  neutralSolid: '#0f172a',
  neutralSolidHover: '#1e293b',
  onNeutralSolid: '#ffffff',
  iconButtonBg: 'rgba(15, 23, 42, 0.045)',
  iconButtonHover: 'rgba(71, 77, 89, 0.09)',
  titleGradient: '#3d434e',
  inputBorder: '#94a3b8',
  listHover: 'rgba(71, 77, 89, 0.06)',
  listSelected: 'rgba(71, 77, 89, 0.11)',
  /* On a near-white board these do real work rather than decorate — they are
     half of how a card is told apart from the ground. Cool-cast to match. */
  shadow:
    '0 12px 40px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(15, 23, 42, 0.05)',
  shadowSm:
    '0 1px 2px rgba(15, 23, 42, 0.06), 0 0 0 1px rgba(15, 23, 42, 0.05)',
  shadowMd:
    '0 1px 2px rgba(15, 23, 42, 0.06), 0 4px 12px rgba(15, 23, 42, 0.05), 0 0 0 1px rgba(15, 23, 42, 0.06)',
  shadowInset:
    'inset 0 2px 4px rgba(15, 23, 42, 0.1), inset 0 0 0 1px rgba(15, 23, 42, 0.05)',
};

export function getChrome(mode: PaletteMode): ChromeColors {
  return mode === 'light' ? lightChrome : darkChrome;
}

export function getC4Colors(mode: PaletteMode) {
  return mode === 'light' ? lightC4Colors : darkC4Colors;
}

/** Destructive / alert accent (replaces former MUI palette.error). */
export function getErrorColor(mode: PaletteMode): string {
  return mode === 'light' ? '#dd2b0e' : '#ec5941';
}
