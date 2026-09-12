import {
  buildClipboardPayload,
  buildPastePlan,
  isEditableKeyboardTarget,
  parseClipboardPayload,
} from '../diagramClipboard';
import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';

const model = (): FlatC4Model =>
  ({
    viewLevel: 'component',
    activeSystemId: 'sys1',
    activeContainerId: 'c1',
    systems: [],
    containers: [
      {
        id: 'c1',
        name: 'API',
        type: 'container',
        systemId: 'sys1',
        position: { x: 0, y: 0 },
        connections: [],
      },
    ],
    components: [
      {
        id: 'ctrl',
        name: 'Controller',
        type: 'component',
        systemId: 'sys1',
        containerId: 'c1',
        position: { x: 10, y: 20 },
        connections: [{ targetId: 'svc', label: 'calls' }],
      },
      {
        id: 'svc',
        name: 'Service',
        type: 'component',
        systemId: 'sys1',
        containerId: 'c1',
        position: { x: 100, y: 20 },
        connections: [],
      },
      {
        id: 'other',
        name: 'Other',
        type: 'component',
        systemId: 'sys1',
        containerId: 'c1',
        position: { x: 200, y: 20 },
        connections: [],
      },
    ],
    codeElements: [],
  }) as FlatC4Model;

describe('diagramClipboard', () => {
  it('copies selected elements and only intra-selection connections', () => {
    const payload = buildClipboardPayload(model(), ['ctrl', 'svc']);
    expect(payload?.viewLevel).toBe('component');
    expect(payload?.elements.map((e) => e.id).sort()).toEqual(['ctrl', 'svc']);
    const ctrl = payload!.elements.find((e) => e.id === 'ctrl')!;
    expect(ctrl.connections).toEqual([{ targetId: 'svc', label: 'calls' }]);
  });

  it('remaps ids and offsets positions on paste plan', () => {
    const payload = buildClipboardPayload(model(), ['ctrl', 'svc'])!;
    const plan = buildPastePlan(payload, 0);
    expect(plan.items).toHaveLength(2);
    const ids = new Set(plan.items.map((i) => i.newId));
    expect(ids.size).toBe(2);
    expect([...ids].every((id) => !['ctrl', 'svc'].includes(id))).toBe(true);

    const ctrl = plan.items.find((i) => i.oldId === 'ctrl')!;
    const svc = plan.items.find((i) => i.oldId === 'svc')!;
    expect(ctrl.connections[0].targetId).toBe(svc.newId);
    expect(ctrl.position).toEqual({ x: 58, y: 68 });
  });

  it('parses clipboard json and rejects garbage', () => {
    const payload = buildClipboardPayload(model(), ['svc'])!;
    expect(parseClipboardPayload(JSON.stringify(payload))?.elements).toHaveLength(1);
    expect(parseClipboardPayload('not-json')).toBeNull();
    expect(parseClipboardPayload('{"version":2}')).toBeNull();
  });

  it('detects editable keyboard targets', () => {
    const input = document.createElement('input');
    expect(isEditableKeyboardTarget(input)).toBe(true);
    expect(isEditableKeyboardTarget(document.createElement('div'))).toBe(false);
  });
});
