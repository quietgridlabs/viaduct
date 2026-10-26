import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';

type Listener = (model: FlatC4Model, prev: FlatC4Model) => void;

/* A stand-in for the real store: the parts this module uses are `getState`,
   `setModel` and the selector form of `subscribe`. */
const store = {
  model: {} as FlatC4Model,
  listeners: new Set<Listener>(),
  setModel(next: FlatC4Model) {
    const prev = store.model;
    store.model = next;
    for (const listener of store.listeners) listener(next, prev);
  },
};

jest.mock('@archivisio/c4-modelizer-sdk', () => ({
  useFlatC4Store: {
    getState: () => ({ model: store.model, setModel: store.setModel }),
    subscribe: (_selector: unknown, listener: Listener) => {
      store.listeners.add(listener);
      return () => store.listeners.delete(listener);
    },
  },
}));

import {
  canUndoModel,
  clearModelHistory,
  startModelHistory,
  suspendModelHistory,
  undoModelChange,
} from '../modelHistory';

type Block = { id: string; name?: string; position?: { x: number; y: number } };

function modelOf(systems: Block[], extra: Partial<FlatC4Model> = {}): FlatC4Model {
  return {
    systems,
    containers: [],
    components: [],
    codeElements: [],
    viewLevel: 'system',
    ...extra,
  } as unknown as FlatC4Model;
}

const ids = () => (store.model.systems || []).map((s) => s.id);

let stop = () => {};

beforeEach(() => {
  store.listeners.clear();
  store.model = modelOf([{ id: 'a' }, { id: 'b' }]);
  clearModelHistory();
  stop = startModelHistory();
  /* Every step in these tests is its own gesture — see COALESCE_MS. */
  jest.spyOn(Date, 'now').mockReturnValue(0);
});

afterEach(() => {
  stop();
  jest.restoreAllMocks();
});

function at(ms: number) {
  (Date.now as jest.Mock).mockReturnValue(ms);
}

describe('model history', () => {
  it('puts back an element that was deleted', () => {
    at(1000);
    store.setModel(modelOf([{ id: 'a' }]));
    expect(ids()).toEqual(['a']);

    expect(undoModelChange()).toBe(true);
    expect(ids()).toEqual(['a', 'b']);
  });

  it('walks back one edit per press', () => {
    at(1000);
    store.setModel(modelOf([{ id: 'a' }, { id: 'b' }, { id: 'c' }]));
    at(5000);
    store.setModel(modelOf([{ id: 'a' }, { id: 'b' }]));

    undoModelChange();
    expect(ids()).toEqual(['a', 'b', 'c']);
    undoModelChange();
    expect(ids()).toEqual(['a', 'b']);
    expect(undoModelChange()).toBe(false);
  });

  it('leaves the view where it is', () => {
    at(1000);
    store.setModel(modelOf([{ id: 'a' }], { viewLevel: 'system' }));
    at(5000);
    /* Drilled into a container after the edit. */
    store.setModel({
      ...store.model,
      viewLevel: 'container',
      activeSystemId: 'a',
    } as FlatC4Model);

    undoModelChange();
    expect(ids()).toEqual(['a', 'b']);
    expect(store.model.viewLevel).toBe('container');
    expect(store.model.activeSystemId).toBe('a');
  });

  it('does not record a move between levels', () => {
    at(1000);
    store.setModel({ ...store.model, viewLevel: 'container', activeSystemId: 'a' } as FlatC4Model);
    expect(canUndoModel()).toBe(false);
  });

  it('undoes one gesture, not one card at a time', () => {
    suspendModelHistory(() =>
      store.setModel(modelOf([{ id: 'a' }, { id: 'b' }, { id: 'c' }]))
    );
    /* Deleting a selection is one store call per card, inside one gesture. */
    at(1000);
    store.setModel(modelOf([{ id: 'a' }, { id: 'b' }]));
    at(1100);
    store.setModel(modelOf([{ id: 'a' }]));

    undoModelChange();
    expect(ids()).toEqual(['a', 'b', 'c']);
    expect(canUndoModel()).toBe(false);
  });

  it('ignores what it was told to ignore', () => {
    at(1000);
    suspendModelHistory(() => store.setModel(modelOf([{ id: 'z' }])));
    expect(canUndoModel()).toBe(false);
    expect(undoModelChange()).toBe(false);
  });

  it('records edits to anything else the model carries', () => {
    at(1000);
    store.setModel(modelOf([{ id: 'a' }, { id: 'b' }], { dataFlows: [{ id: 'f1' }] } as never));
    expect(canUndoModel()).toBe(true);

    undoModelChange();
    expect((store.model as { dataFlows?: unknown[] }).dataFlows).toBeUndefined();
  });

  it('stops recording once the editor is gone', () => {
    stop();
    at(1000);
    store.setModel(modelOf([{ id: 'a' }]));
    expect(canUndoModel()).toBe(false);
    stop = startModelHistory();
  });
});
