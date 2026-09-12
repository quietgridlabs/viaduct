/**
 * What a magic flow generates has to survive the editor that opens it.
 *
 * The two used to disagree: the generator declared every endpoint and topic as
 * a participant, which the diagram's own catalog check rejected as elements not
 * in the C4 model, and it wrote messages with an empty label, which the lexer
 * reported as an unexpected token.
 */
import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import { parsePlantUmlSequence } from '@plugins/sequence-editor/plantuml/parser';
import { generatePlantUmlFromFlow } from '../flowToSequence';

const model = {
  viewLevel: 'container',
  systems: [{ id: 'sys', name: 'Banking' }],
  containers: [
    { id: 'payments', name: 'Payments API', systemId: 'sys', technology: 'java' },
    { id: 'ledger', name: 'Ledger', systemId: 'sys', technology: 'java' },
    { id: 'broker', name: 'Event Bus', systemId: 'sys', technology: 'kafka' },
  ],
  components: [
    {
      id: 'ep1',
      name: 'Create payment',
      containerId: 'payments',
      kind: 'endpoint',
      method: 'POST',
      endpoint: '/api/payments',
    },
    { id: 'ch1', name: 'payment.requested', containerId: 'broker', kind: 'channel' },
    { id: 'ch2', name: 'payment.settled', containerId: 'broker', kind: 'channel' },
  ],
  codeElements: [],
} as unknown as FlatC4Model;

const flow = {
  id: 'flow1',
  name: 'Checkout',
  steps: [
    {
      id: 'st1',
      name: 'Charge the card',
      from: { id: 'payments', type: 'container' },
      to: { id: 'ledger', type: 'container' },
      endpointIds: ['ep1'],
    },
    {
      id: 'st2',
      name: '',
      from: { id: 'ledger', type: 'container' },
      to: { id: 'broker', type: 'container' },
      channelIds: ['ch1', 'ch2'],
    },
    {
      /* No name, no endpoint, no topic — the case that produced `A -> B: `. */
      id: 'st3',
      name: '',
      from: { id: 'broker', type: 'container' },
      to: { id: 'payments', type: 'container' },
    },
  ],
} as never;

describe('a generated magic flow diagram opens without errors', () => {
  const source = generatePlantUmlFromFlow(model, flow);

  it('declares only the elements the C4 model actually has', () => {
    const declared = [...source.matchAll(/^\w+ "[^"]+" as (\w+)$/gm)].map((m) => m[1]);
    expect(declared).toEqual(['Payments_API', 'Ledger', 'Event_Bus']);
    expect(source).not.toContain('POST_api_payments');
    expect(source).not.toContain('payment_requested');
  });

  it('never writes a message with nothing after the colon', () => {
    for (const line of source.split('\n')) {
      expect(line.trimEnd()).not.toMatch(/:$/);
    }
  });

  it('still says which endpoint and which topics the hop used', () => {
    expect(source).toContain('POST /api/payments');
    expect(source).toContain('payment.requested, payment.settled');
  });

  it('parses clean against the catalog the viewer checks it with', () => {
    const result = parsePlantUmlSequence(source, {
      strictParticipants: true,
      allowedParticipantIds: ['Payments_API', 'Ledger', 'Event_Bus'],
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

describe('a fork reaches the diagram as an alt the viewer can draw', () => {
  const forked = {
    id: 'flow2',
    name: 'Key check',
    steps: [
      {
        id: 'st0',
        name: 'Parse the key',
        from: { id: 'payments', type: 'container' },
        to: { id: 'ledger', type: 'container' },
      },
      {
        id: 'wb1',
        name: 'Key is WB',
        from: { id: 'ledger', type: 'container' },
        to: { id: 'broker', type: 'container' },
        parallelGroupId: 'g',
        branchKind: 'alternative',
        branchArmId: 'wb',
      },
      {
        id: 'wb2',
        name: 'WB confirms the scope',
        from: { id: 'broker', type: 'container' },
        to: { id: 'ledger', type: 'container' },
        parallelGroupId: 'g',
        branchKind: 'alternative',
        branchArmId: 'wb',
      },
      {
        id: 'oz1',
        name: 'Key is Ozon',
        from: { id: 'ledger', type: 'container' },
        to: { id: 'payments', type: 'container' },
        parallelGroupId: 'g',
        branchKind: 'alternative',
        branchArmId: 'oz',
      },
    ],
  } as never;

  const source = generatePlantUmlFromFlow(model, forked);
  const result = parsePlantUmlSequence(source, {
    strictParticipants: true,
    allowedParticipantIds: ['Payments_API', 'Ledger', 'Event_Bus'],
  });

  it('parses without complaint', () => {
    expect(result.diagnostics).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('arrives as one alt with a branch per track', () => {
    const fragments = result.model!.items.filter((it) => it.type === 'fragment');
    expect(fragments).toHaveLength(1);
    const alt = fragments[0] as Extract<(typeof fragments)[number], { type: 'fragment' }>;
    expect(alt.kind).toBe('alt');
    expect(alt.branches).toHaveLength(2);
  });

  it('keeps every step of a track inside that branch', () => {
    const alt = result.model!.items.find((it) => it.type === 'fragment') as Extract<
      NonNullable<typeof result.model>['items'][number],
      { type: 'fragment' }
    >;
    const messagesIn = (i: number) =>
      alt.branches[i]!.items.filter((it) => it.type === 'message').length;
    expect(messagesIn(0)).toBe(2);
    expect(messagesIn(1)).toBe(1);
  });
});
