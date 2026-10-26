import type { Edge, Node } from '@xyflow/react';
import { reuseRfEdges, reuseRfNodes } from '../reuseGraphItems';

describe('reuseRfNodes', () => {
  it('keeps the previous array and node objects when visuals match', () => {
    const prev: Node[] = [
      { id: 'a', position: { x: 1, y: 2 }, data: { name: 'A' } },
    ];
    const next: Node[] = [
      { id: 'a', position: { x: 1, y: 2 }, data: { name: 'A' } },
    ];
    const out = reuseRfNodes(prev, next);
    expect(out).toBe(prev);
    expect(out[0]).toBe(prev[0]);
  });

  it('replaces only nodes whose visual key changed', () => {
    const a: Node = { id: 'a', position: { x: 0, y: 0 }, data: { name: 'A' } };
    const b: Node = { id: 'b', position: { x: 1, y: 0 }, data: { name: 'B' } };
    const prev = [a, b];
    const next: Node[] = [
      { id: 'a', position: { x: 0, y: 0 }, data: { name: 'A' } },
      { id: 'b', position: { x: 9, y: 0 }, data: { name: 'B' } },
    ];
    const out = reuseRfNodes(prev, next);
    expect(out[0]).toBe(a);
    expect(out[1]).not.toBe(b);
    expect(out[1].position.x).toBe(9);
  });

  /* The bug this replaced a field list to fix: only the listed fields counted,
     so a saved method handed React Flow the card it already had and the canvas
     kept drawing the old verb until a level change rebuilt everything. */
  it.each(['method', 'endpoint', 'protocol', 'schemaFormat', 'url'])(
    'replaces a node when %s changes',
    (field) => {
      const prev: Node[] = [
        { id: 'a', position: { x: 0, y: 0 }, data: { name: 'A', [field]: 'before' } },
      ];
      const next: Node[] = [
        { id: 'a', position: { x: 0, y: 0 }, data: { name: 'A', [field]: 'after' } },
      ];
      const out = reuseRfNodes(prev, next);
      expect(out[0]).not.toBe(prev[0]);
      expect((out[0].data as Record<string, unknown>)[field]).toBe('after');
    }
  );

  it('ignores handlers, which are a new closure on every render', () => {
    const prev: Node[] = [
      { id: 'a', position: { x: 0, y: 0 }, data: { name: 'A', onEdit: () => {} } },
    ];
    const next: Node[] = [
      { id: 'a', position: { x: 0, y: 0 }, data: { name: 'A', onEdit: () => {} } },
    ];
    expect(reuseRfNodes(prev, next)).toBe(prev);
  });
});

describe('reuseRfEdges', () => {
  it('keeps previous edge objects when visuals match', () => {
    const prev: Edge[] = [
      { id: 'e1', source: 'a', target: 'b', data: { pathType: 'default' } },
    ];
    const next: Edge[] = [
      { id: 'e1', source: 'a', target: 'b', data: { pathType: 'default' } },
    ];
    const out = reuseRfEdges(prev, next);
    expect(out).toBe(prev);
    expect(out[0]).toBe(prev[0]);
  });

  it('replaces an edge when bidirectional changes', () => {
    const prev: Edge[] = [
      { id: 'e1', source: 'a', target: 'b', data: { bidirectional: false } },
    ];
    const next: Edge[] = [
      { id: 'e1', source: 'a', target: 'b', data: { bidirectional: true } },
    ];
    const out = reuseRfEdges(prev, next);
    expect(out[0]).not.toBe(prev[0]);
    expect(out[0].data).toEqual({ bidirectional: true });
  });
});

describe('reuseRfEdges and handles', () => {
  const edge = (over: Partial<Edge> = {}): Edge => ({
    id: 'a->b',
    source: 'a',
    target: 'b',
    sourceHandle: 'source-right-0',
    targetHandle: 'target-left-0',
    ...over,
  });

  it('gives back a new object when only the anchors moved', () => {
    /* Arranging rewrites nothing but the handles, so if this reuses the old
       object the canvas keeps drawing the line off the old face. */
    const prev = [edge()];
    const next = [edge({ sourceHandle: 'source-left-2', targetHandle: 'target-right-3' })];
    const out = reuseRfEdges(prev, next);
    expect(out[0]).toBe(next[0]);
    expect(out[0].sourceHandle).toBe('source-left-2');
  });

  it('still reuses an edge that did not change at all', () => {
    const prev = [edge()];
    const out = reuseRfEdges(prev, [edge()]);
    expect(out[0]).toBe(prev[0]);
  });
});
