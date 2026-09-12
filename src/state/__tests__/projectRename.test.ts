import { emitProjectRenamed, subscribeProjectRename } from '../projectRename';

describe('projectRename', () => {
  it('delivers the new name to every listener', () => {
    const a = jest.fn();
    const b = jest.fn();
    const offA = subscribeProjectRename(a);
    const offB = subscribeProjectRename(b);

    emitProjectRenamed('p1', 'Alfa Seller landscape');

    expect(a).toHaveBeenCalledWith('p1', 'Alfa Seller landscape');
    expect(b).toHaveBeenCalledWith('p1', 'Alfa Seller landscape');
    offA();
    offB();
  });

  it('stops delivering once unsubscribed', () => {
    const listener = jest.fn();
    const off = subscribeProjectRename(listener);
    off();

    emitProjectRenamed('p1', 'Renamed');

    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps going when one listener throws', () => {
    const bad = jest.fn(() => {
      throw new Error('boom');
    });
    const good = jest.fn();
    const offBad = subscribeProjectRename(bad);
    const offGood = subscribeProjectRename(good);

    expect(() => emitProjectRenamed('p1', 'Renamed')).not.toThrow();
    expect(good).toHaveBeenCalledWith('p1', 'Renamed');
    offBad();
    offGood();
  });
});
