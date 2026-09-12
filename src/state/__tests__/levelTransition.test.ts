/**
 * The ordering is the whole point of this module.
 *
 * A spinner over a blocking render only helps if it is already on screen when
 * the blocking starts, so the level change must happen *after* the flag has
 * been raised and the browser has been given a frame to paint it. A version
 * that flips the flag and changes level in the same tick looks identical from
 * the outside and does nothing useful — hence a test that pins the sequence
 * rather than the end state.
 */
import {
  getLevelTransitionSnapshot,
  resetLevelTransition,
  runLevelChange,
  subscribeLevelTransition,
} from '../levelTransition';

/** Drains queued animation frames, one batch at a time. */
function flushFrames(times = 1): void {
  for (let i = 0; i < times; i++) {
    jest.advanceTimersByTime(16);
  }
}

describe('runLevelChange', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    /* A fake rAF that runs on the timer queue, so the promise chain in the
       module can be stepped deterministically. */
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      const id = setTimeout(() => cb(performance.now()), 16);
      return id as unknown as number;
    }) as typeof window.requestAnimationFrame;
    resetLevelTransition();
  });

  afterEach(() => {
    resetLevelTransition();
    jest.useRealTimers();
  });

  it('raises the flag before the level actually changes', async () => {
    const order: string[] = [];
    subscribeLevelTransition(() => {
      order.push(getLevelTransitionSnapshot() ? 'flag:on' : 'flag:off');
    });

    runLevelChange(() => order.push('applied'));

    expect(order).toEqual(['flag:on']);
    expect(getLevelTransitionSnapshot()).toBe(true);

    /* Nothing has moved the canvas yet — that is the point. */
    expect(order).not.toContain('applied');

    flushFrames(2);
    await Promise.resolve();
    await Promise.resolve();

    expect(order[0]).toBe('flag:on');
    expect(order).toContain('applied');
    expect(order.indexOf('flag:on')).toBeLessThan(order.indexOf('applied'));
  });

  it('drops the flag once the new level has had a frame to paint', async () => {
    runLevelChange(() => {});
    expect(getLevelTransitionSnapshot()).toBe(true);

    flushFrames(2);
    await Promise.resolve();
    await Promise.resolve();
    flushFrames(2);
    await Promise.resolve();
    await Promise.resolve();

    expect(getLevelTransitionSnapshot()).toBe(false);
  });

  it('still applies the change when the level throws', async () => {
    const boom = () => {
      throw new Error('level blew up');
    };

    expect(() => {
      runLevelChange(boom);
      flushFrames(2);
    }).not.toThrow();

    /* And the canvas does not stay covered because of it. */
    flushFrames(4);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(getLevelTransitionSnapshot()).toBe(false);
  });

  it('applies immediately where nothing can paint', () => {
    const original = window.requestAnimationFrame;
    // @ts-expect-error — deliberately removing it, as in a test or prerender env
    delete window.requestAnimationFrame;

    let applied = false;
    runLevelChange(() => {
      applied = true;
    });

    expect(applied).toBe(true);
    expect(getLevelTransitionSnapshot()).toBe(false);

    window.requestAnimationFrame = original;
  });

  it('notifies subscribers and stops after unsubscribe', () => {
    const seen: boolean[] = [];
    const unsubscribe = subscribeLevelTransition(() => seen.push(getLevelTransitionSnapshot()));

    runLevelChange(() => {});
    expect(seen).toEqual([true]);

    unsubscribe();
    resetLevelTransition();
    expect(seen).toEqual([true]);
  });
});
