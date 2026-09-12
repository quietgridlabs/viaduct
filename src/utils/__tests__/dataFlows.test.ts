import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import type { StoredDataFlow } from '@/types/c4Extensions';
import {
  addBranch,
  adjacentStageFirstIndex,
  adjacentPlaybackStageFirstIndex,
  detachFromBranch,
  emptyDataFlowStep,
  flowsForElement,
  flowStepNumberLabel,
  getModelDataFlows,
  groupFlowStages,
  highlightForStep,
  highlightForSteps,
  filterDataFlows,
  dataFlowManagerPath,
  dataFlowPlaybackPath,
  initialOrBranchStepId,
  isDataFlowDraftDirty,
  listFlowParticipantOptions,
  moveFlowStage,
  outgoingLinkAfterStep,
  parseDataFlowSortKey,
  playbackFlowStages,
  playbackHighlightSteps,
  persistDataFlow,
  removeFlowStep,
  resumeIndexAfterLinkAt,
  resumeIndexAfterOutgoingLink,
  sanitizeDataFlow,
  sanitizeDataFlowStep,
  setBranchKind,
  sortDataFlows,
  swapStepDirection,
  uniqueFlowsForElement,
  viewForStage,
  viewForStep,
} from '../dataFlows';

if (typeof globalThis.crypto?.randomUUID !== 'function') {
  const randomUUID = () => '11111111-1111-4111-8111-111111111111';
  if (globalThis.crypto) {
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      configurable: true,
      value: randomUUID,
    });
  } else {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID },
    });
  }
}

function model(): FlatC4Model {
  return {
    viewLevel: 'system',
    systems: [
      {
        id: 'sysA',
        name: 'A',
        type: 'system',
        position: { x: 0, y: 0 },
        connections: [{ targetId: 'sysB', label: 'sync' }],
      },
      {
        id: 'sysB',
        name: 'B',
        type: 'system',
        position: { x: 200, y: 0 },
        connections: [],
      },
    ],
    containers: [
      {
        id: 'api',
        name: 'API',
        type: 'container',
        systemId: 'sysA',
        position: { x: 0, y: 0 },
        connections: [{ targetId: 'db', label: 'JDBC' }],
      },
      {
        id: 'db',
        name: 'DB',
        type: 'container',
        systemId: 'sysA',
        position: { x: 200, y: 0 },
        connections: [],
      },
      {
        id: 'web',
        name: 'Web',
        type: 'container',
        systemId: 'sysB',
        position: { x: 0, y: 0 },
        connections: [],
      },
    ],
    components: [
      {
        id: 'ep',
        name: 'Create order',
        type: 'component',
        systemId: 'sysA',
        containerId: 'api',
        kind: 'endpoint',
        method: 'POST',
        endpoint: '/orders',
        position: { x: 0, y: 0 },
        connections: [{ targetId: 'ctrl' }],
      },
      {
        id: 'ctrl',
        name: 'OrderController',
        type: 'component',
        systemId: 'sysA',
        containerId: 'api',
        position: { x: 0, y: 80 },
        connections: [],
      },
    ],
    codeElements: [],
  } as unknown as FlatC4Model;
}

