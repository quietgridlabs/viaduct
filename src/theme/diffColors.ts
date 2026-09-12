import type { PaletteMode } from '@theme/theme';

/**
 * The version-comparison palette — added / changed / gone. Deliberately
 * separate from every technology accent: a changed Kafka node has to read as
 * "changed" regardless of Kafka's own colour, or the two signals fight.
 *
 * Raw hex/rgba, not Chakra semantic tokens. The canvas accent pipeline
 * (`readableAccent` / `withAlpha` / `parseColor` in canvasSurfaces.ts) does
 * real pixel maths on the string and cannot parse a `var(--chakra-colors-*)`
 * reference — Chakra only resolves those through its own style engine. The
 * same values are also registered as Chakra tokens in chakra-system.ts
 * (`diff.added` etc.) for plain DOM usage in the comparison panel; keep both
 * in sync if this palette ever changes.
 */
export const DIFF_COLORS: Record<
  PaletteMode,
  { added: string; addedWash: string; changed: string; changedWash: string; gone: string }
> = {
  light: {
    added: '#059669',
    addedWash: 'rgba(5, 150, 105, 0.10)',
    changed: '#4f46e5',
    changedWash: 'rgba(79, 70, 229, 0.10)',
    gone: '#94a3b8',
  },
  dark: {
    added: '#34d399',
    addedWash: 'rgba(52, 211, 153, 0.12)',
    changed: '#818cf8',
    changedWash: 'rgba(129, 140, 248, 0.14)',
    gone: '#6b7688',
  },
};

export type DiffStatus = 'added' | 'changed' | 'gone';
