import { readableAccent, withAlpha } from '@theme/canvasSurfaces';
import { useSyncExternalStore } from 'react';

/*
 * A colour per tag.
 *
 * The colour is not stored anywhere until someone changes it: it is derived
 * from the tag's own name. A truly random pick would have to be written down
 * the moment a tag first appeared, and would then differ between two people
 * looking at the same model — the same `pci` in two colours is worse than no
 * colour at all. Hashing the name gives the same scattered-looking assignment
 * with none of that: stable across reloads, across levels, and across people.
 *
 * Overrides are per person and per browser, like the canvas colour preference —
 * the model's schema has no slot for them, and inventing one in a document
 * that syncs live is a heavier change than a colour choice deserves.
 */

const STORAGE_KEY = 'c4-tag-colors';

/**
 * Ten hues that stay apart from each other and legible on both boards. Used as
 * ink and border with a low-alpha wash behind, so each one has to survive on
 * the near-black canvas and on paper — that rules out the darkest and the
 * palest ends of every hue.
 */
export const TAG_PALETTE = [
  { id: 'red', hex: '#e0605f' },
  { id: 'amber', hex: '#e08a3c' },
  { id: 'gold', hex: '#c9a227' },
  { id: 'green', hex: '#68ad4e' },
  { id: 'teal', hex: '#3aab97' },
  { id: 'blue', hex: '#4a9ee0' },
  { id: 'indigo', hex: '#7c86e0' },
  { id: 'purple', hex: '#a86fd4' },
  { id: 'pink', hex: '#d46ba8' },
  { id: 'slate', hex: '#8b93a3' },
] as const;

/** FNV-1a: cheap, and spreads short strings like tag names well. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

type Overrides = Record<string, string>;

function isHex(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

function read(): Overrides {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Overrides = {};
    for (const [tag, color] of Object.entries(parsed as Overrides)) {
      if (isHex(color)) out[tag.toLowerCase()] = color;
    }
    return out;
  } catch {
    /* Corrupt or unavailable storage must not take the board down. */
    return {};
  }
}

let current: Overrides = read();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): Overrides {
  return current;
}

/** Pass `null` to hand the tag back to its name-derived colour. */
export function setTagColor(tag: string, color: string | null): void {
  const key = tag.trim().toLowerCase();
  if (!key) return;
  const next = { ...current };
  if (color && isHex(color)) next[key] = color;
  else delete next[key];
  current = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* Session-only is better than refusing the change. */
  }
  listeners.forEach((listener) => listener());
}

export function tagColorFrom(overrides: Overrides, tag: string): string {
  const key = tag.trim().toLowerCase();
  return overrides[key] || TAG_PALETTE[hash(key) % TAG_PALETTE.length].hex;
}

/** Reactive: re-renders when someone repaints a tag. */
export function useTagColors(): (tag: string) => string {
  const overrides = useSyncExternalStore(subscribe, snapshot, snapshot);
  return (tag: string) => tagColorFrom(overrides, tag);
}

/** Whether this tag is wearing a colour someone chose by hand. */
export function useTagColorOverridden(tag: string): boolean {
  const overrides = useSyncExternalStore(subscribe, snapshot, snapshot);
  return Boolean(overrides[tag.trim().toLowerCase()]);
}

/**
 * How a tag chip is painted, wherever it is shown: the rail, the card, the
 * edit dialog. One function because the three had already drifted — the
 * dialog's chips were a grey pill with no colour on them at all — and a wash
 * that differs by a hundredth between two surfaces is a bug nobody will ever
 * be told about.
 *
 * Size and radius stay with each caller via `ElementTag` (`tagSize`): a 26px
 * control in the rail and an 18px tag on a card are not meant to match, only
 * to be recognisably the same tag.
 */
export function tagChipColors(
  color: string,
  mode: 'light' | 'dark',
  active = false
): { bg: string; borderColor: string; color: string; hoverBg: string } {
  const wash = mode === 'light' ? 0.14 : 0.2;
  return {
    bg: withAlpha(color, active ? 0.3 : wash),
    borderColor: withAlpha(color, active ? 0.95 : 0.45),
    color: readableAccent(color, mode, 4.5),
    hoverBg: withAlpha(color, active ? 0.36 : wash + 0.08),
  };
}
