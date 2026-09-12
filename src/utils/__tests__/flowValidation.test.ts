import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import type { StoredDataFlow } from '@/types/c4Extensions';
import {
  buildModelIndex,
  flowDependencies,
  summarizeFlowStatuses,
  validateFlow,
  type FlowValidationStamp,
} from '../flowValidation';

const model = (over: Partial<Record<string, unknown>> = {}): FlatC4Model =>
  ({
    viewLevel: 'system',
    systems: [{ id: 's1', name: 'Магазин', connections: [] }],
    containers: [
      {
        id: 'c1',
        systemId: 's1',
        name: 'Order Service',
        technology: 'Node.js',
        connections: [{ targetId: 'c2', label: 'читает каталог', technology: 'HTTP' }],
      },
      { id: 'c2', systemId: 's1', name: 'Catalog Service', technology: 'Go', connections: [] },
    ],
    components: [
      {
        id: 'e1',
        systemId: 's1',
        containerId: 'c2',
        name: 'GET /items',
        kind: 'endpoint',
        method: 'GET',
        endpoint: '/items',
        response: '200 OK',
        connections: [],
      },
    ],
    codeElements: [],
    ...over,
  }) as unknown as FlatC4Model;

const flow = (): StoredDataFlow =>
  ({
    id: 'f1',
    name: 'Оформление заказа',
    steps: [
      {
        id: 'st1',
        name: 'Читает каталог',
        from: { id: 'c1', type: 'container' },
        to: { id: 'c2', type: 'container' },
        endpointIds: ['e1'],
        connections: [{ sourceId: 'c1', targetId: 'c2' }],
      },
    ],
    modelVersion: 1,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  }) as unknown as StoredDataFlow;

const stampFor = (m: FlatC4Model, f: StoredDataFlow): FlowValidationStamp => ({
  checkedAt: '2026-09-01T00:00:00.000Z',
  dependencies: flowDependencies(f, buildModelIndex(m)),
});

