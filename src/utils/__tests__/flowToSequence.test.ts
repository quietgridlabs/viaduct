import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import type { StoredDataFlow } from '@/types/c4Extensions';
import {
  flowMagicSequenceIsStale,
  flowSequenceSourceKey,
  generatePlantUmlFromFlow,
  planMagicSequence,
  resolveFlowSequenceOwner,
  resolveSequenceOwner,
} from '../flowToSequence';

function model(): FlatC4Model {
  return {
    viewLevel: 'container',
    activeSystemId: 'sys1',
    systems: [{ id: 'sys1', name: 'Bank', type: 'system', position: { x: 0, y: 0 }, connections: [] }],
    containers: [
      {
        id: 'spa',
        systemId: 'sys1',
        name: 'SPA',
        type: 'container',
        technology: 'javascript',
        position: { x: 0, y: 0 },
        connections: [{ targetId: 'api' }],
      },
      {
        id: 'api',
        systemId: 'sys1',
        name: 'API',
        type: 'container',
        technology: 'java',
        position: { x: 0, y: 0 },
        connections: [{ targetId: 'db' }],
      },
      {
        id: 'db',
        systemId: 'sys1',
        name: 'Database',
        type: 'container',
        technology: 'postgresql',
        position: { x: 0, y: 0 },
        connections: [],
      },
    ],
    components: [],
    codeElements: [],
  } as FlatC4Model;
}

