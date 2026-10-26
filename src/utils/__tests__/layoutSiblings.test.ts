import { layoutSiblings } from '../layoutSiblings';

describe('layoutSiblings', () => {
  it('places a request path left to right', () => {
    const positions = layoutSiblings(
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      [
        { sourceId: 'a', targetId: 'b' },
        { sourceId: 'b', targetId: 'c' },
      ]
    );
    expect(positions.get('a')!.x).toBeLessThan(positions.get('b')!.x);
    expect(positions.get('b')!.x).toBeLessThan(positions.get('c')!.x);
  });

  it('stacks same-group siblings in one column', () => {
    const positions = layoutSiblings(
      [
        { id: 'in', group: 'API' },
        { id: 'core', group: 'Domain' },
        { id: 'pg', group: 'Persistence' },
        { id: 'redis', group: 'Persistence' },
      ],
      [
        { sourceId: 'in', targetId: 'core' },
        { sourceId: 'core', targetId: 'pg' },
        { sourceId: 'core', targetId: 'redis' },
      ]
    );
    expect(positions.get('pg')!.x).toBe(positions.get('redis')!.x);
  });
});
