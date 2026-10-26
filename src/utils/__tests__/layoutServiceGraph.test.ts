import { GRAPH_LAYOUT, layoutServiceGraph } from '../layoutServiceGraph';

const link = (sourceId: string, targetId: string) => ({ sourceId, targetId });

const inside = (
  point: { x: number; y: number },
  box: { x: number; y: number; width: number; height: number }
) =>
  point.x >= box.x &&
  point.y >= box.y &&
  point.x + GRAPH_LAYOUT.nodeW <= box.x + box.width &&
  point.y + GRAPH_LAYOUT.nodeH <= box.y + box.height;

describe('layoutServiceGraph', () => {
  it('puts a system’s containers inside its box, its own orb among them', async () => {
    /* The whole reason for ELK's hierarchy: containment is a forest over the
       same vertices the calls run between, and the layering has to respect
       it. Laid out flat, a system's containers land wherever the call graph
       puts them. */
    const { positions, boxes } = await layoutServiceGraph(
      [
        { id: 'shop' },
        { id: 'api', parentId: 'shop' },
        { id: 'db', parentId: 'shop' },
      ],
      [link('api', 'db')]
    );

    const box = boxes.get('shop')!;
    expect(box).toBeDefined();
    for (const id of ['shop', 'api', 'db']) {
      expect(inside(positions.get(id)!, box)).toBe(true);
    }
  });

  it('gives a box only to a system that holds something', async () => {
    const { positions, boxes } = await layoutServiceGraph(
      [{ id: 'shop' }, { id: 'crm' }],
      [link('shop', 'crm')]
    );
    expect(boxes.size).toBe(0);
    expect(positions.size).toBe(2);
  });

  it('ranks a callee below its caller', async () => {
    const { positions } = await layoutServiceGraph(
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      [link('a', 'b'), link('b', 'c')]
    );
    expect(positions.get('a')!.y).toBeLessThan(positions.get('b')!.y);
    expect(positions.get('b')!.y).toBeLessThan(positions.get('c')!.y);
  });

  it('ranks across a boundary, not only within one', async () => {
    /* A call from outside a system to a container inside it still has to put
       them on different layers — that is what INCLUDE_CHILDREN buys over
       laying each box out on its own. */
    const { positions } = await layoutServiceGraph(
      [{ id: 'gateway' }, { id: 'shop' }, { id: 'api', parentId: 'shop' }],
      [link('gateway', 'api')]
    );
    expect(positions.get('gateway')!.y).toBeLessThan(positions.get('api')!.y);
  });

  it('stands a node up on its own when its parent is not drawn', async () => {
    const { positions, boxes } = await layoutServiceGraph(
      [{ id: 'orphan', parentId: 'gone' }],
      []
    );
    expect(positions.has('orphan')).toBe(true);
    expect(boxes.size).toBe(0);
  });

  it('keeps two systems’ boxes apart', async () => {
    const { boxes } = await layoutServiceGraph(
      [
        { id: 'shop' },
        { id: 'shop-api', parentId: 'shop' },
        { id: 'crm' },
        { id: 'crm-api', parentId: 'crm' },
      ],
      [link('shop', 'crm')]
    );

    const a = boxes.get('shop')!;
    const b = boxes.get('crm')!;
    const overlaps =
      a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    expect(overlaps).toBe(false);
  });

  it('answers an empty graph with nothing', async () => {
    const { positions, boxes } = await layoutServiceGraph([], []);
    expect(positions.size).toBe(0);
    expect(boxes.size).toBe(0);
  });
});
