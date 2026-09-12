/**
 * "Quack" — rubber-duck mark for Quiet Grid Labs.
 * Say "Quiet Grid" fast and it quacks; the duck is the joke made visible.
 *
 * Art lives in a 100x100 user space; the drawing occupies x 5..99, y 12..82,
 * so the viewbox below crops the empty rows and keeps the duck optically
 * centred inside a square viewport.
 */

export const QUACK_VIEWBOX = '2 3 100 88';

/** Upturned tail nub, back-left. */
export const QUACK_TAIL = 'M19 48 C13 47 9 45 5 43 C7 51 10 58 15 65 Z';
/** Rounded floating body with the flattish waterline bottom. */
export const QUACK_BODY =
  'M12 62C12 48 26 41 46 43C64 45 79 52 79 64C79 74 68 82 46 82C24 82 12 74 12 62Z';
/** Head is a plain circle: cx/cy/r below. */
export const QUACK_HEAD = { cx: 62, cy: 33, r: 21 } as const;
/** Flat duck bill. */
export const QUACK_BILL = 'M74 31 C86 29 99 32 99 37 C99 42 86 45 74 45 Z';
/** Small side wing. */
export const QUACK_WING = 'M28 55C35 49 49 49 56 57C50 66 35 68 29 62Z';
export const QUACK_EYE = { cx: 67, cy: 27, r: 5.6 } as const;
export const QUACK_PUPIL = { cx: 68, cy: 27.5, r: 2.9 } as const;

/** Same amber as `brand.emphasis` / `bg.brand.emphasis` chakra tokens. */
export const QUACK_ACCENT = '#f09a05';
export const QUACK_ACCENT_DEEP = '#c47c00';

/* The bath-toy palette the name has always implied. Yellow sits next to the
   brand orange rather than fighting it — they are neighbours on the wheel, so
   the mark stays in family while finally looking like the joke it is. */
export const QUACK_YELLOW = '#FFD21E';
/** Wing and shading: the same yellow turned down, as moulded plastic shades. */
export const QUACK_YELLOW_DEEP = '#EFA80B';
/** Bill: the brand's own soft amber, which is also what the toy's bill is. */
export const QUACK_BILL_ORANGE = '#FCA326';
/* Yellow on white is barely a shape — about 1.4:1 — and the mark renders as
   small as 16px. A deep amber edge gives the silhouette back on light chrome;
   on dark the yellow already carries itself and needs none. */
export const QUACK_OUTLINE_LIGHT = '#C07C05';

/** Body ink: graphite on light chrome, near-white on dark. */
export const QUACK_INK_LIGHT = '#1D2430';
export const QUACK_INK_DARK = '#E8EEF5';
export const QUACK_EYE_WHITE = '#FFFFFF';
export const QUACK_PUPIL_INK = '#121926';

export type QuackVariant = 'mono' | 'solid';

export type QuackPalette = {
  body: string;
  bill: string;
  wing: string;
  eye: string;
  pupil: string;
  /** Silhouette edge, set only where the body would otherwise vanish. */
  outline?: string;
};

/** `mono` = ink body + orange bill; `solid` = all-orange mark. */
export function quackPalette(
  variant: QuackVariant,
  mode: 'light' | 'dark'
): QuackPalette {
  if (variant === 'solid') {
    return {
      body: QUACK_ACCENT,
      bill: QUACK_ACCENT_DEEP,
      wing: QUACK_ACCENT_DEEP,
      eye: QUACK_INK_LIGHT,
      pupil: QUACK_INK_LIGHT,
    };
  }
  /* Yellow in both modes: a rubber duck that changed colour with the theme
     would stop being a rubber duck. */
  return {
    body: QUACK_YELLOW,
    bill: QUACK_BILL_ORANGE,
    wing: QUACK_YELLOW_DEEP,
    eye: QUACK_EYE_WHITE,
    pupil: QUACK_PUPIL_INK,
    outline: mode === 'dark' ? undefined : QUACK_OUTLINE_LIGHT,
  };
}
