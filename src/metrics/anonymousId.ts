/**
 * Stable browser id for product metrics when there is no signed-in session.
 *
 * Prefixed so Viaduct Metrics can tell it apart from a real account id. Kept
 * in localStorage so two visits from the same profile look like one visitor;
 * never treated as an account — the server only uses it when there is no
 * cookie.
 */

export const ANON_ID_STORAGE_KEY = 'c4-anon-id';

const ANON_ID_RE =
  /^anon_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when the string is a metrics anonymous id we are willing to forward. */
export function isValidAnonymousId(value: unknown): value is string {
  return typeof value === 'string' && ANON_ID_RE.test(value);
}

function mintAnonymousId(): string {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
  return `anon_${uuid}`;
}

/** Survives the tab when localStorage is unavailable (private mode, etc.). */
let memoryAnonymousId: string | null = null;

/**
 * The id for this browser profile, creating one on first call.
 *
 * Safe to call from event handlers and module init — never throws.
 */
export function getOrCreateAnonymousId(): string | null {
  if (typeof window === 'undefined') return null;

  if (memoryAnonymousId && isValidAnonymousId(memoryAnonymousId)) {
    return memoryAnonymousId;
  }

  try {
    const existing = window.localStorage.getItem(ANON_ID_STORAGE_KEY);
    if (isValidAnonymousId(existing)) {
      memoryAnonymousId = existing;
      return existing;
    }
    const next = mintAnonymousId();
    window.localStorage.setItem(ANON_ID_STORAGE_KEY, next);
    memoryAnonymousId = next;
    return next;
  } catch {
    /* Quota / private mode — keep one id for this page lifetime. */
    const next = mintAnonymousId();
    memoryAnonymousId = next;
    return next;
  }
}

/** Test helper: drop the in-memory cache so storage is read again. */
export function resetAnonymousIdCacheForTests(): void {
  memoryAnonymousId = null;
}
