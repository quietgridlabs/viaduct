import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import { planCloneJump } from '@utils/cloneJump';

const model = (): FlatC4Model =>
  ({
    viewLevel: 'container',
    activeSystemId: 'sys-other',
    systems: [
      { id: 'sys-1', name: 'Banking', type: 'system', position: { x: 0, y: 0 }, connections: [] },
    ],
    containers: [
      {
        id: 'api',
        name: 'API',
        type: 'container',
        systemId: 'sys-1',
        position: { x: 0, y: 0 },
        connections: [],
      },
    ],
    components: [
      {
        id: 'pay',
        name: 'Payments',
        type: 'component',
        systemId: 'sys-1',
        containerId: 'api',
        position: { x: 0, y: 0 },
        connections: [],
      },
    ],
    codeElements: [
      {
        id: 'cls',
        name: 'PaymentService',
        type: 'code',
        componentId: 'pay',
        position: { x: 0, y: 0 },
        connections: [],
      },
    ],
  }) as FlatC4Model;

describe('planCloneJump', () => {
  it('is null for a regular card', () => {
    expect(planCloneJump({ id: 'api' }, model())).toBeNull();
  });

  it('opens the original’s project when the clone is remote', () => {
    expect(
      planCloneJump(
        { id: 'clone', original: { id: 'api', type: 'container', projectId: 'other' } },
        model(),
        'here'
      )
    ).toEqual({ kind: 'remote', projectId: 'other', focusId: 'api' });
  });

  it('focuses a local system on the system diagram', () => {
    expect(
      planCloneJump({ id: 'clone', original: { id: 'sys-1', type: 'system' } }, model())
    ).toEqual({
      kind: 'local',
      target: { id: 'sys-1', viewLevel: 'system' },
    });
  });

  it('opens the parent system when the original is a container', () => {
    expect(
      planCloneJump({ id: 'clone', original: { id: 'api', type: 'container' } }, model())
    ).toEqual({
      kind: 'local',
      target: { id: 'api', viewLevel: 'container', activeSystemId: 'sys-1' },
    });
  });

  it('opens the parent container when the original is a component', () => {
    expect(
      planCloneJump({ id: 'clone', original: { id: 'pay', type: 'component' } }, model())
    ).toEqual({
      kind: 'local',
      target: {
        id: 'pay',
        viewLevel: 'component',
        activeSystemId: 'sys-1',
        activeContainerId: 'api',
      },
    });
  });

  it('opens the code view when the original is a code element', () => {
    expect(
      planCloneJump({ id: 'clone', original: { id: 'cls', type: 'code' } }, model())
    ).toEqual({
      kind: 'local',
      target: {
        id: 'cls',
        viewLevel: 'code',
        activeSystemId: 'sys-1',
        activeContainerId: 'api',
        activeComponentId: 'pay',
      },
    });
  });

  it('reports a dangling pointer', () => {
    expect(
      planCloneJump({ id: 'clone', original: { id: 'gone', type: 'container' } }, model())
    ).toEqual({ kind: 'missing' });
  });
});
