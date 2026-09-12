/**
 * Canvas visual language — one source of truth for how nodes, their accents and
 * their action buttons look.
 *
 * The rules it encodes:
 *  • a node is a calm neutral panel (same family as dialogs and side panels),
 *    identity comes from a thin accent — border, header wash, icon chip — not
 *    from a saturated fill;
 *  • the accent is the element's technology colour whenever it has one, pushed
 *    into a readable band per theme instead of being dropped for grey;
 *  • elevation, rings and glows are shared with the app chrome, so the canvas
 *    reads as part of the product rather than a separate widget.
 */
import type { PaletteMode } from '@theme/theme';

export type NodeVisualState = 'idle' | 'hover' | 'linked' | 'selected' | 'highlight';

/**
 * Neutral panel the nodes are painted on, per theme.
 *
 * The two themes separate a card from the board by different means, because a
 * shadow only exists on light ground:
 *  • light — the panel is all but the board colour (1.03:1) and a hairline plus
 *    a soft shadow does the work, which is what makes the board read as paper;
 *  • dark — no shadow is visible on near-black, so the panel carries it by tone
 *    at 1.33:1 against `chrome.canvasBg`.
 * Either value moves only together with its `canvasBg`.
 */
const NODE_SURFACE: Record<PaletteMode, string> = {
  light: '#ffffff',
  dark: '#2a303b',
};

/* Third-party systems and people get no brand colour, so their border is the
   only thing separating them from the board — it cannot be the faintest one. */
const NEUTRAL_ACCENT: Record<PaletteMode, string> = {
  light: '#64748b',
  dark: '#a3aec0',
};

/*
 * The accent for our own elements on a colourless board.
 *
 * It sits closer to the panel than NEUTRAL_ACCENT does, so a third-party system
 * still stands apart from something we built even with every colour switched
 * off — that distinction is the one thing worth keeping when the rest goes.
 * In dark mode ours read deeper and theirs lighter; in light mode the other way
 * round. Either way: theirs contrast, ours recede.
 */
const QUIET_ACCENT: Record<PaletteMode, string> = {
  light: '#94a3b8',
  dark: '#5d6675',
};

/**
 * Panels for the colourless board.
 *
 * With every colour switched off, the one distinction still worth carrying is
 * ours versus someone else's — so a third-party system keeps a visibly
 * different panel rather than melting into the rest. Ours sits closest to the
 * board; theirs is lifted in dark mode and greyed in light mode. 1.37:1 and
 * 1.16:1 apart respectively.
 */
const PLAIN_PANEL: Record<PaletteMode, { own: string; external: string }> = {
  light: { own: '#ffffff', external: '#eceef0' },
  dark: { own: '#282e39', external: '#3c4351' },
};

/** Which panel a colourless element paints with. */
export type PlainRole = 'own' | 'external';

/** Width of every element card. Group frames and drops measure against it. */
/**
 * Narrow enough to give edges and their labels room between columns, wide
 * enough that names still fit on one line. Measured: down to 280 the text
 * reflows into the same number of lines and card height does not move; below
 * 250 the height starts climbing and the trade turns against you.
 *
 * Kept in step with CARD_WIDTH in the server's SVG renderer — an export that
 * draws cards at a different width than the canvas is worse than either.
 */
export const CANVAS_NODE_WIDTH = 270;

/**
 * The plain panel colour for anything that sits on a canvas without an accent —
 * sequence notes, edge labels. `chrome.dialogBg` is tuned to read against the
 * page, not against the board, and on the board it disappears.
 */
export function canvasPanelColor(mode: PaletteMode): string {
  return NODE_SURFACE[mode];
}

/**
 * The colourless accent.
 * @param external true for third-party systems and people, which stay visibly
 * apart from our own elements even when nothing else is coloured.
 */
export function neutralAccentColor(mode: PaletteMode, external = true): string {
  return external ? NEUTRAL_ACCENT[mode] : QUIET_ACCENT[mode];
}

// ── colour maths ─────────────────────────────────────────────────────────────

type Rgb = [number, number, number];

function parseColor(color: string): Rgb | null {
  const value = color.trim();
  const hex = value.replace('#', '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  if (/^[0-9a-fA-F]{6}$/.test(full)) {
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
    ];
  }
  const rgb = value.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}

