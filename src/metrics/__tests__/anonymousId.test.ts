/**
 * Browser-stable anonymous id for product metrics.
 */
import {
  ANON_ID_STORAGE_KEY,
  getOrCreateAnonymousId,
  isValidAnonymousId,
  resetAnonymousIdCacheForTests,
} from '@/metrics/anonymousId';

describe('anonymous metrics id', () => {
  beforeEach(() => {
    resetAnonymousIdCacheForTests();
    window.localStorage.clear();
  });

  it('accepts only the anon_uuid shape', () => {
    expect(isValidAnonymousId('anon_3f1c0a2e-9b77-4a1e-8f2d-6c0d1e2b3a44')).toBe(true);
    expect(isValidAnonymousId('3f1c0a2e-9b77-4a1e-8f2d-6c0d1e2b3a44')).toBe(false);
    expect(isValidAnonymousId('anon_not-a-uuid')).toBe(false);
    expect(isValidAnonymousId('')).toBe(false);
    expect(isValidAnonymousId(null)).toBe(false);
  });

  it('mints once and reuses the stored value', () => {
    const first = getOrCreateAnonymousId();
    const second = getOrCreateAnonymousId();
    expect(first).toBe(second);
    expect(isValidAnonymousId(first)).toBe(true);
    expect(window.localStorage.getItem(ANON_ID_STORAGE_KEY)).toBe(first);
  });

  it('replaces a corrupt stored value', () => {
    window.localStorage.setItem(ANON_ID_STORAGE_KEY, 'garbage');
    resetAnonymousIdCacheForTests();
    const next = getOrCreateAnonymousId();
    expect(isValidAnonymousId(next)).toBe(true);
    expect(window.localStorage.getItem(ANON_ID_STORAGE_KEY)).toBe(next);
  });
});
