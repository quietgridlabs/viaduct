import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import { flowsForElement, getModelDataFlows, uniqueFlowsForElement } from '../dataFlows';

/*
 * A step names one or two ends, and everything above and below those ends
 * counts as taking part: a system is in the flow when a component three levels
 * under it is, and that component is in the flow when the step names its
 * system. These cases pin that down in both directions, since the lookup
 * behind them is an index built per model rather than a walk per element.
 */
function nestedModel(): FlatC4Model {
  return {
    viewLevel: 'system',
    systems: [
      { id: 'sysA', name: 'A', type: 'system', position: { x: 0, y: 0 }, connections: [] },
      { id: 'sysB', name: 'B', type: 'system', position: { x: 0, y: 0 }, connections: [] },
    ],
    containers: [
      { id: 'apiA', name: 'API A', type: 'container', systemId: 'sysA', position: { x: 0, y: 0 }, connections: [] },
      { id: 'apiB', name: 'API B', type: 'container', systemId: 'sysB', position: { x: 0, y: 0 }, connections: [] },
      { id: 'bus', name: 'Bus', type: 'container', systemId: 'sysB', position: { x: 0, y: 0 }, connections: [] },
    ],
    components: [
      { id: 'epA', name: 'GET /a', type: 'component', systemId: 'sysA', containerId: 'apiA', position: { x: 0, y: 0 }, connections: [] },
      { id: 'epB', name: 'POST /b', type: 'component', systemId: 'sysB', containerId: 'apiB', position: { x: 0, y: 0 }, connections: [] },
      { id: 'topic', name: 'orders', type: 'component', systemId: 'sysB', containerId: 'bus', position: { x: 0, y: 0 }, connections: [] },
    ],
    codeElements: [
      { id: 'fn', name: 'handler', type: 'code', systemId: 'sysA', containerId: 'apiA', componentId: 'epA', position: { x: 0, y: 0 }, connections: [] },
      /* Its component is not in the model — an import or a half-deleted clone
         leaves ids like this behind, and 'gone' must not become a participant. */
      { id: 'orphan', name: 'stray', type: 'code', componentId: 'gone', position: { x: 0, y: 0 }, connections: [] },
    ],
  } as unknown as FlatC4Model;
}

const ALL_IDS = [
  'sysA', 'sysB', 'apiA', 'apiB', 'bus', 'epA', 'epB', 'topic', 'fn', 'orphan',
  'ghost', 'gone', 'missing',
];

function sidesByElement(steps: unknown[]): Record<string, string> {
  const model = {
    ...nestedModel(),
    dataFlows: [{ id: 'f1', name: 'F', steps }],
  } as unknown as FlatC4Model;
  const out: Record<string, string> = {};
  for (const id of ALL_IDS) {
    const hits = flowsForElement(model, id);
    if (hits.length) out[id] = hits.map((h) => h.side).join(',');
  }
  return out;
}

describe('which elements a flow step touches', () => {
  it('claims everything under both ends', () => {
    expect(
      sidesByElement([{ id: 's1', from: { id: 'sysA', type: 'system' }, to: { id: 'sysB', type: 'system' } }])
    ).toEqual({
      sysA: 'from', apiA: 'from', epA: 'from', fn: 'from',
      sysB: 'to', apiB: 'to', bus: 'to', epB: 'to', topic: 'to',
    });
  });

  it('claims everything the ends sit under', () => {
    expect(
      sidesByElement([{ id: 's1', from: { id: 'epA', type: 'component' }, to: { id: 'epB', type: 'component' } }])
    ).toEqual({
      sysA: 'from', apiA: 'from', epA: 'from', fn: 'from',
      sysB: 'to', apiB: 'to', epB: 'to',
    });
  });

  it('walks up from a code element', () => {
    expect(
      sidesByElement([{ id: 's1', from: { id: 'fn', type: 'code' }, to: { id: 'epB', type: 'component' } }])
    ).toEqual({
      sysA: 'from', apiA: 'from', epA: 'from', fn: 'from',
      sysB: 'to', apiB: 'to', epB: 'to',
    });
  });

  it('keeps endpoints and channels apart from the ends they hang off', () => {
    expect(
      sidesByElement([
        {
          id: 's1',
          from: { id: 'apiA', type: 'container' },
          to: { id: 'bus', type: 'container' },
          endpointIds: ['epB'],
          channelIds: ['topic'],
        },
      ])
    ).toEqual({
      sysA: 'from', apiA: 'from', epA: 'from', fn: 'from',
      bus: 'to', sysB: 'to',
      epB: 'endpoint', apiB: 'endpoint',
      topic: 'channel',
    });
  });

  it('reads connections, and tolerates an end that is not in the model', () => {
    expect(
      sidesByElement([
        {
          id: 's1',
          from: { id: 'ghost', type: 'container' },
          to: { id: 'apiB', type: 'container' },
          connections: [{ sourceId: 'epA', targetId: 'epB' }],
        },
      ])
    ).toEqual({
      ghost: 'from',
      apiB: 'to', sysB: 'to',
      epA: 'connection', apiA: 'connection', sysA: 'connection', epB: 'connection',
    });
  });

  it('goes by where an id actually lives, not the type the step declares', () => {
    expect(
      sidesByElement([{ id: 's1', from: { id: 'epA', type: 'container' }, to: { id: 'sysB', type: 'component' } }])
    ).toEqual({
      sysA: 'from', apiA: 'from', epA: 'from', fn: 'from',
      sysB: 'to', apiB: 'to', bus: 'to', epB: 'to', topic: 'to',
    });
  });

  it('does not invent a parent for an orphaned code element', () => {
    expect(
      sidesByElement([{ id: 's1', from: { id: 'orphan', type: 'code' }, to: { id: 'sysA', type: 'system' } }])
    ).toEqual({
      orphan: 'from',
      sysA: 'to', apiA: 'to', epA: 'to', fn: 'to',
    });
  });

  it('gives an element one side per step, taking the first that fits', () => {
    const model = {
      ...nestedModel(),
      dataFlows: [
        {
          id: 'f1',
          name: 'F',
          steps: [
            { id: 's1', from: { id: 'epA', type: 'component' }, to: { id: 'epB', type: 'component' }, endpointIds: ['epA'] },
          ],
        },
      ],
    } as unknown as FlatC4Model;
    expect(flowsForElement(model, 'epA').map((h) => h.side)).toEqual(['from']);
  });
});

describe('flow lookups are keyed on the model', () => {
  it('hands back the same flows for the same model, and fresh ones for a new one', () => {
    const model = { ...nestedModel(), dataFlows: [{ id: 'f1', name: 'F', steps: [] }] } as unknown as FlatC4Model;
    expect(getModelDataFlows(model)).toBe(getModelDataFlows(model));

    const edited = { ...model, dataFlows: [] } as unknown as FlatC4Model;
    expect(getModelDataFlows(edited)).toEqual([]);
  });

  it('reflects an edit to the flows', () => {
    const before = {
      ...nestedModel(),
      dataFlows: [{ id: 'f1', name: 'F', steps: [{ id: 's1', from: { id: 'epA' }, to: { id: 'epB' } }] }],
    } as unknown as FlatC4Model;
    expect(uniqueFlowsForElement(before, 'epA')).toHaveLength(1);

    const after = { ...before, dataFlows: [] } as unknown as FlatC4Model;
    expect(uniqueFlowsForElement(after, 'epA')).toHaveLength(0);
  });
});
