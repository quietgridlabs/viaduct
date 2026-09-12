import { renderHook, act } from '@testing-library/react';
import {
  DEFAULT_CANVAS_PREFS,
  getCanvasPrefs,
  resetCanvasPrefs,
  setCanvasPrefs,
  useCanvasPrefs,
} from '../canvasPrefs';

const STORAGE_KEY = 'c4-canvas-prefs';

describe('canvasPrefs', () => {
  beforeEach(() => {
    resetCanvasPrefs();
  });

  it('starts with technology colours everywhere', () => {
    expect(getCanvasPrefs()).toEqual({
      nodeColors: 'technology',
      edgeColors: 'technology',
    });
  });

  it('patches one setting without disturbing the other', () => {
    setCanvasPrefs({ nodeColors: 'neutral' });
    expect(getCanvasPrefs()).toEqual({
      nodeColors: 'neutral',
      edgeColors: 'technology',
    });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) as string)).toEqual({
      nodeColors: 'neutral',
      edgeColors: 'technology',
    });
  });

  it('re-renders subscribers on a real change, and not on a no-op', () => {
    const { result, rerender } = renderHook(() => useCanvasPrefs());
    const first = result.current;
    expect(first.edgeColors).toBe('technology');

    act(() => setCanvasPrefs({ edgeColors: 'neutral' }));
    expect(result.current.edgeColors).toBe('neutral');
    expect(result.current).not.toBe(first);

    /* Same value again — the snapshot identity must hold, or every setter call
       would re-render the whole canvas. */
    const second = result.current;
    act(() => setCanvasPrefs({ edgeColors: 'neutral' }));
    rerender();
    expect(result.current).toBe(second);
  });

  it('ignores unrecognised values when reading storage back', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ nodeColors: 'rainbow', edgeColors: 'neutral' })
    );
    jest.resetModules();
    /* Storage is read once at module init, so a fresh import is the reload. */
    const fresh = await import('../canvasPrefs');
    expect(fresh.getCanvasPrefs()).toEqual({
      nodeColors: 'technology',
      edgeColors: 'neutral',
    });
  });

  it('falls back to the defaults on corrupt storage', async () => {
    localStorage.setItem(STORAGE_KEY, 'not json');
    jest.resetModules();
    const fresh = await import('../canvasPrefs');
    expect(fresh.getCanvasPrefs()).toEqual(DEFAULT_CANVAS_PREFS);
  });

  it('survives storage that refuses to write', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('quota exceeded');
    };
    try {
      expect(() => setCanvasPrefs({ nodeColors: 'neutral' })).not.toThrow();
      /* The choice still applies for this session even when it cannot persist. */
      expect(getCanvasPrefs().nodeColors).toBe('neutral');
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