describe('flowToSequence', () => {
  it('resolves first container owner from first step', () => {
    const flow: StoredDataFlow = {
      id: 'flow1',
      name: 'Login',
      steps: [
        {
          id: 's1',
          name: 'Submit credentials',
          from: { id: 'spa', type: 'container' },
          to: { id: 'api', type: 'container' },
        },
        {
          id: 's2',
          name: 'Load user',
          from: { id: 'api', type: 'container' },
          to: { id: 'db', type: 'container' },
        },
      ],
      modelVersion: 1,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    expect(resolveSequenceOwner(model(), flow.steps[0]!.from)).toEqual({
      ownerType: 'container',
      ownerId: 'spa',
    });
  });

  it('generates plantuml with participants and messages', () => {
    const flow: StoredDataFlow = {
      id: 'flow1',
      name: 'Login',
      steps: [
        {
          id: 's1',
          name: 'Submit credentials',
          from: { id: 'spa', type: 'container' },
          to: { id: 'api', type: 'container' },
        },
      ],
      modelVersion: 1,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    const source = generatePlantUmlFromFlow(model(), flow);
    expect(source).toContain('@startuml');
    expect(source).toContain('title Login');
    expect(source).toContain('SPA');
    expect(source).toContain('API');
    expect(source).toContain('Submit credentials');
    expect(source).toContain('@enduml');
  });

  it('collapses blank lines in hop descriptions into one PlantUML message line', () => {
    const flow: StoredDataFlow = {
      id: 'flow1',
      name: 'Login',
      steps: [
        {
          id: 's1',
          name: 'Submit',
          description: 'First paragraph.\n\n\nSecond paragraph.\n',
          from: { id: 'spa', type: 'container' },
          to: { id: 'api', type: 'container' },
        },
      ],
      modelVersion: 1,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    const source = generatePlantUmlFromFlow(model(), flow);
    const messageLine = source
      .split('\n')
      .find((line) => line.includes('->') && line.includes('First paragraph'));
    expect(messageLine).toBeTruthy();
    expect(messageLine).toContain('First paragraph. Second paragraph.');
    expect(messageLine).not.toMatch(/\n/);
    expect(source).not.toMatch(/First paragraph\.\n/);
  });

  it('emits alt/else for OR stages and par/and for AND stages', () => {
    const base = {
      modelVersion: 1 as const,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    const orFlow: StoredDataFlow = {
      id: 'flow-or',
      name: 'Choice',
      ...base,
      steps: [
        {
          id: 'a',
          name: 'Pay card',
          from: { id: 'spa', type: 'container' },
          to: { id: 'api', type: 'container' },
          parallelGroupId: 'choice',
          branchKind: 'alternative',
        },
        {
          id: 'b',
          name: 'Pay wallet',
          from: { id: 'spa', type: 'container' },
          to: { id: 'api', type: 'container' },
          parallelGroupId: 'choice',
          branchKind: 'alternative',
        },
      ],
    };
    const andFlow: StoredDataFlow = {
      ...orFlow,
      id: 'flow-and',
      name: 'Fan-out',
      steps: orFlow.steps.map((s) => ({ ...s, branchKind: 'parallel' as const })),
    };
    const orSource = generatePlantUmlFromFlow(model(), orFlow);
    expect(orSource).toContain('alt Pay card');
    expect(orSource).toContain('else Pay wallet');
    expect(orSource).not.toContain('par ');
    const andSource = generatePlantUmlFromFlow(model(), andFlow);
    expect(andSource).toContain('par Pay card');
    /* PlantUML divides parallel branches with `and`; `else` belongs to `alt`
       and produced source the sequence editor refused to parse. */
    expect(andSource).toContain('and Pay wallet');
    expect(andSource).not.toContain('else ');
  });

  it('puts every step of a branch inside that branch of the alt', () => {
    const flow: StoredDataFlow = {
      id: 'flow-arms',
      name: 'Key check',
      modelVersion: 1,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      steps: [
        {
          id: 'wb1',
          name: 'Key is WB',
          from: { id: 'spa', type: 'container' },
          to: { id: 'api', type: 'container' },
          parallelGroupId: 'choice',
          branchKind: 'alternative',
          branchArmId: 'wb',
        },
        {
          id: 'wb2',
          name: 'WB confirms the scope',
          from: { id: 'api', type: 'container' },
          to: { id: 'spa', type: 'container' },
          parallelGroupId: 'choice',
          branchKind: 'alternative',
          branchArmId: 'wb',
        },
        {
          id: 'oz1',
          name: 'Key is Ozon',
          from: { id: 'spa', type: 'container' },
          to: { id: 'api', type: 'container' },
          parallelGroupId: 'choice',
          branchKind: 'alternative',
          branchArmId: 'oz',
        },
      ],
    };
    const source = generatePlantUmlFromFlow(model(), flow);
    const body = source.split('\n');
    const alt = body.findIndex((l) => l.startsWith('alt '));
    const other = body.findIndex((l) => l.startsWith('else '));
    const end = body.findIndex((l) => l === 'end');

    /* The branch opens on its first step — the condition — and its remaining
       steps are messages under it, not branches of their own. */
    expect(body[alt]).toBe('alt Key is WB');
    expect(body[other]).toBe('else Key is Ozon');
    expect(body.filter((l) => l.startsWith('else '))).toHaveLength(1);

    /* Two messages under the first branch, one under the second. */
    expect(body.slice(alt + 1, other).filter((l) => l.trim())).toHaveLength(2);
    expect(body.slice(other + 1, end).filter((l) => l.trim())).toHaveLength(1);
  });

  it('reuses diagram id when magic sequence already exists', () => {
    const flow: StoredDataFlow = {
      id: 'flow1',
      name: 'Login',
      magicSequenceId: 'seq_existing',
      magicSequenceSourceKey: 'old',
      steps: [
        {
          id: 's1',
          name: 'Submit credentials',
          from: { id: 'spa', type: 'container' },
          to: { id: 'api', type: 'container' },
        },
      ],
      modelVersion: 1,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    const hit = planMagicSequence(model(), flow);
    expect(hit.ok).toBe(true);
    if (!hit.ok) return;
    expect(hit.plan.diagramId).toBe('seq_existing');
    expect(hit.plan.created).toBe(false);
    expect(hit.plan.sequenceIds).toContain('seq_existing');
  });

  it('attaches to system clone card on container diagram', () => {
    const m = {
      ...model(),
      systems: [
        ...model().systems,
        {
          id: 'sysB',
          name: 'External B',
          type: 'system',
          external: true,
          position: { x: 0, y: 0 },
          connections: [],
        },
      ],
      containers: [
        ...model().containers,
        {
          id: 'sysB-clone',
          name: 'External B',
          type: 'container',
          systemId: 'sysA',
          original: { id: 'sysB', type: 'system' },
          position: { x: 80, y: 0 },
          connections: [{ targetId: 'api' }],
        },
      ],
    } as FlatC4Model;
    const flow: StoredDataFlow = {
      id: 'flow1',
      name: 'Cross-system',
      steps: [
        {
          id: 's1',
          name: 'Call API',
          from: { id: 'sysB', type: 'system' },
          to: { id: 'api', type: 'container' },
        },
      ],
      modelVersion: 1,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    expect(resolveFlowSequenceOwner(m, flow)).toEqual({
      ownerType: 'container',
      ownerId: 'sysB-clone',
    });
  });

  it('falls back to "to" when first step starts from system without containers', () => {
    const m = {
      ...model(),
      systems: [
        {
          id: 'customer',
          name: 'Customer',
          type: 'system',
          external: true,
          position: { x: 0, y: 0 },
          connections: [{ targetId: 'spa' }],
        },
        ...model().systems,
      ],
    } as FlatC4Model;
    const flow: StoredDataFlow = {
      id: 'flow1',
      name: 'Login',
      steps: [
        {
          id: 's1',
          name: 'Open app',
          from: { id: 'customer', type: 'system' },
          to: { id: 'spa', type: 'container' },
        },
      ],
      modelVersion: 1,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    expect(resolveFlowSequenceOwner(m, flow)).toEqual({
      ownerType: 'container',
      ownerId: 'spa',
    });
  });

  it('detects stale magic sequence after step change', () => {
    const flow: StoredDataFlow = {
      id: 'flow1',
      name: 'Login',
      magicSequenceId: 'seq_existing',
      magicSequenceSourceKey: flowSequenceSourceKey({
        name: 'Login',
        steps: [
          {
            id: 's1',
            name: 'Old step',
            from: { id: 'spa', type: 'container' },
            to: { id: 'api', type: 'container' },
          },
        ],
      }),
      steps: [
        {
          id: 's1',
          name: 'New step',
          from: { id: 'spa', type: 'container' },
          to: { id: 'api', type: 'container' },
        },
      ],
      modelVersion: 1,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    expect(flowMagicSequenceIsStale(flow)).toBe(true);
  });

  it('omits linked Magic flows from the generated sequence', () => {
    const flow: StoredDataFlow = {
      id: 'flow1',
      name: 'Checkout',
      steps: [
        {
          id: 's1',
          name: 'Charge',
          from: { id: 'spa', type: 'container' },
          to: { id: 'api', type: 'container' },
        },
        {
          id: 's-link',
          name: '',
          kind: 'link',
          from: { id: '', type: 'container' },
          to: { id: '', type: 'container' },
          nextFlowRef: {
            id: 'f2',
            name: 'Fulfillment',
            projectId: 'proj-b',
            projectName: 'Warehouse',
          },
        },
        {
          id: 's3',
          name: 'Confirm',
          from: { id: 'api', type: 'container' },
          to: { id: 'db', type: 'container' },
        },
      ],
      modelVersion: 1,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    const source = generatePlantUmlFromFlow(model(), flow);
    expect(source).toContain('Charge');
    expect(source).toContain('Confirm');
    expect(source).not.toContain('Warehouse');
    expect(source).not.toContain('Fulfillment');
  });

  it('includes clone cards that stand in for remote originals', () => {
    const m = {
      ...model(),
      containers: [
        ...model().containers,
        {
          id: 'pay-clone',
          name: 'Payments',
          type: 'container',
          systemId: 'sys1',
          technology: 'java',
          original: { id: 'pay-remote', type: 'container', projectId: 'proj-b' },
          position: { x: 120, y: 0 },
          connections: [{ targetId: 'api' }],
        },
      ],
    } as FlatC4Model;
    const flow: StoredDataFlow = {
      id: 'flow1',
      name: 'Pay',
      steps: [
        {
          id: 's1',
          name: 'Debit',
          from: {
            id: 'pay-remote',
            type: 'container',
            projectId: 'proj-b',
            name: 'Payments',
            projectName: 'Billing',
          },
          to: { id: 'api', type: 'container' },
        },
      ],
      modelVersion: 1,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    const source = generatePlantUmlFromFlow(m, flow);
    expect(source).toContain('Payments');
    expect(source).toContain('API');
    expect(source).toContain('Debit');
  });

  it('includes a system that only exists as a clone card', () => {
    const m = {
      ...model(),
      containers: [
        ...model().containers,
        {
          id: 'sysB-clone',
          name: 'Partner',
          type: 'container',
          systemId: 'sys1',
          original: { id: 'sysB', type: 'system', projectId: 'proj-b' },
          position: { x: 80, y: 0 },
          connections: [{ targetId: 'api' }],
        },
      ],
    } as FlatC4Model;
    const flow: StoredDataFlow = {
      id: 'flow1',
      name: 'Inbound',
      steps: [
        {
          id: 's1',
          name: 'Request',
          from: { id: 'sysB', type: 'system', projectId: 'proj-b', name: 'Partner' },
          to: { id: 'api', type: 'container' },
        },
      ],
      modelVersion: 1,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    const source = generatePlantUmlFromFlow(m, flow);
    expect(source).toContain('Partner');
    expect(source).toMatch(/boundary "Partner"|actor "Partner"/);
    expect(source).toContain('Request');
  });
});
