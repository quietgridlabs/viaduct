/**
 * Opening a domain from the map names a level but no element — a container-level
 * domain asked for the container board without saying which system's containers.
 * The board filtered its containers against nothing and came back empty, and the
 * URL, which only spells out a level it has the ids for, said `#/system` — which
 * is why reloading the page silently fixed it.
 */
import { renderableViewLevel } from '../serviceCatalog';

describe('the deepest level a set of ids can draw', () => {
  it('keeps a level that has the ids it needs', () => {
    expect(renderableViewLevel({ viewLevel: 'system' })).toBe('system');
    expect(renderableViewLevel({ viewLevel: 'container', activeSystemId: 's' })).toBe('container');
    expect(
      renderableViewLevel({ viewLevel: 'component', activeSystemId: 's', activeContainerId: 'c' })
    ).toBe('component');
    expect(
      renderableViewLevel({
        viewLevel: 'code',
        activeSystemId: 's',
        activeContainerId: 'c',
        activeComponentId: 'k',
      })
    ).toBe('code');
  });

  it('falls back to the system board when the parent is missing', () => {
    expect(renderableViewLevel({ viewLevel: 'container' })).toBe('system');
    expect(renderableViewLevel({ viewLevel: 'component' })).toBe('system');
    expect(renderableViewLevel({ viewLevel: 'code' })).toBe('system');
  });

  it('stops at the deepest parent it actually has', () => {
    expect(renderableViewLevel({ viewLevel: 'component', activeSystemId: 's' })).toBe('container');
    expect(renderableViewLevel({ viewLevel: 'code', activeSystemId: 's' })).toBe('container');
    expect(
      renderableViewLevel({ viewLevel: 'code', activeSystemId: 's', activeContainerId: 'c' })
    ).toBe('component');
  });

  it('never deepens a request', () => {
    expect(
      renderableViewLevel({
        viewLevel: 'system',
        activeSystemId: 's',
        activeContainerId: 'c',
        activeComponentId: 'k',
      })
    ).toBe('system');
    expect(
      renderableViewLevel({
        viewLevel: 'container',
        activeSystemId: 's',
        activeContainerId: 'c',
        activeComponentId: 'k',
      })
    ).toBe('container');
  });
});
