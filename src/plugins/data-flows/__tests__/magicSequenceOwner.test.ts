/**
 * The magic sequence hangs off whichever element the flow's first step starts
 * at. Edit the front of a flow and that element changes — the diagram has to
 * move, not be copied, or the same id ends up on two elements and every lookup
 * by id picks whichever the scan happens to reach last.
 */
import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import type { SequenceDiagramExtras, StoredDataFlow } from '@/types/c4Extensions';
import { resolveFlowSequences } from '../attachments';
import { applyMagicSequenceLocally } from '../magicSequence';

/* jsdom does not provide it; the code under test clones the model with it. */
if (typeof globalThis.structuredClone !== 'function') {
  Object.defineProperty(globalThis, 'structuredClone', {
    configurable: true,
    value: (value: unknown) => JSON.parse(JSON.stringify(value)),
  });
}

if (typeof globalThis.crypto?.randomUUID !== 'function') {
  let n = 0;
  const randomUUID = () => `11111111-1111-4111-8111-${String(n++).padStart(12, '0')}`;
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: { ...(globalThis.crypto || {}), randomUUID },
  });
}

/* `api` first, `ui` second: a stale copy left on `ui` is the one a map built by
   walking this list in order would keep. */
function model(): FlatC4Model {
  return {
    viewLevel: 'container',
    systems: [{ id: 'sys', name: 'Platform' }],
    containers: [
      { id: 'api', name: 'API', systemId: 'sys' },
      { id: 'ui', name: 'UI', systemId: 'sys' },
    ],
    components: [],
    codeElements: [],
  } as unknown as FlatC4Model;
}

function flowStartingAt(fromId: string): StoredDataFlow {
  return {
    id: 'flow1',
    name: 'Key check',
    modelVersion: 1,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    steps: [
      {
        id: 'st1',
        name: `Starts at ${fromId}`,
        from: { id: fromId, type: 'container' },
        to: { id: fromId === 'ui' ? 'api' : 'ui', type: 'container' },
      },
    ],
  } as unknown as StoredDataFlow;
}

function holdersOf(m: FlatC4Model, diagramId: string): string[] {
  return (m.containers as Array<{ id: string; name: string } & SequenceDiagramExtras>)
    .filter((c) => c.sequenceDiagrams?.some((d) => d.id === diagramId))
    .map((c) => c.name);
}

describe('regenerating after the flow’s first step changed', () => {
  it('moves the diagram instead of leaving a copy behind', () => {
    const first = applyMagicSequenceLocally(model(), flowStartingAt('ui'));
    expect('error' in first).toBe(false);
    if ('error' in first) return;
    expect(holdersOf(first.model, first.flow.magicSequenceId!)).toEqual(['UI']);

    /* The author deletes the leading steps, so the flow now starts at `api`. */
    const moved = { ...first.flow, steps: flowStartingAt('api').steps };
    const second = applyMagicSequenceLocally(first.model, moved);
    expect('error' in second).toBe(false);
    if ('error' in second) return;

    expect(second.flow.magicSequenceId).toBe(first.flow.magicSequenceId);
    expect(holdersOf(second.model, second.flow.magicSequenceId!)).toEqual(['API']);
  });

  it('shows the source it just generated, not the one left on the old owner', () => {
    const first = applyMagicSequenceLocally(model(), flowStartingAt('ui'));
    if ('error' in first) throw new Error('first pass failed');
    const moved = { ...first.flow, steps: flowStartingAt('api').steps };
    const second = applyMagicSequenceLocally(first.model, moved);
    if ('error' in second) throw new Error('second pass failed');

    const [shown] = resolveFlowSequences(second.model, second.flow.sequenceIds);
    expect(shown?.plantUmlSource).toBe(second.plan.plantUmlSource);
    expect(shown?.plantUmlSource).toContain('Starts at api');
    expect(shown?.plantUmlSource).not.toContain('Starts at ui');
  });
});
