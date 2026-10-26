import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';

/* The real module pulls the whole technology catalog in from JSON, which this
   jest config cannot import. Only the one predicate is used here. */
jest.mock('@data/technologies', () => ({
  isPersonTechnology: (id?: string) => id === 'users',
}));

import { buildServiceGraph } from '../buildServiceGraph';

function modelOf(partial: Partial<FlatC4Model>): FlatC4Model {
  return {
    systems: [],
    containers: [],
    components: [],
    codeElements: [],
    viewLevel: 'system',
    ...partial,
  } as FlatC4Model;
}

const system = (id: string, extra: Record<string, unknown> = {}) =>
  ({
    id,
    name: id,
    type: 'system',
    position: { x: 0, y: 0 },
    connections: [],
    ...extra,
  }) as never;

const container = (id: string, systemId: string, extra: Record<string, unknown> = {}) =>
  ({
    id,
    name: id,
    type: 'container',
    systemId,
    position: { x: 0, y: 0 },
    connections: [],
    ...extra,
  }) as never;

const orbsOf = (graph: { nodes: { type?: string }[] }) =>
  graph.nodes.filter((n) => n.type === 'serviceOrb');
const groupOf = (graph: { nodes: { id: string; data?: unknown }[] }, id: string) =>
  (graph.nodes.find((n) => n.id === id)?.data as { group?: string } | undefined)?.group;

