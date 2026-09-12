import { ghostBelongsToView, type ViewContext } from '../ghostVisibility';

const view = (over: Partial<ViewContext> = {}): ViewContext => ({
  viewLevel: 'system',
  activeSystemId: undefined,
  activeContainerId: undefined,
  activeComponentId: undefined,
  ...over,
});

describe('ghostBelongsToView', () => {
  it('a removed system shows at the system level, unconditionally', () => {
    expect(ghostBelongsToView({ level: 'system' }, view({ viewLevel: 'system' }))).toBe(true);
  });

  it('a removed system never shows at any other level', () => {
    expect(
      ghostBelongsToView({ level: 'system' }, view({ viewLevel: 'container' }))
    ).toBe(false);
  });

  it('a removed container from system A does not show while viewing system B', () => {
    const ghost = { level: 'container' as const, systemId: 'sys-A' };
    expect(
      ghostBelongsToView(ghost, view({ viewLevel: 'container', activeSystemId: 'sys-B' }))
    ).toBe(false);
    expect(
      ghostBelongsToView(ghost, view({ viewLevel: 'container', activeSystemId: 'sys-A' }))
    ).toBe(true);
  });

  it('a removed component only shows under its own system AND container', () => {
    const ghost = { level: 'component' as const, systemId: 'sys-A', containerId: 'cnt-1' };
    expect(
      ghostBelongsToView(
        ghost,
        view({ viewLevel: 'component', activeSystemId: 'sys-A', activeContainerId: 'cnt-2' })
      )
    ).toBe(false);
    expect(
      ghostBelongsToView(
        ghost,
        view({ viewLevel: 'component', activeSystemId: 'sys-A', activeContainerId: 'cnt-1' })
      )
    ).toBe(true);
  });

  it('a removed code element needs system, container AND component to all match', () => {
    const ghost = {
      level: 'code' as const,
      systemId: 'sys-A',
      containerId: 'cnt-1',
      componentId: 'cmp-1',
    };
    const base = {
      viewLevel: 'code',
      activeSystemId: 'sys-A',
      activeContainerId: 'cnt-1',
    };
    expect(ghostBelongsToView(ghost, view({ ...base, activeComponentId: 'cmp-2' }))).toBe(false);
    expect(ghostBelongsToView(ghost, view({ ...base, activeComponentId: 'cmp-1' }))).toBe(true);
  });
});
