import { describe, expect, it } from 'vitest';
import type { Node } from '@xyflow/react';
import {
  canDrillIntoNode,
  canDrillUp,
  drillUpLandingId,
  findHopNodeInDirection,
  findSpaceHopTarget,
  nodeTopPerch,
  pickStartHopNode,
} from '../duckHopNav';

function node(id: string, x: number, y: number): Node {
  return {
    id,
    type: 'system',
    position: { x, y },
    data: { name: id },
  };
}

describe('duckHopNav', () => {
  it('picks the node closest to the viewport center', () => {
    const nodes = [node('a', 0, 0), node('b', 100, 80), node('c', 118, 98)];
    expect(pickStartHopNode(nodes, { x: 270, y: 150 })?.id).toBe('c');
  });

  it('finds the nearest node in a direction', () => {
    const nodes = [node('here', 100, 100), node('right', 300, 110), node('far', 500, 200)];
    const here = nodes[0];
    expect(findHopNodeInDirection(nodes, here, 'right')?.id).toBe('right');
    expect(findHopNodeInDirection(nodes, here, 'left')).toBeNull();
  });

  it('space hops along connected neighbors', () => {
    const nodes = [node('a', 0, 0), node('b', 200, 0), node('c', 400, 0)];
    const edges = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'c' },
    ];
    expect(findSpaceHopTarget(nodes, edges, 'a', null)?.id).toBe('b');
    expect(findSpaceHopTarget(nodes, edges, 'b', 'a')?.id).toBe('c');
  });

  it('perches on the top edge center', () => {
    const n = node('a', 100, 200);
    expect(nodeTopPerch(n).y).toBe(200);
    expect(nodeTopPerch(n).x).toBeGreaterThan(100);
    expect(nodeTopPerch(n, { x: 50, y: 80 }).y).toBe(80);
  });

  it('allows drill only at matching levels', () => {
    const sys = node('s1', 0, 0);
    sys.data = { type: 'system' };
    const svc = node('c1', 0, 0);
    svc.data = { type: 'container' };
    expect(canDrillIntoNode(sys, 'system')).toBe(true);
    expect(canDrillIntoNode(svc, 'system')).toBe(false);
    expect(canDrillIntoNode(svc, 'container')).toBe(true);
  });

  it('maps Backspace drill-up to the parent element id', () => {
    expect(canDrillUp('system')).toBe(false);
    expect(canDrillUp('container')).toBe(true);
    expect(
      drillUpLandingId({
        viewLevel: 'container',
        activeSystemId: 'sys1',
      })
    ).toBe('sys1');
    expect(
      drillUpLandingId({
        viewLevel: 'component',
        activeContainerId: 'c1',
      })
    ).toBe('c1');
    expect(
      drillUpLandingId({
        viewLevel: 'code',
        activeComponentId: 'cmp1',
      })
    ).toBe('cmp1');
  });
});
