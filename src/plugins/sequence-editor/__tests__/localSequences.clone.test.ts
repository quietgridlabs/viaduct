import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import { listEntitySequences, resolveSequencesEntity } from '../localSequences';

const seq = {
  id: 'seq-1',
  name: 'Checkout',
  plantUmlSource: '@startuml\n@enduml',
};

describe('resolveSequencesEntity', () => {
  it('follows a local clone pointer to the original', () => {
    const model = {
      systems: [],
      containers: [
        {
          id: 'api',
          name: 'API',
          sequenceDiagrams: [seq],
        },
        {
          id: 'clone',
          name: 'API',
          original: { id: 'api', type: 'container' },
        },
      ],
      components: [],
      codeElements: [],
    } as unknown as FlatC4Model;

    const resolved = resolveSequencesEntity(model, 'container', 'clone');
    expect(resolved?.entity.id).toBe('api');
    expect(listEntitySequences(model, 'container', 'clone')).toEqual([
      expect.objectContaining({ id: 'seq-1' }),
    ]);
  });

  it('finds a component when a container card points at one', () => {
    const model = {
      systems: [],
      containers: [
        {
          id: 'comp-clone',
          name: 'Payments',
          original: { id: 'pay', type: 'component' },
        },
      ],
      components: [
        {
          id: 'pay',
          name: 'Payments',
          sequenceDiagrams: [seq],
        },
      ],
      codeElements: [],
    } as unknown as FlatC4Model;

    expect(resolveSequencesEntity(model, 'container', 'pay')?.ownerType).toBe('component');
    expect(listEntitySequences(model, 'container', 'comp-clone')).toEqual([
      expect.objectContaining({ id: 'seq-1' }),
    ]);
  });

  it('returns nothing when the original has no sequences', () => {
    const model = {
      systems: [],
      containers: [
        { id: 'api', name: 'API' },
        { id: 'clone', name: 'API', original: { id: 'api', type: 'container' } },
      ],
      components: [],
      codeElements: [],
    } as unknown as FlatC4Model;

    expect(listEntitySequences(model, 'container', 'clone')).toEqual([]);
  });
});
