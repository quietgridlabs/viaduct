import type { Node } from '@xyflow/react';
import { buildGroupFrameNodes, moveGroupFrame } from '../elementGroups';

describe('moveGroupFrame', () => {
  const size = { measured: { width: 100, height: 50 } };

  it('shifts every member by the frame delta and leaves the rest alone', () => {
    const xs: Node[] = [
      { id: 'a', position: { x: 0, y: 0 }, data: { group: 'Payments' }, ...size },
      { id: 'b', position: { x: 200, y: 100 }, data: { group: 'payments' }, ...size },
      { id: 'c', position: { x: 500, y: 500 }, data: {}, ...size },
    ];
    const [frame] = buildGroupFrameNodes(xs);
    const to = { x: frame.position.x + 30, y: frame.position.y - 10 };
    expect(moveGroupFrame(frame.id, to, xs)).toEqual([
      { id: 'a', position: { x: 30, y: -10 } },
      { id: 'b', position: { x: 230, y: 90 } },
    ]);
  });

  it('moves nothing for a frame that is not there', () => {
    const xs: Node[] = [{ id: 'a', position: { x: 0, y: 0 }, data: { group: 'Payments' }, ...size }];
    expect(moveGroupFrame('__group:other', { x: 10, y: 10 }, xs)).toEqual([]);
  });

  it('builds frames that drag only by their title', () => {
    const [frame] = buildGroupFrameNodes([{ id: 'a', position: { x: 0, y: 0 }, data: { group: 'Payments' }, ...size }]);
    expect(frame.dragHandle).toBe('.group-frame-handle');
    expect(frame.draggable).toBeUndefined();
  });
});