describe('validateFlow', () => {
  it('a flow nobody has checked is not a broken flow', () => {
    const result = validateFlow(flow(), buildModelIndex(model()));
    expect(result.status).toBe('unchecked');
    expect(result.issues).toEqual([]);
  });

  it('a checked flow on an unchanged model is simply fine', () => {
    const m = model();
    const f = flow();
    const result = validateFlow(f, buildModelIndex(m), stampFor(m, f));
    expect(result.status).toBe('ok');
    expect(result.issues).toEqual([]);
  });

  it('a deleted participant breaks the flow, with or without a stamp', () => {
    const m = model();
    const f = flow();
    const stamp = stampFor(m, f);
    const without = model({
      containers: (m as unknown as { containers: unknown[] }).containers.filter(
        (c) => (c as { id: string }).id !== 'c2'
      ),
      components: [],
    });

    const unstamped = validateFlow(f, buildModelIndex(without));
    expect(unstamped.status).toBe('broken');
    expect(unstamped.issues.map((i) => i.kind)).toContain('missing');

    const stamped = validateFlow(f, buildModelIndex(without), stamp);
    expect(stamped.status).toBe('broken');
    /* The stamp adds the name it used to have, so the message can say what. */
    expect(stamped.issues.find((i) => i.key === 'el:c2')?.name).toBe('Catalog Service');
  });

  it('a removed connection breaks the step that used it', () => {
    const m = model({
      containers: [
        { id: 'c1', systemId: 's1', name: 'Order Service', technology: 'Node.js', connections: [] },
        { id: 'c2', systemId: 's1', name: 'Catalog Service', technology: 'Go', connections: [] },
      ],
    });
    const result = validateFlow(flow(), buildModelIndex(m));
    const issue = result.issues.find((i) => i.key === 'cn:c1>c2');
    expect(issue?.severity).toBe('broken');
    expect(issue?.stepIds).toEqual(['st1']);
  });

  it('a connection that is gone is named by its ends, not by its uuids', () => {
    /* The usual case for a flow older than this feature: no stamp to remember
       what the thing was called, but both ends are still on the canvas. */
    const m = model({
      containers: [
        { id: 'c1', systemId: 's1', name: 'Order Service', technology: 'Node.js', connections: [] },
        { id: 'c2', systemId: 's1', name: 'Catalog Service', technology: 'Go', connections: [] },
      ],
    });
    const issue = validateFlow(flow(), buildModelIndex(m)).issues.find((i) => i.key === 'cn:c1>c2');
    expect(issue?.name).toBe('Order Service → Catalog Service');
  });

  it('a hop between two elements with no arrow between them is broken', () => {
    /* The case the stored references miss entirely: the step records no
       connection id — most do not — so only the hop itself gives it away. */
    const f = flow();
    f.steps[0].connections = [];
    const m = model({
      containers: [
        { id: 'c1', systemId: 's1', name: 'Order Service', technology: 'Node.js', connections: [] },
        { id: 'c2', systemId: 's1', name: 'Catalog Service', technology: 'Go', connections: [] },
      ],
    });

    const result = validateFlow(f, buildModelIndex(m));
    const issue = result.issues.find((i) => i.key === 'lk:c1>c2');
    expect(issue?.kind).toBe('missing_link');
    expect(issue?.name).toBe('Order Service → Catalog Service');
    expect(result.status).toBe('broken');
  });

  it('a response travelling back along the same arrow is not a missing link', () => {
    const f = flow();
    f.steps[0].connections = [];
    f.steps[0].from = { id: 'c2', type: 'container' };
    f.steps[0].to = { id: 'c1', type: 'container' };
    /* c1 → c2 exists; the hop goes the other way, which is what a reply does. */
    expect(validateFlow(f, buildModelIndex(model())).issues).toEqual([]);
  });

  it('a hop across levels is not expected to have an arrow', () => {
    const f = flow();
    f.steps[0].connections = [];
    f.steps[0].from = { id: 's1', type: 'system' };
    f.steps[0].to = { id: 'c2', type: 'container' };
    expect(validateFlow(f, buildModelIndex(model())).issues).toEqual([]);
  });

  it('a hop to itself is not a connection', () => {
    const f = flow();
    f.steps[0].connections = [];
    f.steps[0].to = { id: 'c1', type: 'container' };
    expect(validateFlow(f, buildModelIndex(model())).issues).toEqual([]);
  });

  it('a half-drawn step is broken; an untouched one is not', () => {
    const half = flow();
    half.steps[0].connections = [];
    half.steps[0].to = { id: '', type: 'container' };
    const halfResult = validateFlow(half, buildModelIndex(model()));
    expect(halfResult.issues.find((i) => i.kind === 'incomplete')?.severity).toBe('broken');

    const fresh = flow();
    fresh.steps[0].connections = [];
    fresh.steps[0].from = { id: '', type: 'container' };
    fresh.steps[0].to = { id: '', type: 'container' };
    expect(validateFlow(fresh, buildModelIndex(model())).issues).toEqual([]);
  });

  it('a changed contract asks for a look, and says what moved', () => {
    const m = model();
    const f = flow();
    const stamp = stampFor(m, f);

    const changed = model({
      components: [
        {
          id: 'e1',
          systemId: 's1',
          containerId: 'c2',
          name: 'GET /items',
          kind: 'endpoint',
          method: 'POST',
          endpoint: '/items',
          response: '200 OK',
          connections: [],
        },
      ],
    });

    const result = validateFlow(f, buildModelIndex(changed), stamp);
    expect(result.status).toBe('review');
    const issue = result.issues.find((i) => i.key === 'ep:e1');
    expect(issue?.kind).toBe('changed');
    expect(issue?.before).toContain('GET');
    expect(issue?.after).toContain('POST');
  });

  it('a redrawn connection counts as a change, not as nothing', () => {
    const m = model();
    const f = flow();
    const stamp = stampFor(m, f);
    const overKafka = model({
      containers: [
        {
          id: 'c1',
          systemId: 's1',
          name: 'Order Service',
          technology: 'Node.js',
          connections: [{ targetId: 'c2', label: 'публикует заказ', technology: 'Kafka' }],
        },
        { id: 'c2', systemId: 's1', name: 'Catalog Service', technology: 'Go', connections: [] },
      ],
    });

    const result = validateFlow(f, buildModelIndex(overKafka), stamp);
    expect(result.issues.find((i) => i.key === 'cn:c1>c2')?.kind).toBe('changed');
    expect(result.status).toBe('review');
  });

  it('a rename is reported but does not colour the flow', () => {
    const m = model();
    const f = flow();
    const stamp = stampFor(m, f);
    const renamed = model({
      containers: [
        {
          id: 'c1',
          systemId: 's1',
          name: 'Orders',
          technology: 'Node.js',
          connections: [{ targetId: 'c2', label: 'читает каталог', technology: 'HTTP' }],
        },
        { id: 'c2', systemId: 's1', name: 'Catalog Service', technology: 'Go', connections: [] },
      ],
    });

    const result = validateFlow(f, buildModelIndex(renamed), stamp);
    expect(result.status).toBe('ok');
    const issue = result.issues.find((i) => i.key === 'el:c1');
    expect(issue?.kind).toBe('renamed');
    expect(issue?.before).toBe('Order Service');
    expect(issue?.after).toBe('Orders');
  });

  it('an id that now points at something else is as broken as a missing one', () => {
    const m = model({
      components: [
        { id: 'e1', systemId: 's1', containerId: 'c2', name: 'Not an endpoint', connections: [] },
      ],
    });
    const result = validateFlow(flow(), buildModelIndex(m));
    expect(result.issues.find((i) => i.key === 'ep:e1')?.severity).toBe('broken');
  });

  it('a participant in another project is unverifiable, not missing', () => {
    const f = flow();
    f.steps[0].to = { id: 'x1', type: 'container', projectId: 'p2', name: 'Billing (другой проект)' };
    const result = validateFlow(f, buildModelIndex(model()));
    const issue = result.issues.find((i) => i.key === 'ex:x1');
    expect(issue?.kind).toBe('unverifiable');
    expect(issue?.severity).toBe('cosmetic');
    expect(result.status).toBe('unchecked');
  });

  it('the stamp it would write describes what the flow leans on now', () => {
    const deps = flowDependencies(flow(), buildModelIndex(model()));
    expect(deps.map((d) => d.key).sort()).toEqual(['cn:c1>c2', 'el:c1', 'el:c2', 'ep:e1']);
    expect(deps.find((d) => d.key === 'ep:e1')?.fingerprint).toContain('GET|/items');
  });

  it('counts what a badge needs', () => {
    expect(summarizeFlowStatuses(['ok', 'broken', 'review', 'review', 'unchecked'])).toEqual({
      broken: 1,
      review: 2,
      unchecked: 1,
    });
  });
});
