import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import {
  collectChannelIndex,
  collectChannelOptionsForOwner,
  formatChannelOptionLabel,
} from '../channelRefs';
import { collectEndpointIndex } from '../endpointRefs';
import {
  formatChannelRefToken,
  parseChannelRefFenceBody,
  splitMarkdownToPreviewBlocks,
} from '../markdown';

const model = {
  systems: [{ id: 'sys1', name: 'Seller' }],
  containers: [
    { id: 'broker', name: 'NIB Kafka', systemId: 'sys1' },
    {
      id: 'svc',
      name: 'subscription-api',
      systemId: 'sys1',
      connections: [{ targetId: 'broker' }],
    },
    { id: 'stranger', name: 'unrelated-api', systemId: 'sys1' },
  ],
  components: [
    {
      id: 'topic1',
      name: 'ALFA_SECURITY_SUBSCRIPTIONS_EVENTS',
      containerId: 'broker',
      kind: 'channel',
      protocol: 'kafka',
      schemaFormat: 'json-schema',
      valueSchema: '@format json-schema\n@name SubscriptionCdcEvent\n\n{"type":"object"}',
    },
    {
      id: 'queue1',
      name: 'billing.dlq',
      containerId: 'broker',
      kind: 'channel',
      protocol: 'sqs',
    },
    {
      id: 'ep1',
      name: 'Create subscriptions',
      containerId: 'svc',
      kind: 'endpoint',
      method: 'POST',
      endpoint: '/api/subscriptions',
    },
  ],
  codeElements: [],
} as unknown as FlatC4Model;

describe('channel doc refs', () => {
  it('indexes channels and leaves them out of the endpoint index', () => {
    const channels = collectChannelIndex(model);
    expect([...channels.keys()].sort()).toEqual(['queue1', 'topic1']);
    expect(channels.get('topic1')?.containerName).toBe('NIB Kafka');

    // The two indexes must not overlap — a topic rendered as an endpoint would
    // show a method and a response it does not have.
    expect([...collectEndpointIndex(model).keys()]).toEqual(['ep1']);
  });

  it('reads the protocol into the surface noun the broker actually uses', () => {
    const channels = collectChannelIndex(model);
    expect(channels.get('topic1')?.surface).toBe('Topic');
    expect(channels.get('queue1')?.surface).toBe('Queue');
  });

  it('offers the broker channels to the service wired to it', () => {
    const onBroker = collectChannelOptionsForOwner(model, 'container', 'broker');
    expect(onBroker.map((o) => o.id)).toEqual(['topic1', 'queue1']);
    expect(formatChannelOptionLabel(onBroker[0]!)).toBe(
      'kafka · ALFA_SECURITY_SUBSCRIPTIONS_EVENTS — NIB Kafka'
    );

    // The topic lives on the broker; the doc describing it sits on the service.
    // Scoping to the owner's own container would leave this picker empty.
    expect(collectChannelOptionsForOwner(model, 'container', 'svc').map((o) => o.id)).toEqual([
      'topic1',
      'queue1',
    ]);
  });

  it('sees every channel in the system from a system-level doc', () => {
    const onSystem = collectChannelOptionsForOwner(model, 'system', 'sys1');
    expect(onSystem.map((o) => o.id).sort()).toEqual(['queue1', 'topic1']);
  });

  it('offers nothing to a container with no edge to the broker', () => {
    expect(collectChannelOptionsForOwner(model, 'container', 'stranger')).toEqual([]);
  });

  it('follows the edge in either direction', () => {
    const brokerPushes = {
      ...model,
      containers: model.containers.map((c) =>
        c.id === 'svc'
          ? { ...c, connections: [] }
          : c.id === 'broker'
            ? { ...c, connections: [{ targetId: 'svc' }] }
            : c
      ),
    } as unknown as FlatC4Model;

    expect(
      collectChannelOptionsForOwner(brokerPushes, 'container', 'svc').map((o) => o.id)
    ).toEqual(['topic1', 'queue1']);
  });
});

describe('c4-channel fence', () => {
  it('round-trips an id through the token', () => {
    const token = formatChannelRefToken('topic1');
    expect(token).toContain('```c4-channel');
    expect(parseChannelRefFenceBody('id: topic1')).toBe('topic1');
  });

  it('parses into a channel block, distinct from an endpoint block', () => {
    const md = [
      '# Doc',
      '',
      '```c4-channel',
      'id: topic1',
      '```',
      '',
      '```c4-endpoint',
      'id: ep1',
      '```',
      '',
    ].join('\n');

    const kinds = splitMarkdownToPreviewBlocks(md)
      .filter((b) => b.type === 'channel' || b.type === 'endpoint')
      .map((b) => `${b.type}:${'id' in b ? b.id : ''}`);
    expect(kinds).toEqual(['channel:topic1', 'endpoint:ep1']);
  });

  it('keeps an unterminated fence at the end of the document', () => {
    const blocks = splitMarkdownToPreviewBlocks('```c4-channel\nid: topic1\n');
    expect(blocks.some((b) => b.type === 'channel' && b.id === 'topic1')).toBe(true);
  });

  it('falls back to a code block when the body carries no id', () => {
    const blocks = splitMarkdownToPreviewBlocks('```c4-channel\nnope\n```\n');
    expect(blocks.some((b) => b.type === 'channel')).toBe(false);
    expect(blocks.some((b) => b.type === 'html' && b.html.includes('c4-channel'))).toBe(true);
  });
});

describe('endpoint refs resolve against the service contract', () => {
  const withContract = {
    systems: [{ id: 'sys1', name: 'Seller' }],
    containers: [
      {
        id: 'svc',
        name: 'accounts-api',
        systemId: 'sys1',
        openapi: JSON.stringify({
          openapi: '3.1.0',
          info: { title: 'accounts-api', version: '1.0.0' },
          paths: {},
          components: {
            schemas: {
              Account: { type: 'object', properties: { id: { type: 'string' } } },
            },
          },
        }),
      },
      { id: 'other', name: 'no-contract', systemId: 'sys1' },
    ],
    components: [
      {
        id: 'ep1',
        name: 'List accounts',
        containerId: 'svc',
        kind: 'endpoint',
        method: 'GET',
        endpoint: '/api/accounts',
        response: '@response 200 OK\n@schema\n{\n  "$ref": "#/components/schemas/Account"\n}',
      },
      {
        id: 'ep2',
        name: 'Ping',
        containerId: 'other',
        kind: 'endpoint',
        method: 'GET',
        endpoint: '/ping',
        response: '@response 200 OK\n@schema\n{\n  "$ref": "#/components/schemas/Account"\n}',
      },
    ],
    codeElements: [],
  } as unknown as FlatC4Model;

  it('follows a $ref into the container that stores the contract', () => {
    const ref = collectEndpointIndex(withContract).get('ep1');
    expect(ref?.response).toContain('"type": "object"');
    expect(ref?.response).not.toContain('$ref');
  });

  it('leaves the ref written when the container stores no contract', () => {
    // Nothing to resolve against beats inventing a shape.
    const ref = collectEndpointIndex(withContract).get('ep2');
    expect(ref?.response).toContain('$ref');
  });
});
