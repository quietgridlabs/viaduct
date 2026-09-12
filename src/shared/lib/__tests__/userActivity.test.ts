import { markUserActive, resetUserActivity, trackUserActivity, userActiveSince } from '../userActivity';

describe('userActivity', () => {
  let stop: () => void;

  beforeEach(() => {
    stop = trackUserActivity();
    resetUserActivity(0);
  });

  afterEach(() => {
    stop();
  });

  it('reports nothing when the person has not touched anything', () => {
    expect(userActiveSince(Date.now())).toBe(false);
  });

  it('notices a keystroke', () => {
    const since = Date.now() - 1;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(userActiveSince(since)).toBe(true);
  });

  it('notices a pointer press and a mouse move', () => {
    for (const event of [new Event('pointerdown'), new Event('mousemove')]) {
      resetUserActivity(0);
      const since = Date.now() - 1;
      window.dispatchEvent(event);
      expect(userActiveSince(since)).toBe(true);
    }
  });

  it('accepts activity reported by hand', () => {
    const since = Date.now() - 1;
    markUserActive();
    expect(userActiveSince(since)).toBe(true);
  });

  it('goes quiet again once the last tracker unsubscribes', () => {
    stop();
    resetUserActivity(0);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(userActiveSince(Date.now() - 1)).toBe(false);
    /* afterEach calls stop() again — releasing twice must not go negative. */
    stop = trackUserActivity();
  });

  it('keeps listening while a second tracker is still interested', () => {
    const second = trackUserActivity();
    stop();
    resetUserActivity(0);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(userActiveSince(Date.now() - 1)).toBe(true);
    second();
    stop = trackUserActivity();
  });
});