const flow: StoredDataFlow = {
  id: 'flow1',
  name: 'Place order',
  steps: [
    {
      id: 's1',
      name: 'Web → API',
      from: { id: 'web', type: 'container' },
      to: { id: 'api', type: 'container' },
    },
    {
      id: 's2',
      name: 'API → DB',
      from: { id: 'api', type: 'container' },
      to: { id: 'db', type: 'container' },
      connections: [{ sourceId: 'api', targetId: 'db' }],
    },
    {
      id: 's3',
      name: 'Endpoint hop',
      from: { id: 'ep', type: 'component' },
      to: { id: 'ctrl', type: 'component' },
      endpointIds: ['ep'],
    },
  ],
  modelVersion: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('dataFlows', () => {
  it('keeps trailing spaces in names so live inputs can type a space', () => {
    const sanitized = sanitizeDataFlow({
      id: 'f1',
      name: 'Place ',
      steps: [
        {
          id: 's1',
          name: 'Call ',
          from: { id: 'api', type: 'container' },
          to: { id: 'db', type: 'container' },
        },
      ],
    });
    expect(sanitized?.name).toBe('Place ');
    expect(sanitized?.steps[0]?.name).toBe('Call ');
    expect(persistDataFlow(sanitized!).name).toBe('Place ');
    expect(persistDataFlow(sanitized!).steps[0]?.name).toBe('Call ');
  });

  it('keeps channelIds off the endpoint list', () => {
    const sanitized = sanitizeDataFlow({
      id: 'f1',
      name: 'Settle',
      steps: [
        {
          id: 's1',
          name: 'Publish',
          from: { id: 'api', type: 'container' },
          to: { id: 'bus', type: 'container' },
          endpointIds: ['ep'],
          channelIds: ['topic'],
        },
      ],
    });
    expect(sanitized?.steps[0]?.endpointIds).toEqual(['ep']);
    expect(sanitized?.steps[0]?.channelIds).toEqual(['topic']);
  });

  it('keeps documentation and sequence attachments on sanitize', () => {
    const sanitized = sanitizeDataFlow({
      id: 'f1',
      name: 'Pay',
      steps: [],
      documentationIds: ['doc_a', 'doc_a', ''],
      sequenceIds: ['seq_b'],
    });
    expect(sanitized?.documentationIds).toEqual(['doc_a']);
    expect(sanitized?.sequenceIds).toEqual(['seq_b']);
  });

  it('sanitizes a link step, keeping its nextFlowRef and dropping it for a plain hop', () => {
    const link = sanitizeDataFlowStep({
      id: 's1',
      kind: 'link',
      nextFlowRef: { id: 'f2', projectId: 'p2', name: 'Next', projectName: 'P2' },
    });
    expect(link.kind).toBe('link');
    expect(link.nextFlowRef).toEqual({ id: 'f2', projectId: 'p2', name: 'Next', projectName: 'P2' });

    const hop = sanitizeDataFlowStep({
      id: 's2',
      nextFlowRef: { id: 'f2', projectId: 'p2', name: 'Next', projectName: 'P2' },
    });
    expect(hop.kind).toBeUndefined();
    expect(hop.nextFlowRef).toBeUndefined();
  });

  it('builds an empty link step distinct from a plain hop step', () => {
    expect(emptyDataFlowStep('link').kind).toBe('link');
    expect(emptyDataFlowStep().kind).toBeUndefined();
  });

  it('migrates a legacy flow-level nextFlowRef into a trailing link step', () => {
    const sanitized = sanitizeDataFlow({
      id: 'f1',
      name: 'Checkout',
      steps: [
        { id: 's1', name: 'Charge', from: { id: 'api', type: 'container' }, to: { id: 'db', type: 'container' } },
      ],
      nextFlowRef: { id: 'f2', projectId: 'p2', name: 'Fulfillment', projectName: 'P2' },
    });
    expect(sanitized?.steps).toHaveLength(2);
    const linkStep = sanitized?.steps[1];
    expect(linkStep?.kind).toBe('link');
    expect(linkStep?.nextFlowRef).toEqual({
      id: 'f2',
      projectId: 'p2',
      name: 'Fulfillment',
      projectName: 'P2',
    });
    expect(sanitized).not.toHaveProperty('nextFlowRef');
  });

  it('gives the migrated link step the same id on every independent sanitize pass', () => {
    const raw = {
      id: 'f1',
      name: 'Checkout',
      steps: [],
      nextFlowRef: { id: 'f2', projectId: 'p2', name: 'Fulfillment', projectName: 'P2' },
    };
    // Two separate sanitize calls over the same still-unsaved raw flow — e.g.
    // the editor's "saved" and "draft" copies — must agree on the synthesized
    // step's id, or the draft reads as dirty the instant it's opened.
    const first = sanitizeDataFlow(raw);
    const second = sanitizeDataFlow(raw);
    expect(first?.steps[0]?.id).toBe(second?.steps[0]?.id);
  });

  it('does not duplicate a link step when the flow already has one', () => {
    const sanitized = sanitizeDataFlow({
      id: 'f1',
      name: 'Checkout',
      steps: [
        {
          id: 's1',
          kind: 'link',
          nextFlowRef: { id: 'f3', projectId: 'p3', name: 'Existing', projectName: 'P3' },
        },
      ],
      nextFlowRef: { id: 'f2', projectId: 'p2', name: 'Legacy', projectName: 'P2' },
    });
    expect(sanitized?.steps).toHaveLength(1);
    expect(sanitized?.steps[0]?.nextFlowRef?.id).toBe('f3');
  });

  it('reads and sanitizes root dataFlows', () => {
    const m = { ...model(), dataFlows: [flow] } as FlatC4Model;
    expect(getModelDataFlows(m)).toHaveLength(1);
    expect(getModelDataFlows(m)[0].name).toBe('Place order');
    expect(getModelDataFlows(model())).toEqual([]);
  });

  it('finds flows a service participates in, including nested endpoints', () => {
    const m = { ...model(), dataFlows: [flow] } as FlatC4Model;
    expect(uniqueFlowsForElement(m, 'api')).toHaveLength(1);
    expect(flowsForElement(m, 'api').map((h) => h.step.id).sort()).toEqual(['s1', 's2', 's3']);
    expect(flowsForElement(m, 'ep').some((h) => h.step.id === 's3')).toBe(true);
  });

  it('picks container view for two services in the same system', () => {
    const m = model();
    const view = viewForStep(m, flow.steps[1]);
    expect(view.viewLevel).toBe('container');
    expect(view.activeSystemId).toBe('sysA');
  });

  it('picks system view when participants live in different systems', () => {
    const view = viewForStep(model(), flow.steps[0]);
    expect(view.viewLevel).toBe('system');
  });

  it('follows the clone connection for a system-to-container hop', () => {
    const m = {
      ...model(),
      containers: [
        ...model().containers,
        {
          id: 'sysB-clone',
          name: 'B',
          type: 'container',
          systemId: 'sysA',
          original: { id: 'sysB', type: 'system' },
          position: { x: 80, y: 0 },
          connections: [{ targetId: 'api', label: 'calls' }],
        },
      ],
    } as unknown as FlatC4Model;
    const step: StoredDataFlow['steps'][number] = {
      id: 'sys-to-api',
      name: 'B → API',
      from: { id: 'sysB', type: 'system' },
      to: { id: 'api', type: 'container' },
    };
    const view = viewForStep(m, step);
    expect(view.viewLevel).toBe('container');
    expect(view.activeSystemId).toBe('sysA');

    const hit = highlightForStep(
      { ...m, viewLevel: 'container', activeSystemId: 'sysA' } as FlatC4Model,
      step
    );
    expect(hit.nodeIds.has('sysB-clone')).toBe(true);
    expect(hit.nodeIds.has('api')).toBe(true);
    expect(hit.edgeIds.has('sysB-clone->api')).toBe(true);
    expect(hit.flowMotion?.get('sysB-clone->api')).toBe('forward');
  });

  it('opens the host container view when a system is cloned onto it', () => {
    const m = {
      ...model(),
      containers: [
        ...model().containers,
        {
          id: 'sysA-clone',
          name: 'A',
          type: 'container',
          systemId: 'sysA',
          original: { id: 'sysA', type: 'system' },
          position: { x: 40, y: 0 },
          connections: [{ targetId: 'api' }],
        },
      ],
    } as unknown as FlatC4Model;
    const view = viewForStep(m, {
      id: 'sysA-to-api',
      name: 'A → API',
      from: { id: 'sysA', type: 'system' },
      to: { id: 'api', type: 'container' },
    });
    expect(view.viewLevel).toBe('container');
    expect(view.activeSystemId).toBe('sysA');
  });

  it('picks component view for two components in the same container', () => {
    const view = viewForStep(model(), flow.steps[2]);
    expect(view.viewLevel).toBe('component');
    expect(view.activeContainerId).toBe('api');
  });

  it('highlights both containers and the step connection on container view', () => {
    const m = { ...model(), viewLevel: 'container', activeSystemId: 'sysA' } as FlatC4Model;
    const hit = highlightForStep(m, flow.steps[1]);
    expect([...hit.nodeIds].sort()).toEqual(['api', 'db']);
    expect(hit.edgeIds.has('api->db')).toBe(true);
    expect(hit.flowMotion?.get('api->db')).toBe('forward');
  });

  it('animates reverse when the hop opposes the C4 edge', () => {
    const m = { ...model(), viewLevel: 'container', activeSystemId: 'sysA' } as FlatC4Model;
    const hit = highlightForStep(m, {
      id: 'back',
      name: 'DB → API',
      from: { id: 'db', type: 'container' },
      to: { id: 'api', type: 'container' },
    });
    expect(hit.edgeIds.has('api->db')).toBe(true);
    expect(hit.flowMotion?.get('api->db')).toBe('reverse');
  });

  it('highlights intermediate gateways on the path between two services', () => {
    const m = {
      ...model(),
      viewLevel: 'container',
      activeSystemId: 'sysA',
      containers: [
        {
          id: 'api',
          name: 'API',
          type: 'container',
          systemId: 'sysA',
          position: { x: 0, y: 0 },
          connections: [{ targetId: 'gw' }],
        },
        {
          id: 'gw',
          name: 'Gateway',
          type: 'container',
          systemId: 'sysA',
          position: { x: 100, y: 0 },
          connections: [{ targetId: 'db' }],
        },
        {
          id: 'db',
          name: 'DB',
          type: 'container',
          systemId: 'sysA',
          position: { x: 200, y: 0 },
          connections: [],
        },
      ],
    } as unknown as FlatC4Model;
    const step: StoredDataFlow['steps'][number] = {
      id: 'via-gw',
      name: 'API → DB',
      from: { id: 'api', type: 'container' },
      to: { id: 'db', type: 'container' },
    };
    const view = viewForStep(m, step);
    expect(view.viewLevel).toBe('container');
    expect(view.activeSystemId).toBe('sysA');
    const hit = highlightForStep(m, step);
    expect([...hit.nodeIds].sort()).toEqual(['api', 'db', 'gw']);
    expect(hit.edgeIds.has('api->gw')).toBe(true);
    expect(hit.edgeIds.has('gw->db')).toBe(true);
    expect(hit.flowMotion?.get('api->gw')).toBe('forward');
    expect(hit.flowMotion?.get('gw->db')).toBe('forward');
  });

  it('projects nested participants up to the current view', () => {
    const m = { ...model(), viewLevel: 'container', activeSystemId: 'sysA' } as FlatC4Model;
    const hit = highlightForStep(m, flow.steps[2]);
    expect(hit.nodeIds.has('api')).toBe(true);
  });

  it('swaps step direction and reverses connections', () => {
    const swapped = swapStepDirection(flow.steps[1]);
    expect(swapped.from.id).toBe('db');
    expect(swapped.to.id).toBe('api');
    expect(swapped.connections).toEqual([{ sourceId: 'db', targetId: 'api' }]);
  });

  it('filters flows by name, description, and step text', () => {
    const checkout: StoredDataFlow = {
      ...flow,
      id: 'flow2',
      name: 'Checkout',
      description: 'Pay for cart',
      steps: [{ ...flow.steps[0], id: 'x1', name: 'Charge card' }],
    };
    const listed = [flow, checkout];
    expect(filterDataFlows(listed, 'place').map((f) => f.id)).toEqual(['flow1']);
    expect(filterDataFlows(listed, 'cart').map((f) => f.id)).toEqual(['flow2']);
    expect(filterDataFlows(listed, 'charge').map((f) => f.id)).toEqual(['flow2']);
    expect(filterDataFlows(listed, '  ')).toEqual(listed);
  });

  it('sorts flows by name, recency, and step count', () => {
    const older: StoredDataFlow = {
      ...flow,
      id: 'a',
      name: 'Beta',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const newer: StoredDataFlow = {
      ...flow,
      id: 'b',
      name: 'Alpha',
      steps: [flow.steps[0]],
      createdAt: '2026-02-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    };
    const listed = [older, newer];
    expect(sortDataFlows(listed, 'name-asc').map((f) => f.id)).toEqual(['b', 'a']);
    expect(sortDataFlows(listed, 'name-desc').map((f) => f.id)).toEqual(['a', 'b']);
    expect(sortDataFlows(listed, 'updated').map((f) => f.id)).toEqual(['b', 'a']);
    expect(sortDataFlows(listed, 'created').map((f) => f.id)).toEqual(['b', 'a']);
    expect(sortDataFlows(listed, 'steps').map((f) => f.id)).toEqual(['a', 'b']);
    expect(parseDataFlowSortKey('nope')).toBe('updated');
  });

  it('groups from/to participants like the C4 catalog', () => {
    const opts = listFlowParticipantOptions(model());
    expect(opts.find((o) => o.id === 'sysA')?.group).toBe('Systems');
    expect(opts.find((o) => o.id === 'api')?.group).toBe('Containers');
    expect(opts.find((o) => o.id === 'api')?.detail).toBe('A');
    expect(opts.find((o) => o.id === 'ep')?.group).toBe('API');
    expect(opts.find((o) => o.id === 'ep')?.label).toBe('POST /orders');
    expect(opts.find((o) => o.id === 'ep')?.detail).toBe('Endpoint');

    const withDb = {
      ...model(),
      containers: model().containers.map((c) =>
        c.id === 'db' ? { ...c, technology: 'postgresql' } : c
      ),
    } as FlatC4Model;
    expect(listFlowParticipantOptions(withDb).find((o) => o.id === 'db')?.group).toBe(
      'Databases'
    );
  });

  it('sorts participants alphabetically within each group', () => {
    const shuffled = {
      ...model(),
      systems: [
        { id: 'sysZ', name: 'Zebra', type: 'system', position: { x: 0, y: 0 }, connections: [] },
        { id: 'sysA', name: 'Alpha', type: 'system', position: { x: 0, y: 0 }, connections: [] },
      ],
      containers: [
        {
          id: 'web',
          name: 'Web',
          type: 'container',
          systemId: 'sysA',
          position: { x: 0, y: 0 },
          connections: [],
        },
        {
          id: 'api',
          name: 'API',
          type: 'container',
          systemId: 'sysA',
          position: { x: 0, y: 0 },
          connections: [],
        },
      ],
    } as unknown as FlatC4Model;
    const opts = listFlowParticipantOptions(shuffled);
    expect(opts.filter((o) => o.group === 'Systems').map((o) => o.label)).toEqual([
      'Alpha',
      'Zebra',
    ]);
    expect(opts.filter((o) => o.group === 'Containers').map((o) => o.label)).toEqual([
      'API',
      'Web',
    ]);
  });

  it('treats content changes as dirty and ignores audit timestamps', () => {
    expect(isDataFlowDraftDirty(flow, flow)).toBe(false);
    expect(isDataFlowDraftDirty({ ...flow, name: 'Other' }, flow)).toBe(true);
    expect(
      isDataFlowDraftDirty(
        { ...flow, updatedAt: '2026-12-01T00:00:00.000Z' },
        flow
      )
    ).toBe(false);
    expect(isDataFlowDraftDirty(flow, null)).toBe(true);
  });

  it('keeps parallelGroupId and branchKind on sanitize and drops blanks', () => {
    const sanitized = sanitizeDataFlow({
      id: 'f1',
      name: 'Fan-out',
      steps: [
        {
          id: 'a',
          name: 'A',
          from: { id: 'api', type: 'container' },
          to: { id: 'db', type: 'container' },
          parallelGroupId: 'pgrp_1',
          branchKind: 'alternative',
        },
        {
          id: 'b',
          name: 'B',
          from: { id: 'api', type: 'container' },
          to: { id: 'web', type: 'container' },
          parallelGroupId: '  ',
        },
        {
          id: 'c',
          name: 'C',
          from: { id: 'api', type: 'container' },
          to: { id: 'web', type: 'container' },
          parallelGroupId: 'pgrp_2',
        },
      ],
    });
    expect(sanitized?.steps[0]?.parallelGroupId).toBe('pgrp_1');
    expect(sanitized?.steps[0]?.branchKind).toBe('alternative');
    expect(sanitized?.steps[1]?.parallelGroupId).toBeUndefined();
    expect(sanitized?.steps[2]?.branchKind).toBe('parallel');
  });

  it('groups consecutive parallel hops as one stage', () => {
    const steps = [
      { ...flow.steps[0], id: 's1' },
      { ...flow.steps[1], id: 's2', parallelGroupId: 'g1' },
      { ...flow.steps[2], id: 's3', parallelGroupId: 'g1' },
    ];
    const stages = groupFlowStages(steps);
    expect(stages).toHaveLength(2);
    expect(stages[0]?.branched).toBe(false);
    expect(stages[1]?.branched).toBe(true);
    expect(stages[1]?.kind).toBe('parallel');
    expect(stages[1]?.steps.map((s) => s.id)).toEqual(['s2', 's3']);
    expect(flowStepNumberLabel(steps, 's2')).toBe('2a');
    expect(flowStepNumberLabel(steps, 's3')).toBe('2b');
    expect(adjacentStageFirstIndex(steps, 0, 1)).toBe(1);
    expect(adjacentStageFirstIndex(steps, 1, 1)).toBe(1);
    expect(adjacentStageFirstIndex(steps, 2, -1)).toBe(0);
  });

  it('skips exclusive link stages in playback and exposes the outgoing continuation', () => {
    const steps = [
      { ...flow.steps[0], id: 's1', name: 'Charge' },
      {
        ...emptyDataFlowStep('link'),
        id: 's-link',
        nextFlowRef: { id: 'f2', projectId: 'p2', name: 'Fulfillment', projectName: 'P2' },
      },
    ];
    expect(playbackFlowStages(steps)).toHaveLength(1);
    expect(outgoingLinkAfterStep(steps, 0)?.id).toBe('f2');
    expect(adjacentPlaybackStageFirstIndex(steps, 0, 1)).toBe(0);
    expect(resumeIndexAfterOutgoingLink(steps, 0)).toBeNull();
  });

  it('resumes after a mid-flow link to the following hop', () => {
    const steps = [
      { ...flow.steps[0], id: 's1', name: 'Before' },
      {
        ...emptyDataFlowStep('link'),
        id: 's-link',
        nextFlowRef: { id: 'f2', projectId: 'p2', name: 'Child', projectName: 'P2' },
      },
      { ...flow.steps[1], id: 's3', name: 'After' },
    ];
    expect(playbackFlowStages(steps).map((s) => s.steps[0]?.id)).toEqual(['s1', 's3']);
    expect(outgoingLinkAfterStep(steps, 0)?.id).toBe('f2');
    expect(resumeIndexAfterOutgoingLink(steps, 0)).toBe(2);
    expect(resumeIndexAfterLinkAt(steps, 1)).toBe(2);
  });

  it('treats a lone parallelGroupId as sequential', () => {
    const stages = groupFlowStages([
      { ...flow.steps[0], id: 's1', parallelGroupId: 'orphan' },
    ]);
    expect(stages).toHaveLength(1);
    expect(stages[0]?.branched).toBe(false);
  });

  it('adds a parallel branch after the current stage', () => {
    const { steps, newStep } = addBranch(flow.steps, 's1', 'parallel');
    expect(newStep?.parallelGroupId).toBeTruthy();
    expect(newStep?.branchKind).toBe('parallel');
    expect(steps[0]?.parallelGroupId).toBe(newStep?.parallelGroupId);
    expect(steps[0]?.branchKind).toBe('parallel');
    expect(steps[1]?.id).toBe(newStep?.id);
    expect(groupFlowStages(steps)[0]?.branched).toBe(true);
    expect(groupFlowStages(steps)[0]?.kind).toBe('parallel');
    expect(groupFlowStages(steps)).toHaveLength(3);
  });

  it('adds an OR branch and stamps branchKind alternative', () => {
    const { steps, newStep } = addBranch(flow.steps, 's1', 'alternative');
    expect(newStep?.branchKind).toBe('alternative');
    expect(steps[0]?.branchKind).toBe('alternative');
    const stage = groupFlowStages(steps)[0];
    expect(stage?.branched).toBe(true);
    expect(stage?.kind).toBe('alternative');
    expect(playbackHighlightSteps(stage!).map((s) => s.id)).toEqual(
      stage!.steps.map((s) => s.id)
    );
    expect(playbackHighlightSteps(stage!, newStep!.id).map((s) => s.id)).toEqual([
      newStep!.id,
    ]);
    expect(initialOrBranchStepId(steps, 0)).toBeNull();
    expect(initialOrBranchStepId(steps, 1, newStep!.id)).toBe(newStep!.id);
  });

  it('flips a branched stage between AND and OR', () => {
    const grouped = addBranch(flow.steps, 's1', 'parallel').steps;
    const flipped = setBranchKind(grouped, 's1', 'alternative');
    expect(groupFlowStages(flipped)[0]?.kind).toBe('alternative');
    expect(flipped.filter((s) => s.parallelGroupId).every((s) => s.branchKind === 'alternative')).toBe(
      true
    );
  });

  it('detaches a hop from a branch group', () => {
    const grouped = addBranch(flow.steps, 's1').steps;
    const extraId = grouped[1]?.id as string;
    const detached = detachFromBranch(grouped, extraId);
    expect(detached.find((s) => s.id === extraId)?.parallelGroupId).toBeUndefined();
    expect(detached.find((s) => s.id === 's1')?.parallelGroupId).toBeUndefined();
    expect(groupFlowStages(detached).every((s) => !s.branched)).toBe(true);
  });

  it('moves a parallel stage as a unit', () => {
    const grouped = addBranch([flow.steps[0], flow.steps[1]], 's1').steps;
    const moved = moveFlowStage(grouped, 's1', 1);
    expect(moved[0]?.id).toBe('s2');
    expect(moved.slice(1).every((s) => s.parallelGroupId)).toBe(true);
  });

  it('strips orphan parallelGroupId when a branch is removed', () => {
    const grouped = addBranch(flow.steps, 's1').steps;
    const extraId = grouped[1]?.id as string;
    const next = removeFlowStep(grouped, extraId);
    expect(next.find((s) => s.id === 's1')?.parallelGroupId).toBeUndefined();
  });

  it('unions highlights for parallel hops', () => {
    const m = {
      ...model(),
      viewLevel: 'container',
      activeSystemId: 'sysA',
      containers: [
        ...model().containers,
        {
          id: 'cache',
          name: 'Cache',
          type: 'container',
          systemId: 'sysA',
          position: { x: 400, y: 0 },
          connections: [],
        },
      ],
    } as FlatC4Model;
    const hit = highlightForSteps(m, [
      {
        id: 'a',
        name: 'API → DB',
        from: { id: 'api', type: 'container' },
        to: { id: 'db', type: 'container' },
        connections: [{ sourceId: 'api', targetId: 'db' }],
      },
      {
        id: 'b',
        name: 'API → Cache',
        from: { id: 'api', type: 'container' },
        to: { id: 'cache', type: 'container' },
      },
    ]);
    expect([...hit.nodeIds].sort()).toEqual(['api', 'cache', 'db']);
    expect(hit.edgeIds.has('api->db')).toBe(true);
  });

  it('picks a shared container view for parallel hops in one system', () => {
    const view = viewForStage(model(), [
      flow.steps[1],
      {
        id: 's4',
        name: 'API → API',
        from: { id: 'api', type: 'container' },
        to: { id: 'db', type: 'container' },
      },
    ]);
    expect(view.viewLevel).toBe('container');
    expect(view.activeSystemId).toBe('sysA');
  });

  it('falls back to system view when parallel hops disagree', () => {
    const view = viewForStage(model(), [flow.steps[0], flow.steps[1]]);
    expect(view.viewLevel).toBe('system');
  });

  it('builds flow paths with returnTo', () => {
    expect(dataFlowPlaybackPath('proj', 'flow1', 'step1', '/projects/proj?focus=api')).toBe(
      '/projects/proj?flow=flow1&step=step1&returnTo=%2Fprojects%2Fproj%3Ffocus%3Dapi'
    );
    expect(dataFlowManagerPath('proj', 'flow1', 'step1', '/projects/proj?focus=api')).toBe(
      '/projects/proj/flows?flow=flow1&step=step1&returnTo=%2Fprojects%2Fproj%3Ffocus%3Dapi'
    );
  });
});
