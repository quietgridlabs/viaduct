/**
 * Name rules: a preset table, a custom regular expression, or nothing.
 *
 * Shared by version names and branch names — the machinery is identical, and
 * the two modules that had it each said "keep in sync" with their server twin.
 * What differs is the presets, the error key and the examples.
 *
 * Keep in sync with `server/src/shared/namePattern.js`.
 */

export const CUSTOM_PREFIX = 'regex:';
export const MAX_CUSTOM_LENGTH = 200;

export type NamePatternKey<P> = 'none' | keyof P | 'custom';

export function createNameRules<P extends Record<string, RegExp>>(
  presets: P,
  errorKey: string
) {
  function compile(stored: string | null | undefined): RegExp | null {
    if (!stored?.trim()) return null;
    const trimmed = stored.trim();

    if (trimmed.startsWith(CUSTOM_PREFIX)) {
      const source = trimmed.slice(CUSTOM_PREFIX.length);
      if (!source || source.length > MAX_CUSTOM_LENGTH) return null;
      try {
        return new RegExp(source);
      } catch {
        return null;
      }
    }

    return presets[trimmed as keyof P] ?? null;
  }

  function isValidConfig(stored: string | null | undefined): boolean {
    if (stored == null || stored === '') return true;
    const trimmed = stored.trim();
    if (!trimmed) return true;

    if (trimmed.startsWith(CUSTOM_PREFIX)) {
      const source = trimmed.slice(CUSTOM_PREFIX.length);
      if (!source || source.length > MAX_CUSTOM_LENGTH) return false;
      try {
        new RegExp(source);
        return true;
      } catch {
        return false;
      }
    }

    return trimmed in presets;
  }

  function validate(
    name: string,
    stored: string | null | undefined
  ): { ok: true } | { ok: false; errorKey: string } {
    const regex = compile(stored);
    if (!regex) return { ok: true };
    if (!name.trim() || !regex.test(name.trim())) return { ok: false, errorKey };
    return { ok: true };
  }

  function serialize(key: NamePatternKey<P>, customRegex?: string): string | null {
    if (key === 'none') return null;
    if (key === 'custom') {
      const source = customRegex?.trim();
      return source ? `${CUSTOM_PREFIX}${source}` : null;
    }
    return String(key);
  }

  function deserialize(stored: string | null | undefined): {
    key: NamePatternKey<P>;
    customRegex: string;
  } {
    if (!stored?.trim()) return { key: 'none', customRegex: '' };
    const trimmed = stored.trim();
    if (trimmed.startsWith(CUSTOM_PREFIX)) {
      return { key: 'custom', customRegex: trimmed.slice(CUSTOM_PREFIX.length) };
    }
    if (trimmed in presets) return { key: trimmed as keyof P, customRegex: '' };
    return { key: 'none', customRegex: '' };
  }

  return { compile, isValidConfig, validate, serialize, deserialize };
}
