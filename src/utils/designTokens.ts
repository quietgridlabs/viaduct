import type { DesignTokenRecord } from '@/types/c4Extensions';

/**
 * Values pasted in rather than read out of a source.
 *
 * A design system usually mirrors something — a Figma file, a tokens file, the
 * code — and then hand-typing it is duplication that rots. But a project whose
 * decisions live nowhere else has no source to mirror: the person *is* the
 * source, and refusing them a way in closes the whole feature. So both shapes
 * are read here, and the one people actually have wins:
 *
 *   bg.dialog: #1a1d24        # panel background
 *   space.card = 12px
 *
 * …and JSON, flat or in the W3C design-token shape, flattened on dots:
 *
 *   { "bg": { "dialog": { "$value": "#1a1d24", "$type": "color" } } }
 */

const COLOR_RE = /^(#[0-9a-f]{3,8}|(rgb|hsl|oklch|lab|color)a?\()/i;
const LENGTH_RE = /^-?\d*\.?\d+(px|rem|em|%|vh|vw|ch)$/i;

/** Only ever a guess, and only where the value or the name says so plainly. */
export function inferTokenType(name: string, value: string): DesignTokenRecord['type'] {
  const key = name.toLowerCase();
  const raw = value.trim();
  if (COLOR_RE.test(raw)) return 'color';
  if (key.includes('radius') || key.includes('rounded')) return 'radius';
  if (key.includes('shadow') || key.includes('elevation')) return 'shadow';
  if (key.includes('font') || key.includes('text') || key.startsWith('type')) return 'type';
  if (LENGTH_RE.test(raw)) return 'space';
  return 'other';
}

function flattenJson(
  value: unknown,
  path: string[] = [],
  out: DesignTokenRecord[] = []
): DesignTokenRecord[] {
  if (value === null || value === undefined) return out;

  if (typeof value === 'string' || typeof value === 'number') {
    const name = path.join('.');
    if (name) out.push({ name, value: String(value), type: inferTokenType(name, String(value)) });
    return out;
  }

  if (typeof value !== 'object' || Array.isArray(value)) return out;

  const record = value as Record<string, unknown>;
  /* A W3C design token: the leaf carries `$value`, and its own `$type` beats
     anything guessed from the text. */
  if ('$value' in record || 'value' in record) {
    const name = path.join('.');
    const raw = String(record.$value ?? record.value ?? '');
    if (!name) return out;
    const declared = String(record.$type ?? record.type ?? '').toLowerCase();
    const type: DesignTokenRecord['type'] =
      declared === 'color'
        ? 'color'
        : declared === 'dimension' || declared === 'spacing'
          ? 'space'
          : declared === 'shadow'
            ? 'shadow'
            : declared === 'typography' || declared === 'fontfamily'
              ? 'type'
              : inferTokenType(name, raw);
    const description = String(record.$description ?? record.description ?? '').trim();
    out.push({ name, value: raw, type, ...(description ? { description } : {}) });
    return out;
  }

  for (const [key, child] of Object.entries(record)) {
    if (key.startsWith('$')) continue;
    flattenJson(child, [...path, key], out);
  }
  return out;
}

/**
 * @returns the values found, in the order they were written. Anything that
 *   cannot be read as a value is skipped rather than stored blank.
 */
export function parsePastedTokens(text: string): DesignTokenRecord[] {
  const trimmed = (text || '').trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('{')) {
    try {
      return flattenJson(JSON.parse(trimmed));
    } catch {
      /* Not JSON after all — fall through and read it as lines. */
    }
  }

  const out: DesignTokenRecord[] = [];
  for (const line of trimmed.split('\n')) {
    const rest = line.trim();
    if (!rest || rest.startsWith('//') || rest.startsWith('#')) continue;

    /* Name first, then the comment — the other way round loses `#1a1d24` to
       the comment mark, which is most of what people paste. */
    const split = rest.match(/^([^:=]+)[:=]\s*(.*)$/);
    if (!split) continue;
    const name = split[1].trim().replace(/^["']|["'],?$/g, '');

    let tail = split[2].trim();
    let description = '';
    /* `#` opens a comment unless it opens a colour. */
    const withComment = tail.match(/^(.*?)\s+(?:\/\/|#(?![0-9a-fA-F]{3,8}(?:\s|$)))\s?(.*)$/);
    if (withComment) {
      tail = withComment[1].trim();
      description = withComment[2].trim();
    }

    const value = tail.replace(/,$/, '').replace(/^["']|["']$/g, '');
    if (!name || !value) continue;
    out.push({
      name,
      value,
      type: inferTokenType(name, value),
      ...(description ? { description } : {}),
    });
  }
  return out;
}

/** Later wins, so pasting again over the same names updates rather than doubles. */
export function mergeTokens(
  existing: DesignTokenRecord[],
  incoming: DesignTokenRecord[]
): DesignTokenRecord[] {
  const byName = new Map(existing.map((token) => [token.name, token]));
  for (const token of incoming) byName.set(token.name, { ...byName.get(token.name), ...token });
  return [...byName.values()];
}

/**
 * Values read out of a design file, folded into what is already there.
 *
 * Two rules, and they differ because the two halves mean different things. A
 * **named style** carries a name somebody chose in the design file, so it wins
 * outright and merges over anything of the same name here. A **suggestion** is
 * a value nobody named, wearing a name this code guessed from the layer it sat
 * on: it is appended so it can be renamed before it is kept, and it is dropped
 * when its guessed name would collide with a real one — a guess must never
 * quietly overwrite a decision.
 *
 * @returns the draft to show, and how much of each half went into it.
 */
export function mergeReadValues(
  existing: DesignTokenRecord[],
  named: DesignTokenRecord[],
  suggestions: (DesignTokenRecord & { uses?: number; where?: string[] })[],
  describeUses?: (uses: number, where: string[]) => string
): { tokens: DesignTokenRecord[]; named: number; guessed: number } {
  const kept = mergeTokens(existing, named);
  const taken = new Set(kept.map((token) => token.name));
  const guessed: DesignTokenRecord[] = [];
  for (const entry of suggestions) {
    if (!entry.name || taken.has(entry.name)) continue;
    taken.add(entry.name);
    guessed.push({
      name: entry.name,
      value: entry.value,
      type: entry.type ?? 'other',
      ...(entry.uses && describeUses
        ? { description: describeUses(entry.uses, entry.where ?? []) }
        : {}),
    });
  }
  return { tokens: [...kept, ...guessed], named: named.length, guessed: guessed.length };
}
