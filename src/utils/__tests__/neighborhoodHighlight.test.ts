import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import {
  flowMotionForEdge,
  isNeighborhoodEdge,
  resolveNeighborhood,
  type NeighborhoodHighlight,
} from '../neighborhoodHighlight';

describe('resolveNeighborhood', () => {
  const model = {
    viewLevel: 'component',
    systems: [],
    containers: [],
    components: [
      {
        id: 'ep1',
        name: 'GET /a',
        type: 'component',
        systemId: 's',
        containerId: 'c',
        position: { x: 0, y: 0 },
        connections: [{ targetId: 'ctrl' }],
      },
      {
        id: 'ep2',
        name: 'GET /b',
        type: 'component',
        systemId: 's',
        containerId: 'c',
        position: { x: 80, y: 0 },
        connections: [{ targetId: 'ctrl' }],
      },
      {
        id: 'ctrl',
        name: 'Controller',
        type: 'component',
        systemId: 's',
        containerId: 'c',
        position: { x: 0, y: 100 },
        connections: [{ targetId: 'svc' }],
      },
      {
        id: 'svc',
        name: 'Service',
        type: 'component',
        systemId: 's',
        containerId: 'c',
        position: { x: 0, y: 200 },
        connections: [],
      },
      {
        id: 'orphan',
        name: 'Orphan',
        type: 'component',
        systemId: 's',
        containerId: 'c',
        position: { x: 200, y: 0 },
        connections: [],
      },
    ],
    codeElements: [],
  } as FlatC4Model;

  it('highlights only immediate neighbors from an endpoint', () => {
    const hit = resolveNeighborhood(model, 'ep1');
    expect([...hit.nodeIds].sort()).toEqual(['ctrl', 'ep1']);
    expect(hit.nodeIds.has('svc')).toBe(false);
    expect(hit.nodeIds.has('ep2')).toBe(false);
    expect(isNeighborhoodEdge(hit, 'ep1', 'ctrl')).toBe(true);
    expect(isNeighborhoodEdge(hit, 'ctrl', 'svc')).toBe(false);
  });

  it('includes inbound neighbors when focusing a middle node', () => {
    const hit = resolveNeighborhood(model, 'ctrl');
    expect([...hit.nodeIds].sort()).toEqual(['ctrl', 'ep1', 'ep2', 'svc']);
    expect(isNeighborhoodEdge(hit, 'ep1', 'ctrl')).toBe(true);
    expect(isNeighborhoodEdge(hit, 'ep2', 'ctrl')).toBe(true);
    expect(isNeighborhoodEdge(hit, 'ctrl', 'svc')).toBe(true);
  });

  it('does not walk past neighbors', () => {
    const hit = resolveNeighborhood(model, 'svc');
    expect([...hit.nodeIds].sort()).toEqual(['ctrl', 'svc']);
  });

  it('treats bidirectional edges as neighbors both ways', () => {
    const biModel = {
      ...model,
      components: [
        {
          id: 'a',
          name: 'A',
          type: 'component',
          systemId: 's',
          containerId: 'c',
          position: { x: 0, y: 0 },
          connections: [{ targetId: 'b', bidirectional: true }],
        },
        {
          id: 'b',
          name: 'B',
          type: 'component',
          systemId: 's',
          containerId: 'c',
          position: { x: 80, y: 0 },
          connections: [{ targetId: 'c' }],
        },
        {
          id: 'c',
          name: 'C',
          type: 'component',
          systemId: 's',
          containerId: 'c',
          position: { x: 160, y: 0 },
          connections: [],
        },
      ],
    } as FlatC4Model;

    const fromB = resolveNeighborhood(biModel, 'b');
    expect([...fromB.nodeIds].sort()).toEqual(['a', 'b', 'c']);
    expect(isNeighborhoodEdge(fromB, 'a', 'b')).toBe(true);
    expect(isNeighborhoodEdge(fromB, 'b', 'c')).toBe(true);

    const fromA = resolveNeighborhood(biModel, 'a');
    expect([...fromA.nodeIds].sort()).toEqual(['a', 'b']);
    expect(fromA.nodeIds.has('c')).toBe(false);
  });

  it('inverts stored hop direction onto the rendered C4 edge', () => {
    const highlight: NeighborhoodHighlight = {
      nodeIds: new Set(['api', 'db']),
      edgeIds: new Set(['db->api']),
      flowMotion: new Map([['db->api', 'forward']]),
    };
    expect(flowMotionForEdge(highlight, 'api', 'db')).toBe('reverse');
    expect(flowMotionForEdge(highlight, 'db', 'api')).toBe('forward');
  });
});
