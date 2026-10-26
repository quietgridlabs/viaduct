import {
  handleSlotIds,
  pickEdgeHandles,
  pickLayeredEdgeHandles,
  routeArrangedEdges,
  routeKey,
} from '../edgeHandles';

describe('pickEdgeHandles', () => {
  it('leaves the right face for a card to the right', () => {
    expect(pickEdgeHandles({ x: 0, y: 0 }, { x: 400, y: 0 })).toEqual({
      sourceHandle: 'source-right-0',
      targetHandle: 'target-left-0',
    });
  });

  it('leaves the left face for a card to the left', () => {
    expect(pickEdgeHandles({ x: 400, y: 0 }, { x: 0, y: 0 })).toEqual({
      sourceHandle: 'source-left-2',
      targetHandle: 'target-right-3',
    });
  });

  it('goes out of the bottom for a card below', () => {
    expect(pickEdgeHandles({ x: 0, y: 0 }, { x: 0, y: 300 })).toEqual({
      sourceHandle: 'source-bottom-1',
      targetHandle: 'target-top-1',
    });
  });

  it('goes out of the top for a card above', () => {
    expect(pickEdgeHandles({ x: 0, y: 300 }, { x: 0, y: 0 })).toEqual({
      sourceHandle: 'source-top-3',
      targetHandle: 'target-bottom-2',
    });
  });

  it('follows the longer axis when the card sits on a diagonal', () => {
    /* Further across than down: this reads as a sideways hop, not a drop. */
    expect(pickEdgeHandles({ x: 0, y: 0 }, { x: 400, y: 120 }).sourceHandle).toBe(
      'source-right-0'
    );
    expect(pickEdgeHandles({ x: 0, y: 0 }, { x: 120, y: 400 }).sourceHandle).toBe(
      'source-bottom-1'
    );
  });

  it('only ever names handles every card has', () => {
    /* The `-sN` slots exist on wide sides but not on a person card, and an
       edge pointed at a handle that is not there is not drawn at all. */
    const seen = new Set<string>();
    for (const to of [
      { x: 400, y: 0 },
      { x: -400, y: 0 },
      { x: 0, y: 400 },
      { x: 0, y: -400 },
    ]) {
      const handles = pickEdgeHandles({ x: 0, y: 0 }, to);
      seen.add(handles.sourceHandle);
      seen.add(handles.targetHandle);
    }
    expect([...seen].every((id) => !id.includes('-s'))).toBe(true);
    expect(seen.size).toBe(8);
  });
});

describe('pickLayeredEdgeHandles', () => {
  it('goes sideways to the next column however far down it reaches', () => {
    expect(pickLayeredEdgeHandles({ x: 0, y: 0 }, { x: 376, y: 900 })).toEqual({
      sourceHandle: 'source-right-0',
      targetHandle: 'target-left-0',
    });
  });

  it('goes back sideways to a column behind it', () => {
    expect(pickLayeredEdgeHandles({ x: 376, y: 0 }, { x: 0, y: 900 })).toEqual({
      sourceHandle: 'source-left-2',
      targetHandle: 'target-right-3',
    });
  });

  it('goes vertically only within one column', () => {
    expect(pickLayeredEdgeHandles({ x: 80, y: 0 }, { x: 80, y: 300 })).toEqual({
      sourceHandle: 'source-bottom-1',
      targetHandle: 'target-top-1',
    });
    expect(pickLayeredEdgeHandles({ x: 80, y: 300 }, { x: 80, y: 0 })).toEqual({
      sourceHandle: 'source-top-3',
      targetHandle: 'target-bottom-2',
    });
  });
});

describe('handleSlotIds', () => {
  it('gives a long side three points, the middle one unsuffixed', () => {
    expect(handleSlotIds('source', 'bottom', false)).toEqual([
      'source-bottom-1-s0',
      'source-bottom-1',
      'source-bottom-1-s2',
    ]);
  });

  it('gives a short side two, the first unsuffixed', () => {
    expect(handleSlotIds('source', 'right', false)).toEqual([
      'source-right-0',
      'source-right-0-s1',
    ]);
  });

  it('gives a person one point, and never a suffixed id', () => {
    for (const side of ['right', 'left', 'top', 'bottom'] as const) {
      const ids = handleSlotIds('target', side, true);
      expect(ids).toHaveLength(1);
      expect(ids[0]).not.toContain('-s');
    }
  });
});

describe('routeArrangedEdges', () => {
  const nodes = (extra: Record<string, { x: number; y: number; person?: boolean }>) =>
    new Map(Object.entries(extra));

  it('spreads a bundle over both points of a short side, in order', () => {
    const map = nodes({
      hub: { x: 0, y: 400 },
      top: { x: 400, y: 0 },
      mid: { x: 400, y: 400 },
      low: { x: 400, y: 800 },
    });
    const routed = routeArrangedEdges(map, [
      { sourceId: 'hub', targetId: 'low' },
      { sourceId: 'hub', targetId: 'top' },
      { sourceId: 'hub', targetId: 'mid' },
    ]);
    /* Highest target takes the upper point, lowest the lower one, so the
       lines do not cross each other leaving the card. */
    expect(routed.get(routeKey('hub', 'top'))!.sourceHandle).toBe('source-right-0');
    expect(routed.get(routeKey('hub', 'low'))!.sourceHandle).toBe('source-right-0-s1');
  });

  it('keeps a person on its single point however many lines it has', () => {
    const map = nodes({
      actor: { x: 0, y: 400, person: true },
      a: { x: 400, y: 0 },
      b: { x: 400, y: 800 },
    });
    const routed = routeArrangedEdges(map, [
      { sourceId: 'actor', targetId: 'a' },
      { sourceId: 'actor', targetId: 'b' },
    ]);
    expect(routed.get(routeKey('actor', 'a'))!.sourceHandle).toBe('source-right-0');
    expect(routed.get(routeKey('actor', 'b'))!.sourceHandle).toBe('source-right-0');
  });

  it('spreads the arriving ends too, not just the leaving ones', () => {
    const map = nodes({
      a: { x: 0, y: 0 },
      b: { x: 0, y: 800 },
      sink: { x: 400, y: 400 },
    });
    const routed = routeArrangedEdges(map, [
      { sourceId: 'a', targetId: 'sink' },
      { sourceId: 'b', targetId: 'sink' },
    ]);
    const arriving = [
      routed.get(routeKey('a', 'sink'))!.targetHandle,
      routed.get(routeKey('b', 'sink'))!.targetHandle,
    ];
    expect(new Set(arriving).size).toBe(2);
  });

  it('skips an edge whose other end is not on this view', () => {
    const routed = routeArrangedEdges(nodes({ a: { x: 0, y: 0 } }), [
      { sourceId: 'a', targetId: 'elsewhere' },
    ]);
    expect(routed.size).toBe(0);
  });
});
