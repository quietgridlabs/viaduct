import type { DataFlowStep } from '@/types/c4Extensions';
import {
  addBranch,
  addStepToArm,
  detachFromBranch,
  flowStepNumberLabel,
  groupFlowStages,
  removeFlowStep,
  sanitizeDataFlowStep,
  stepAlongArm,
} from '../dataFlows';

if (typeof globalThis.crypto?.randomUUID !== 'function') {
  let n = 0;
  const randomUUID = () => `11111111-1111-4111-8111-${String(n++).padStart(12, '0')}`;
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: { ...(globalThis.crypto || {}), randomUUID },
  });
}

function step(id: string, extra: Partial<DataFlowStep> = {}): DataFlowStep {
  return {
    id,
    name: id,
    from: { id: 'a', type: 'container' },
    to: { id: 'b', type: 'container' },
    ...extra,
  };
}

/** 1, then a fork of two tracks — WB runs two steps, Ozon one — then 3. */
function forkedFlow(): DataFlowStep[] {
  return [
    step('s1'),
    step('wb1', { parallelGroupId: 'g', branchKind: 'alternative', branchArmId: 'wb' }),
    step('wb2', { parallelGroupId: 'g', branchKind: 'alternative', branchArmId: 'wb' }),
    step('oz1', { parallelGroupId: 'g', branchKind: 'alternative', branchArmId: 'oz' }),
    step('s3'),
  ];
}

describe('a branch is a sequence', () => {
  it('splits a fork into tracks, each with its own steps', () => {
    const stages = groupFlowStages(forkedFlow());
    expect(stages.map((s) => s.steps.map((x) => x.id))).toEqual([
      ['s1'],
      ['wb1', 'wb2', 'oz1'],
      ['s3'],
    ]);
    const fork = stages[1]!;
    expect(fork.branched).toBe(true);
    expect(fork.kind).toBe('alternative');
    expect(fork.arms.map((a) => a.steps.map((s) => s.id))).toEqual([['wb1', 'wb2'], ['oz1']]);
  });

  it('numbers by stage, track and position along the track', () => {
    const steps = forkedFlow();
    expect(flowStepNumberLabel(steps, 's1')).toBe('1');
    expect(flowStepNumberLabel(steps, 'wb1')).toBe('2a.1');
    expect(flowStepNumberLabel(steps, 'wb2')).toBe('2a.2');
    expect(flowStepNumberLabel(steps, 'oz1')).toBe('2b.1');
    expect(flowStepNumberLabel(steps, 's3')).toBe('3');
  });

  it('keeps the old bare-letter labels while every track is one step', () => {
    const steps = [
      step('s1'),
      step('a', { parallelGroupId: 'g', branchKind: 'alternative' }),
      step('b', { parallelGroupId: 'g', branchKind: 'alternative' }),
    ];
    expect(flowStepNumberLabel(steps, 'a')).toBe('2a');
    expect(flowStepNumberLabel(steps, 'b')).toBe('2b');
  });

  it('reads a flow stored before arms existed as one step per track', () => {
    const legacy = [
      step('s1'),
      step('a', { parallelGroupId: 'g', branchKind: 'alternative' }),
      step('b', { parallelGroupId: 'g', branchKind: 'alternative' }),
    ];
    const fork = groupFlowStages(legacy)[1]!;
    expect(fork.branched).toBe(true);
    expect(fork.arms.map((a) => a.steps.map((s) => s.id))).toEqual([['a'], ['b']]);
  });

  it('is not a fork when only one track is left, whatever the group says', () => {
    const oneArm = [
      step('a', { parallelGroupId: 'g', branchKind: 'alternative', branchArmId: 'x' }),
      step('b', { parallelGroupId: 'g', branchKind: 'alternative', branchArmId: 'x' }),
    ];
    const stages = groupFlowStages(oneArm);
    expect(stages).toHaveLength(2);
    expect(stages.every((s) => !s.branched)).toBe(true);
  });
});

describe('storing which track a step is on', () => {
  it('keeps the track through a save', () => {
    const stored = sanitizeDataFlowStep({
      id: 'wb1',
      name: 'Key is WB',
      from: { id: 'a', type: 'container' },
      to: { id: 'b', type: 'container' },
      parallelGroupId: 'g',
      branchKind: 'alternative',
      branchArmId: 'wb',
    });
    expect(stored.branchArmId).toBe('wb');
    expect(sanitizeDataFlowStep(stored).branchArmId).toBe('wb');
  });

  it('drops a track on a step that is in no fork', () => {
    const stored = sanitizeDataFlowStep({
      id: 's1',
      name: 'Alone',
      from: { id: 'a', type: 'container' },
      to: { id: 'b', type: 'container' },
      branchArmId: 'wb',
    });
    expect(stored.branchArmId).toBeUndefined();
  });
});

