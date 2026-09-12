import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import { isApiEndpoint } from '@/types/c4Extensions';
import { channelCountForCard, containerChannels } from '../channelCatalog';

const model = (): FlatC4Model =>
  ({
    viewLevel: 'container',
    systems: [{ id: 'sys', name: 'S', type: 'system', position: { x: 0, y: 0 }, connections: [] }],
    containers: [
      {
        id: 'bus',
        name: 'Kafka',
        type: 'container',
        systemId: 'sys',
        technology: 'kafka',
        position: { x: 0, y: 0 },
        connections: [],
      },
      {
        id: 'clone',
        name: 'Kafka clone',
        type: 'container',
        systemId: 'sys',
        original: { id: 'bus', type: 'container' },
        position: { x: 1, y: 0 },
        connections: [],
      },
    ],
    components: [
      {
        id: 't1',
        name: 'payment.settled',
        type: 'component',
        systemId: 'sys',
        containerId: 'bus',
        kind: 'channel',
        protocol: 'kafka',
        position: { x: 0, y: 0 },
        connections: [],
      },
      {
        id: 'ep',
        name: 'GET /x',
        type: 'component',
        systemId: 'sys',
        containerId: 'bus',
        kind: 'endpoint',
        endpoint: '/x',
        position: { x: 0, y: 80 },
        connections: [],
      },
    ],
    codeElements: [],
  }) as FlatC4Model;

describe('channelCatalog', () => {
  it('lists only channel children and does not treat them as endpoints', () => {
    const m = model();
    expect(containerChannels(m, 'bus').map((c) => c.id)).toEqual(['t1']);
    expect(isApiEndpoint(m.components[0])).toBe(false);
    expect(isApiEndpoint(m.components[1])).toBe(true);
  });

  it('counts topics on the original for a clone card', () => {
    const m = model();
    expect(channelCountForCard(m, 'bus')).toEqual({ containerId: 'bus', count: 1 });
    expect(
      channelCountForCard(m, 'clone', { originalType: 'container', originalId: 'bus' })
    ).toEqual({ containerId: 'bus', count: 1 });
  });
});