describe('buildServiceGraph', () => {
  it('draws one orb per system and container', async () => {
    const graph = await buildServiceGraph(
      modelOf({
        systems: [system('shop')],
        containers: [container('api', 'shop'), container('db', 'shop')],
      })
    );

    expect(graph.count).toBe(3);
    expect(orbsOf(graph).map((node) => node.id).sort()).toEqual(['api', 'db', 'shop']);
  });

  it('leaves components and code out — they are the inside of a service', async () => {
    const graph = await buildServiceGraph(
      modelOf({
        systems: [system('shop')],
        components: [{ id: 'handler', name: 'handler', connections: [] } as never],
        codeElements: [{ id: 'fn', name: 'fn', connections: [] } as never],
      })
    );

    expect(orbsOf(graph).map((node) => node.id)).toEqual(['shop']);
  });

  it('leaves people out — actors are not services', async () => {
    const graph = await buildServiceGraph(
      modelOf({
        systems: [
          system('shop'),
          system('customer', { technology: 'users' }),
          system('clerk', { kind: 'person' }),
        ],
        containers: [
          container('api', 'shop'),
          container('operator', 'shop', { kind: 'person' }),
        ],
      })
    );

    expect(orbsOf(graph).map((node) => node.id).sort()).toEqual(['api', 'shop']);
    expect(graph.count).toBe(2);
  });

  it('drops edges that only reached a person', async () => {
    const graph = await buildServiceGraph(
      modelOf({
        systems: [
          system('shop', { connections: [{ targetId: 'customer', label: 'uses' }] }),
          system('customer', { technology: 'users' }),
        ],
      })
    );

    expect(orbsOf(graph).map((node) => node.id)).toEqual(['shop']);
    expect(graph.edges).toHaveLength(0);
  });

  it('keeps a connection whose far end is also an orb', async () => {
    const graph = await buildServiceGraph(
      modelOf({
        systems: [system('shop', { connections: [{ targetId: 'billing', label: 'orders' }] })],
        containers: [],
      })
    );
    const withBilling = await buildServiceGraph(
      modelOf({
        systems: [
          system('shop', { connections: [{ targetId: 'billing', label: 'orders' }] }),
          system('billing'),
        ],
      })
    );

    /* Nothing called billing exists in the first model, so the line would run
       from somewhere to nowhere. */
    expect(graph.edges).toHaveLength(0);
    expect(withBilling.edges).toHaveLength(1);
    expect(withBilling.edges[0]).toMatchObject({
      source: 'shop',
      target: 'billing',
    });
    expect(withBilling.edges[0].label).toBeUndefined();
  });

  it('drops a self-connection and repeats of the same pair', async () => {
    const graph = await buildServiceGraph(
      modelOf({
        systems: [
          system('shop', {
            connections: [
              { targetId: 'shop' },
              { targetId: 'billing' },
              { targetId: 'billing' },
            ],
          }),
          system('billing'),
        ],
      })
    );

    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].source).toBe('shop');
  });

  it('names a container owning system, so two alike containers stay apart', async () => {
    const graph = await buildServiceGraph(
      modelOf({
        systems: [system('shop'), system('crm')],
        containers: [container('api', 'shop'), container('api-2', 'crm')],
      })
    );

    const byId = new Map(graph.nodes.map((node) => [node.id, node.data]));
    expect(byId.get('api')).toMatchObject({ level: 'container', parentName: 'shop' });
    expect(byId.get('api-2')).toMatchObject({ level: 'container', parentName: 'crm' });
    /* A system is the top of its own tree — there is nothing to qualify it with. */
    expect(byId.get('shop')).toMatchObject({ level: 'system', parentName: undefined });
  });

  it('gives every orb a position of its own', async () => {
    const graph = await buildServiceGraph(
      modelOf({
        systems: [
          system('a', { connections: [{ targetId: 'b' }] }),
          system('b'),
          system('c'),
        ],
      })
    );

    const seen = new Set(orbsOf(graph).map((node) => `${node.position.x}:${node.position.y}`));
    expect(seen.size).toBe(3);
  });

  it('hands out a pool that holds only the links it drew', async () => {
    /* "Highlight connections" resolves one hop over this pool, so a link to
       something the graph left out must not be in it — the highlight would
       claim a neighbour that is nowhere on screen. */
    const graph = await buildServiceGraph(
      modelOf({
        systems: [
          system('shop', { connections: [{ targetId: 'billing' }, { targetId: 'handler' }] }),
          system('billing'),
        ],
        components: [{ id: 'handler', name: 'handler', connections: [] } as never],
      })
    );

    const shop = graph.services.find((s) => s.id === 'shop');
    expect(shop?.connections).toEqual([{ targetId: 'billing', bidirectional: undefined }]);
    expect(graph.services.map((s) => s.id).sort()).toEqual(['billing', 'shop']);
  });

  it('folds a clone into the element it stands for', async () => {
    /* A clone is a second card for one element, put where that element is
       also needed. Drawn as its own orb it splits one service into two, each
       holding a share of its connections. */
    const graph = await buildServiceGraph(
      modelOf({
        systems: [
          system('shop'),
          system('shop-copy', { original: { id: 'shop', type: 'system' } }),
          system('crm', { connections: [{ targetId: 'shop-copy' }] }),
          system('billing'),
        ],
      })
    );

    expect(orbsOf(graph).map((n) => n.id).sort()).toEqual(['billing', 'crm', 'shop']);
    /* And the line that pointed at the copy now points at the real thing. */
    expect(graph.edges.map((e) => `${e.source}->${e.target}`)).toEqual(['crm->shop']);
  });

  it('gives the original the connections its clones were holding', async () => {
    const graph = await buildServiceGraph(
      modelOf({
        systems: [
          system('shop', { connections: [{ targetId: 'crm' }] }),
          system('shop-a', {
            original: { id: 'shop', type: 'system' },
            connections: [{ targetId: 'billing' }],
          }),
          system('shop-b', {
            original: { id: 'shop', type: 'system' },
            /* Already the original's own — one line, not two. */
            connections: [{ targetId: 'crm' }],
          }),
          system('crm'),
          system('billing'),
        ],
      })
    );

    expect(graph.edges.map((e) => `${e.source}->${e.target}`).sort()).toEqual([
      'shop->billing',
      'shop->crm',
    ]);
  });

  it('drops a line from a clone to its own original', async () => {
    const graph = await buildServiceGraph(
      modelOf({
        systems: [
          system('shop'),
          system('shop-copy', {
            original: { id: 'shop', type: 'system' },
            connections: [{ targetId: 'shop' }],
          }),
        ],
      })
    );
    /* Both ends are the same service; there is nothing to draw. */
    expect(graph.edges).toHaveLength(0);
  });

  it('keeps a clone whose original is somewhere this graph cannot see', async () => {
    const graph = await buildServiceGraph(
      modelOf({
        systems: [
          system('shop'),
          /* An element of another project: nothing here to fold it into, and
             dropping it would lose it from the picture altogether. */
          system('remote', { original: { id: 'elsewhere', type: 'system', projectId: 'p2' } }),
          /* A clone of a component — not a level this graph draws. */
          system('of-a-component', { original: { id: 'handler', type: 'component' } }),
        ],
        components: [{ id: 'handler', name: 'handler', connections: [] } as never],
      })
    );

    expect(orbsOf(graph).map((n) => n.id).sort()).toEqual([
      'of-a-component',
      'remote',
      'shop',
    ]);
  });

  it('follows a clone of a clone, and survives one that loops', async () => {
    const chained = await buildServiceGraph(
      modelOf({
        systems: [
          system('shop'),
          system('copy1', { original: { id: 'shop', type: 'system' } }),
          system('copy2', { original: { id: 'copy1', type: 'system' } }),
          system('crm', { connections: [{ targetId: 'copy2' }] }),
        ],
      })
    );
    expect(orbsOf(chained).map((n) => n.id).sort()).toEqual(['crm', 'shop']);
    expect(chained.edges.map((e) => `${e.source}->${e.target}`)).toEqual(['crm->shop']);

    /* A model that should not exist, and must not hang the editor. */
    const looped = await buildServiceGraph(
      modelOf({
        systems: [
          system('a', { original: { id: 'b', type: 'system' } }),
          system('b', { original: { id: 'a', type: 'system' } }),
        ],
      })
    );
    expect(orbsOf(looped).length).toBeGreaterThan(0);
  });

  it('puts a system and its containers in one group, named after the system', async () => {
    /* The canvas draws the frame: `buildGroupFrameNodes` buckets nodes by
       `data.group` and refits a frame to each bucket on every render. Saying
       it here rather than emitting a frame is what makes the frame behave
       like every other group — it follows what it holds. */
    const graph = await buildServiceGraph(
      modelOf({
        systems: [system('shop')],
        containers: [container('api', 'shop'), container('db', 'shop')],
      })
    );

    expect(groupOf(graph, 'shop')).toBe('shop');
    expect(groupOf(graph, 'api')).toBe('shop');
    expect(groupOf(graph, 'db')).toBe('shop');
  });

  it('leaves a system without containers ungrouped', async () => {
    const graph = await buildServiceGraph(
      modelOf({ systems: [system('shop'), system('crm', { connections: [{ targetId: 'shop' }] })] })
    );
    /* A frame round one circle says nothing the circle does not. */
    expect(groupOf(graph, 'shop')).toBeUndefined();
    expect(groupOf(graph, 'crm')).toBeUndefined();
  });

  it('keeps each system\'s containers in a group of their own', async () => {
    const graph = await buildServiceGraph(
      modelOf({
        systems: [system('shop', { connections: [{ targetId: 'crm' }] }), system('crm')],
        containers: [
          container('shop-api', 'shop'),
          container('crm-api', 'crm'),
          container('crm-db', 'crm'),
        ],
      })
    );

    expect(groupOf(graph, 'shop-api')).toBe('shop');
    expect(groupOf(graph, 'crm-api')).toBe('crm');
    expect(groupOf(graph, 'crm-db')).toBe('crm');
  });

  it('answers an empty model with an empty graph', async () => {
    const graph = await buildServiceGraph(modelOf({}));
    expect(graph).toEqual({ nodes: [], edges: [], count: 0, services: [] });
  });
});
