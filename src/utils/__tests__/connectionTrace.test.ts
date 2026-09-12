import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import {
  buildTraceFromContainerEdge,
  layoutOffsetForTarget,
  relatedIdsForContainer,
  resolveRelatedComponentIds,
} from '../connectionTrace';

const baseModel = (): FlatC4Model =>
  ({
    viewLevel: 'container',
    systems: [{ id: 'sys1', name: 'S', type: 'system', position: { x: 0, y: 0 }, connections: [] }],
    containers: [
      {
        id: 'c1',
        name: 'API',
        type: 'container',
        systemId: 'sys1',
        position: { x: 0, y: 0 },
        connections: [{ targetId: 'c2', technology: 'kafka', label: 'events' }],
      },
      {
        id: 'c2',
        name: 'Worker',
        type: 'container',
        systemId: 'sys1',
        position: { x: 400, y: 0 },
        connections: [],
      },
    ],
    components: [
      {
        id: 'ctrl',
        name: 'Controller',
        type: 'component',
        systemId: 'sys1',
        containerId: 'c1',
        position: { x: 0, y: 0 },
        connections: [{ targetId: 'svc' }],
      },
      {
        id: 'svc',
        name: 'Service',
        type: 'component',
        systemId: 'sys1',
        containerId: 'c1',
        position: { x: 0, y: 120 },
        connections: [{ targetId: 'producer', technology: 'kafka' }],
      },
      {
        id: 'producer',
        name: 'KafkaProducer',
        type: 'component',
        systemId: 'sys1',
        containerId: 'c1',
        technology: 'kafka',
        position: { x: 0, y: 240 },
        connections: [],
      },
      {
        id: 'consumer',
        name: 'KafkaConsumer',
        type: 'component',
        systemId: 'sys1',
        containerId: 'c2',
        technology: 'kafka',
        position: { x: 0, y: 0 },
        connections: [{ targetId: 'handler' }],
      },
      {
        id: 'handler',
        name: 'Handler',
        type: 'component',
        systemId: 'sys1',
        containerId: 'c2',
        position: { x: 0, y: 120 },
        connections: [],
      },
      {
        id: 'orphan',
        name: 'Orphan',
        type: 'component',
        systemId: 'sys1',
        containerId: 'c1',
        position: { x: 200, y: 0 },
        connections: [],
      },
    ],
    codeElements: [],
  }) as FlatC4Model;

describe('resolveRelatedComponentIds', () => {
  it('returns empty without explicit relatedComponentIds', () => {
    const model = baseModel();
    const ids = resolveRelatedComponentIds(model, 'c1', 'c2', {
      targetId: 'c2',
      technology: 'kafka',
    });
    expect(ids).toEqual([]);
  });

  it('expands explicit relatedComponentIds along outgoing edges only', () => {
    const model = baseModel();
    const ids = resolveRelatedComponentIds(model, 'c1', 'c2', {
      targetId: 'c2',
      relatedComponentIds: ['ctrl'],
    } as never);
    expect(ids).toEqual(expect.arrayContaining(['ctrl', 'svc', 'producer']));
    expect(ids).not.toContain('orphan');
    expect(ids).not.toContain('consumer');
  });

  it('does not pull sibling endpoints that share a downstream controller', () => {
    const model = baseModel();
    model.components.push(
      {
        id: 'ep1',
        name: 'GET /a',
        type: 'component',
        systemId: 'sys1',
        containerId: 'c1',
        position: { x: 0, y: -80 },
        connections: [{ targetId: 'ctrl' }],
      } as never,
      {
        id: 'ep2',
        name: 'GET /b',
        type: 'component',
        systemId: 'sys1',
        containerId: 'c1',
        position: { x: 80, y: -80 },
        connections: [{ targetId: 'ctrl' }],
      } as never
    );
    const ids = resolveRelatedComponentIds(model, 'c1', 'c2', {
      targetId: 'c2',
      relatedComponentIds: ['ep1'],
    } as never);
    expect(ids).toEqual(expect.arrayContaining(['ep1', 'ctrl', 'svc', 'producer']));
    expect(ids).not.toContain('ep2');
    expect(ids).not.toContain('orphan');
  });
});

describe('relatedIdsForContainer', () => {
  it('lists only explicit related ids in that container', () => {
    const model = baseModel();
    const conn = {
      targetId: 'c2',
      relatedComponentIds: ['ctrl', 'consumer'],
    } as never;
    expect(relatedIdsForContainer(model, 'c1', conn)).toEqual(['ctrl']);
    expect(relatedIdsForContainer(model, 'c2', conn)).toEqual(['consumer']);
    expect(relatedIdsForContainer(model, 'c1', { targetId: 'c2' })).toEqual([]);
  });
});

describe('layoutOffsetForTarget', () => {
  it('offsets overlapping target components to the right of source', () => {
    const offset = layoutOffsetForTarget(
      [{ id: 'a', containerId: 'c1', position: { x: 0, y: 0 }, connections: [] }],
      [{ id: 'b', containerId: 'c2', position: { x: 0, y: 0 }, connections: [] }]
    );
    expect(offset).toBeGreaterThan(0);
  });
});

describe('buildTraceFromContainerEdge focus', () => {
  it('filters highlights to the chosen container', () => {
    const model = baseModel();
    const conn = {
      ...model.containers[0].connections![0],
      relatedComponentIds: ['ctrl', 'consumer'],
    };
    const focused = buildTraceFromContainerEdge(model, 'c1', 'c2', conn, 'c1');
    expect(focused?.focusContainerId).toBe('c1');
    expect(focused?.highlightedIds.every((id) =>
      model.components.find((c) => c.id === id)?.containerId === 'c1'
    )).toBe(true);
    expect(focused?.highlightedIds).toEqual(
      expect.arrayContaining(['ctrl', 'svc', 'producer'])
    );
    expect(focused?.highlightedIds).not.toContain('consumer');
  });
});
