import {
  clearArrangeUndo,
  getArrangeUndo,
  setArrangeUndo,
  subscribeArrangeUndo,
} from '../arrangeUndo';

const offer = (over: Partial<NonNullable<ReturnType<typeof getArrangeUndo>>> = {}) => ({
  moved: 3,
  viewKey: 'system|||',
  revert: jest.fn(),
  ...over,
});

describe('arrangeUndo', () => {
  afterEach(() => clearArrangeUndo());

  it('starts with nothing on offer', () => {
    expect(getArrangeUndo()).toBeNull();
  });

  it('tells its listeners when an offer arrives and when it goes', () => {
    const seen = jest.fn();
    const stop = subscribeArrangeUndo(seen);

    setArrangeUndo(offer());
    expect(seen).toHaveBeenCalledTimes(1);
    expect(getArrangeUndo()?.moved).toBe(3);

    clearArrangeUndo();
    expect(seen).toHaveBeenCalledTimes(2);
    expect(getArrangeUndo()).toBeNull();

    stop();
    setArrangeUndo(offer());
    expect(seen).toHaveBeenCalledTimes(2);
  });

  it('stays quiet when asked to clear nothing', () => {
    const seen = jest.fn();
    const stop = subscribeArrangeUndo(seen);
    clearArrangeUndo();
    expect(seen).not.toHaveBeenCalled();
    stop();
  });

  it('replaces an older offer rather than stacking them', () => {
    setArrangeUndo(offer({ moved: 1 }));
    setArrangeUndo(offer({ moved: 9 }));
    expect(getArrangeUndo()?.moved).toBe(9);
  });

  it('carries the view it belongs to, so a stale one can be spotted', () => {
    setArrangeUndo(offer({ viewKey: 'container|sys||' }));
    expect(getArrangeUndo()?.viewKey).toBe('container|sys||');
  });
});
