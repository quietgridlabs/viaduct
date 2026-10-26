const updateSystem = jest.fn();
const updateContainer = jest.fn();
const updateComponent = jest.fn();
const updateCodeElement = jest.fn();
const updateConnection = jest.fn();

let MODEL: Record<string, unknown> = {};

/* The real module pulls the whole technology catalog in from JSON, which this
   jest config cannot import. Only the one predicate is used here. */
jest.mock('@data/technologies', () => ({
  isPersonTechnology: (id?: string) => id === 'users',
}));

jest.mock('@archivisio/c4-modelizer-sdk', () => ({
  useFlatC4Store: {
    getState: () => ({
      model: MODEL,
      updateSystem,
      updateContainer,
      updateComponent,
      updateCodeElement,
      updateConnection,
    }),
  },
}));

import { arrangeCurrentView } from '../arrangeCurrentView';

type Sys = {
  id: string;
  to?: string[];
  kind?: string;
  technology?: string;
  position?: { x: number; y: number };
};

function systemModel(systems: Sys[]) {
  return {
    viewLevel: 'system',
    systems: systems.map((s) => ({
      id: s.id,
      kind: s.kind,
      technology: s.technology,
      position: s.position,
      connections: (s.to || []).map((targetId) => ({ targetId })),
    })),
    containers: [],
    components: [],
    codeElements: [],
  };
}

function handlesFor(source: string, target: string) {
  return updateConnection.mock.calls.find(
    ([, from, to]) => from === source && to === target
  )?.[3];
}

/** `source-right-0-s1` → `right`, so a test can talk about sides not slots. */
function sideOf(handle: string) {
  return handle.split('-')[1];
}

describe('arrangeCurrentView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reports what it moved and offers a way back', () => {
    MODEL = systemModel([{ id: 'a', to: ['b'] }, { id: 'b', to: ['c'] }, { id: 'c' }]);
    const outcome = arrangeCurrentView();
    expect(outcome?.moved).toBe(3);
    expect(outcome?.viewKey).toBe('system|||');
    expect(typeof outcome?.revert).toBe('function');
    expect(updateConnection).toHaveBeenCalledTimes(2);
  });

  it('sends a forward edge out of the right face, since the layout runs left to right', () => {
    MODEL = systemModel([{ id: 'a', to: ['b'] }, { id: 'b', to: ['c'] }, { id: 'c' }]);
    arrangeCurrentView();
    for (const pair of [['a', 'b'], ['b', 'c']] as const) {
      expect(handlesFor(...pair)).toEqual({
        sourceHandle: 'source-right-0',
        targetHandle: 'target-left-0',
      });
    }
  });

  it('turns an edge around when the layout puts its target behind it', () => {
    /* A cycle has to break somewhere: one of these three edges ends up
       pointing back up the row, and that is the edge the old code left
       hanging off the wrong face. */
    MODEL = systemModel([
      { id: 'a', to: ['b'] },
      { id: 'b', to: ['c'] },
      { id: 'c', to: ['a'] },
    ]);
    arrangeCurrentView();
    const backwards = updateConnection.mock.calls.filter(
      ([, , , patch]) => sideOf(patch.sourceHandle) === 'left'
    );
    expect(backwards).toHaveLength(1);
    expect(backwards[0][3].targetHandle).toBe('target-right-3');
  });

  it('keeps a far-below card in the next column on the sideways route', () => {
    MODEL = systemModel([
      { id: 'hub', to: ['a', 'b', 'c', 'd'] },
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
      { id: 'd' },
    ]);
    arrangeCurrentView();
    const sides = updateConnection.mock.calls.map(([, , , p]) => sideOf(p.sourceHandle));
    expect(sides).toEqual(Array(4).fill('right'));
  });

  it('spreads the lines leaving one side over the points that side has', () => {
    /* Four lines out of one card used to name one handle and converge on a
       single dot. A vertical side offers two points, so they share two. */
    MODEL = systemModel([
      { id: 'hub', to: ['a', 'b', 'c', 'd'] },
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
      { id: 'd' },
    ]);
    arrangeCurrentView();
    const used = new Set(
      updateConnection.mock.calls.map(([, , , p]) => p.sourceHandle)
    );
    expect(used).toEqual(new Set(['source-right-0', 'source-right-0-s1']));
  });

  it('leaves a lone line on the plain handle', () => {
    MODEL = systemModel([{ id: 'a', to: ['b'] }, { id: 'b' }]);
    arrangeCurrentView();
    expect(handlesFor('a', 'b')).toEqual({
      sourceHandle: 'source-right-0',
      targetHandle: 'target-left-0',
    });
  });

  it('never hands a person card a slot it does not have', () => {
    /* An actor is one point per side; the suffixed ids are not rendered on it
       and an edge naming a missing handle is silently not drawn. */
    MODEL = systemModel([
      { id: 'actor', kind: 'person', to: ['a', 'b', 'c'] },
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
    ]);
    arrangeCurrentView();
    const fromActor = updateConnection.mock.calls.map(([, , , p]) => p.sourceHandle);
    expect(new Set(fromActor)).toEqual(new Set(['source-right-0']));
  });

  it('treats the users technology as a person too', () => {
    MODEL = systemModel([
      { id: 'actor', technology: 'users', to: ['a', 'b', 'c'] },
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
    ]);
    arrangeCurrentView();
    const fromActor = updateConnection.mock.calls.map(([, , , p]) => p.sourceHandle);
    expect(new Set(fromActor)).toEqual(new Set(['source-right-0']));
  });

  it('puts every card and every line back on revert', () => {
    MODEL = systemModel([
      { id: 'a', to: ['b'], position: { x: 11, y: 22 } },
      { id: 'b', position: { x: 33, y: 44 } },
    ]);
    MODEL.systems[0].connections[0].sourceHandle = 'source-top-3';
    MODEL.systems[0].connections[0].targetHandle = 'target-bottom-2';

    const outcome = arrangeCurrentView();
    jest.clearAllMocks();
    outcome!.revert();

    expect(updateSystem).toHaveBeenCalledWith('a', { position: { x: 11, y: 22 } });
    expect(updateSystem).toHaveBeenCalledWith('b', { position: { x: 33, y: 44 } });
    expect(updateConnection).toHaveBeenCalledWith('system', 'a', 'b', {
      sourceHandle: 'source-top-3',
      targetHandle: 'target-bottom-2',
    });
  });

  it('routes at the level being looked at, not always the system one', () => {
    MODEL = {
      viewLevel: 'container',
      activeSystemId: 'sys',
      systems: [],
      containers: [
        { id: 'x', systemId: 'sys', connections: [{ targetId: 'y' }] },
        { id: 'y', systemId: 'sys', connections: [] },
      ],
      components: [],
      codeElements: [],
    };
    const outcome = arrangeCurrentView();
    expect(outcome?.viewKey).toBe('container|sys||');
    expect(updateConnection).toHaveBeenCalledWith(
      'container',
      'x',
      'y',
      expect.objectContaining({ sourceHandle: 'source-right-0' })
    );
  });

  it('leaves alone a connection pointing outside the view', () => {
    MODEL = systemModel([{ id: 'a', to: ['gone'] }]);
    arrangeCurrentView();
    expect(updateConnection).not.toHaveBeenCalled();
  });

  it('does nothing at all on an empty view', () => {
    MODEL = systemModel([]);
    expect(arrangeCurrentView()).toBeNull();
    expect(updateConnection).not.toHaveBeenCalled();
    expect(updateSystem).not.toHaveBeenCalled();
  });
});
