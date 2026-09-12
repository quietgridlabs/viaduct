/** First-visit title card — once per browser tab session. */
export const SEEN_KEY = 'viaduct-intro-v1';

/**
 * Share of the window the wordmark spans. Under 1 on purpose — the whole word
 * has to be readable at once, and the drift below needs room to move without
 * pushing a letter off the edge.
 */
export const WIDTH_RATIO = 0.84;

export const WORD = 'VIADUCT';
export const LETTER_STAGGER_MS = 62;
export const LETTER_MS = 620;
export const FADE_MS = 520;

/** The duck perches on this letter once the word has landed. */
export const DUCK_LETTER = WORD.indexOf('U');
export const HOP_MS = 500;
export const HOPS = 2;
/** Long enough for two hops, then the quack, then a beat to read it. */
export const HOLD_MS = HOP_MS * HOPS + 900;

export const DUCK_SIZE = 54;
export const DUCK_OVERLAP_PX = 30;
