/**
 * Endpoint request/response contracts are JSON examples stored as strings.
 * Empty means "no contract"; anything else must parse as JSON so agents and
 * humans are looking at the same shape.
 */

export type JsonContractResult =
  | { ok: true; empty: true; formatted: '' }
  | { ok: true; empty: false; formatted: string; value: unknown }
  | { ok: false; error: string };

export function parseJsonContract(raw: string): JsonContractResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, empty: true, formatted: '' };
  try {
    const value = JSON.parse(trimmed);
    return {
      ok: true,
      empty: false,
      formatted: JSON.stringify(value, null, 2),
      value,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid JSON';
    return { ok: false, error: message.replace(/^JSON\.parse:\s*/i, '') };
  }
}

/** One-line preview for the field row — keeps the side panel readable. */
export function summarizeJsonContract(raw: string, emptyLabel: string): string {
  const parsed = parseJsonContract(raw);
  if (!parsed.ok) return raw.trim().slice(0, 80) || emptyLabel;
  if (parsed.empty) return emptyLabel;
  if (parsed.value === null) return 'null';
  if (Array.isArray(parsed.value)) return `Array(${parsed.value.length})`;
  if (typeof parsed.value === 'object') {
    const keys = Object.keys(parsed.value as object);
    if (keys.length === 0) return '{}';
    const head = keys.slice(0, 3).join(', ');
    return keys.length > 3 ? `{ ${head}, … }` : `{ ${head} }`;
  }
  return String(parsed.value);
}