function toHex([r, g, b]: Rgb): string {
  const part = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  if (s === 0) {
    const v = l * 255;
    return [v, v, v];
  }
  const hue = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue(h + 1 / 3) * 255, hue(h) * 255, hue(h - 1 / 3) * 255];
}

function relativeLuminance([r, g, b]: Rgb): number {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** `color` with an alpha channel, accepting hex or rgb() input. */
export function withAlpha(color: string, alpha: number): string {
  const rgb = parseColor(color);
  if (!rgb) return color;
  const [r, g, b] = rgb.map((v) => Math.round(v));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Keep the hue of a brand colour but move its lightness until it is legible on
 * the canvas of `mode`. Kafka white and JavaScript yellow stay recognisably
 * themselves instead of collapsing to grey.
 */
export function readableAccent(
  color: string | undefined,
  mode: PaletteMode,
  minContrast = 3
): string {
  const surface = parseColor(NODE_SURFACE[mode]) as Rgb;
  const parsed = color ? parseColor(color) : null;
  if (!parsed) return NEUTRAL_ACCENT[mode];

  const [h, rawS, rawL] = rgbToHsl(parsed);
  // Fully desaturated brand marks (white, black, grey) have no hue worth saving.
  const s = rawS < 0.08 ? 0 : clamp(rawS, 0.32, 0.92);
  /* Pure white (Kafka, Next.js) and pure black are legible but harsh as a card
     accent, so the band stops short of both ends. */
  let l = mode === 'light' ? clamp(rawL, 0.18, 0.92) : clamp(rawL, 0.14, 0.76);
  const step = mode === 'light' ? -0.025 : 0.025;

  for (let i = 0; i < 40; i += 1) {
    const rgb = hslToRgb(h, s, l);
    if (contrast(rgb, surface) >= minContrast) return toHex(rgb);
    l += step;
    if (l <= 0.06 || l >= 0.96) break;
  }
  return toHex(hslToRgb(h, s, clamp(l, 0.06, 0.96)));
}

// ── node surfaces ────────────────────────────────────────────────────────────

export type NodeSurface = {
  /** Panel fill (body). */
  bg: string;
  /** Accent wash laid over the whole card face. */
  tint: string;
  /** Accent-tinted header wash. */
  headerBg: string;
  headerBorder: string;
  border: string;
  borderHover: string;
  shadow: string;
  /** Chip behind the technology icon. */
  chipBg: string;
  chipBorder: string;
  /** Small round action buttons and handles. */
  handleFill: string;
};

function elevation(mode: PaletteMode, state: NodeVisualState, accent: string): string {
  /* Light carries half the card's separation from the board, so this is load
     bearing rather than decoration — cool-cast to sit on the slate neutrals. */
  const depth =
    mode === 'light'
      ? '0 1px 2px rgba(15, 23, 42, 0.07), 0 4px 12px rgba(15, 23, 42, 0.06)'
      : '0 1px 2px rgba(0, 0, 0, 0.50), 0 8px 22px rgba(0, 0, 0, 0.42)';

  /* Rings only. A blurred halo spreads the accent over the board around the
     card, so the thing it is meant to pick out is the one part of the picture
     with a soft edge — and on a dense level the halos of neighbours overlap
     into a wash.
     One width for all of them, and only the strength changes. Widening the
     ring as well as darkening it put six pixels of accent around a selected
     card, counting the border that also thickens, and that reads as a glow
     rather than as a selection. Alpha alone is enough to rank them, and a
     ring that never changes width cannot make the card look like it grew. */
  switch (state) {
    case 'highlight':
      return `0 0 0 2px ${withAlpha(accent, 0.5)}, ${depth}`;
    case 'selected':
      /* Stronger than linked/hover so RF selection (and left-click edit) is obvious. */
      return `0 0 0 2px ${withAlpha(accent, 0.85)}, ${depth}`;
    case 'linked':
      /* Endpoint of the selected connection — visible, but clearly weaker than
         a direct selection. */
      return `0 0 0 2px ${withAlpha(accent, 0.4)}, ${depth}`;
    case 'hover':
      return `0 0 0 2px ${withAlpha(accent, 0.18)}, ${depth}`;
    default:
      return depth;
  }
}

/**
 * Bright accents (JavaScript yellow, Go cyan) carry far more visual weight at
 * the same alpha than deep ones, so the wash is scaled by how luminous the
 * accent is. Without this the yellow cards shout and the navy ones whisper.
 */
function tintScale(accent: string): number {
  const rgb = parseColor(accent);
  if (!rgb) return 1;
  return 1 - 0.5 * relativeLuminance(rgb);
}

export function getNodeSurface(
  accent: string,
  mode: PaletteMode,
  state: NodeVisualState = 'idle',
  /** Set on a colourless board; the panel then carries ours-vs-theirs. */
  plain?: PlainRole
): NodeSurface {
  const light = mode === 'light';
  const scale = tintScale(accent);
  return {
    /* Very nearly opaque on purpose: at 0.88 the dot grid showed through every
       card and the text sat on a moving background. */
    bg: withAlpha(plain ? PLAIN_PANEL[mode][plain] : NODE_SURFACE[mode], 0.97),
    /* The panel now carries the separation from the board, so the accent wash
       can stay quiet — it says which kind of thing this is, nothing more. On a
       colourless board it says nothing at all, and the panel does the work. */
    tint: plain ? 'transparent' : withAlpha(accent, (light ? 0.07 : 0.11) * scale),
    headerBg: withAlpha(accent, (light ? 0.12 : 0.2) * scale),
    headerBorder: withAlpha(accent, light ? 0.4 : 0.38),
    /* Light is the hairline: the card is white on a near-white board, so the
       border plus the shadow is the whole separation and a heavy outline would
       read as a box rather than an edge. Dark asks more of the border because
       the panel is already doing tonal work. Measured, not guessed. */
    border: withAlpha(accent, light ? 0.4 : 0.55),
    borderHover: withAlpha(accent, light ? 0.62 : 0.85),
    shadow: elevation(mode, state, accent),
    chipBg: withAlpha(accent, (light ? 0.18 : 0.26) * scale),
    chipBorder: withAlpha(accent, light ? 0.28 : 0.34),
    handleFill: plain ? PLAIN_PANEL[mode][plain] : NODE_SURFACE[mode],
  };
}

/**
 * Accent a node paints with: its own colour, unless it belongs to someone else —
 * third-party systems stay deliberately colourless.
 */
export function resolveNodeAccent(
  accent: string,
  mode: PaletteMode,
  external?: boolean
): string {
  if (!external) return accent;
  return NEUTRAL_ACCENT[mode];
}

/**
 * Connection point on a node. The resting dot is deliberately quiet; the hover
 * treatment (a filled circle with a plus) lives in `index.css`, which needs two
 * things from here: the accent as `color`, and the ink that stays legible on
 * top of it.
 */
export function handleStyle(
  accent: string,
  mode: PaletteMode,
  opts: {
    source?: boolean;
    offsetY?: number;
    side?: boolean;
    /** Where along the side the point sits, 0 to 1. Centred when absent. */
    slot?: number;
  } = {}
): Record<string, string | number> {
  const surface = getNodeSurface(accent, mode);
  const size = opts.source ? 9 : 8;
  const along = `${(opts.slot ?? 0.5) * 100}%`;
  return {
    background: surface.handleFill,
    border: `2px solid ${accent}`,
    color: accent,
    ['--handle-ink' as string]: surface.handleFill,
    width: size,
    height: size,
    /* Above the card's own layers. A datastore's cap is painted over the face
       to give the cylinder its lid, and the top connection point sits inside
       that band — without a rank of its own it disappears under it. */
    zIndex: 2,
    boxShadow: `0 0 0 3px ${withAlpha(accent, 0.14)}`,
    /* React Flow keeps its own translate on the dot, so a percentage here
       centres the dot on that fraction of the side rather than starting it
       there. The offset re-centres a card that carries a glyph or a cylinder
       lid above its rectangle. */
    ...(opts.side
      ? { top: `calc(${along} + ${opts.offsetY ?? 0}px)` }
      : { left: along }),
  };
}

/** Corner radius shared with the app's bars, panels and dialogs. */
export const CANVAS_NODE_RADIUS = '10px';

/** Dot grid on the main C4 board (React Flow `<Background variant="dots">`). */
export const CANVAS_DOT_GAP = 20;
export const CANVAS_DOT_SIZE = 2.5;

/** Dot grid on embedded sequence / docs canvases. */
export const CANVAS_DOT_GAP_EMBED = 24;
export const CANVAS_DOT_SIZE_EMBED = 1.5;