describe('adding to a fork', () => {
  it('opens a new track beside the current one', () => {
    const { steps, newStep } = addBranch([step('s1')], 's1', 'alternative');
    const fork = groupFlowStages(steps)[0]!;
    expect(newStep).not.toBeNull();
    expect(fork.branched).toBe(true);
    expect(fork.kind).toBe('alternative');
    expect(fork.arms).toHaveLength(2);
    expect(fork.arms[0]!.steps.map((s) => s.id)).toEqual(['s1']);
    expect(fork.arms[1]!.steps.map((s) => s.id)).toEqual([newStep!.id]);
  });

  it('gives the track that was the whole stage an id, so it can grow', () => {
    const opened = addBranch([step('s1')], 's1', 'alternative').steps;
    const grown = addStepToArm(opened, 's1');
    expect(grown.newStep).not.toBeNull();
    const fork = groupFlowStages(grown.steps)[0]!;
    expect(fork.arms).toHaveLength(2);
    expect(fork.arms[0]!.steps.map((s) => s.id)).toEqual(['s1', grown.newStep!.id]);
  });

  it('appends to the end of that track and nowhere else', () => {
    const { steps, newStep } = addStepToArm(forkedFlow(), 'wb1');
    expect(steps.map((s) => s.id)).toEqual(['s1', 'wb1', 'wb2', newStep!.id, 'oz1', 's3']);
    const fork = groupFlowStages(steps)[1]!;
    expect(fork.arms.map((a) => a.steps.map((s) => s.id))).toEqual([
      ['wb1', 'wb2', newStep!.id],
      ['oz1'],
    ]);
  });

  it('refuses to add a step to a track when there is no fork', () => {
    expect(addStepToArm([step('s1')], 's1').newStep).toBeNull();
  });

  it('re-stamps every track when the fork changes kind', () => {
    const { steps } = addBranch(forkedFlow(), 'wb1', 'parallel');
    const fork = groupFlowStages(steps)[1]!;
    expect(fork.kind).toBe('parallel');
    expect(fork.steps.every((s) => s.branchKind === 'parallel')).toBe(true);
    expect(fork.arms).toHaveLength(3);
  });
});

describe('taking a track back out', () => {
  it('pulls the whole track out, in order, after the fork', () => {
    const next = detachFromBranch(forkedFlow(), 'wb2');
    expect(next.map((s) => s.id)).toEqual(['s1', 'oz1', 'wb1', 'wb2', 's3']);
    expect(groupFlowStages(next).every((s) => !s.branched)).toBe(true);
    expect(next.every((s) => !s.parallelGroupId)).toBe(true);
  });

  it('leaves the other tracks forked when more than one remains', () => {
    const three = addBranch(forkedFlow(), 'wb1', 'alternative').steps;
    const next = detachFromBranch(three, 'oz1');
    const fork = groupFlowStages(next)[1]!;
    expect(fork.branched).toBe(true);
    expect(fork.arms).toHaveLength(2);
    expect(next.map((s) => s.id)).toContain('oz1');
  });
});

describe('removing steps', () => {
  it('shortens the track when it has more steps', () => {
    const next = removeFlowStep(forkedFlow(), 'wb2');
    const fork = groupFlowStages(next)[1]!;
    expect(fork.branched).toBe(true);
    expect(fork.arms.map((a) => a.steps.map((s) => s.id))).toEqual([['wb1'], ['oz1']]);
  });

  it('dissolves the fork when the last other track goes', () => {
    const next = removeFlowStep(forkedFlow(), 'oz1');
    expect(groupFlowStages(next).every((s) => !s.branched)).toBe(true);
    expect(next.every((s) => !s.parallelGroupId)).toBe(true);
    expect(next.map((s) => s.id)).toEqual(['s1', 'wb1', 'wb2', 's3']);
  });
});

describe('playback walks the picked track', () => {
  it('goes step by step along it', () => {
    const steps = forkedFlow();
    expect(stepAlongArm(steps, 'wb1', 1)?.id).toBe('wb2');
    expect(stepAlongArm(steps, 'wb2', -1)?.id).toBe('wb1');
  });

  it('stops at the ends of the track rather than crossing into another', () => {
    const steps = forkedFlow();
    expect(stepAlongArm(steps, 'wb2', 1)).toBeNull();
    expect(stepAlongArm(steps, 'wb1', -1)).toBeNull();
    expect(stepAlongArm(steps, 'oz1', 1)).toBeNull();
  });

  it('has nothing to walk outside a fork', () => {
    expect(stepAlongArm(forkedFlow(), 's1', 1)).toBeNull();
  });
});
