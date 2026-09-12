import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import { collectTagUsage, elementIdsWithTag, removeTagFromModel } from '../tagCatalog';

const model = {
  viewLevel: 'container',
  systems: [{ id: 'sys', name: 'Banking', tags: ['core'] }],
  containers: [
    { id: 'c1', name: 'API', tags: ['core', 'pci'] },
    { id: 'c2', name: 'Worker', tags: ['core'] },
    { id: 'c3', name: 'Cache' },
  ],
  components: [{ id: 'cmp', name: 'Charge', tags: ['pci'] }],
  codeElements: [],
} as unknown as FlatC4Model;

describe('collectTagUsage', () => {
  it('counts the level in view and the whole model separately', () => {
    const usage = collectTagUsage(model);
    expect(usage.find((u) => u.tag === 'core')).toEqual({ tag: 'core', onLevel: 2, total: 3 });
    expect(usage.find((u) => u.tag === 'pci')).toEqual({ tag: 'pci', onLevel: 1, total: 2 });
  });

  it('puts what is on this level first', () => {
    expect(collectTagUsage(model).map((u) => u.tag)).toEqual(['core', 'pci']);
  });

  it('still lists a tag used nowhere on this level', () => {
    // Deleting it is still possible, so hiding it would be a lie.
    const elsewhere = { ...model, viewLevel: 'code' } as unknown as FlatC4Model;
    expect(collectTagUsage(elsewhere).map((u) => u.tag).sort()).toEqual(['core', 'pci']);
  });
});

describe('elementIdsWithTag', () => {
  it('finds the elements to light up on the level in view', () => {
    expect(elementIdsWithTag(model, 'core')).toEqual(['c1', 'c2']);
  });

  it('matches regardless of case, and shrugs at nothing', () => {
    expect(elementIdsWithTag(model, 'CORE')).toEqual(['c1', 'c2']);
    expect(elementIdsWithTag(model, '  ')).toEqual([]);
    expect(elementIdsWithTag(model, 'nope')).toEqual([]);
  });
});

describe('removeTagFromModel', () => {
  it('takes the tag off every level, not just the one in view', () => {
    const next = removeTagFromModel(model, 'core');
    expect(next.systems[0]).not.toHaveProperty('tags');
    expect((next.containers[0] as { tags?: string[] }).tags).toEqual(['pci']);
    expect(next.containers[1]).not.toHaveProperty('tags');
  });

  it('drops the field rather than leaving an empty array behind', () => {
    const next = removeTagFromModel(model, 'core');
    expect('tags' in (next.containers[1] as object)).toBe(false);
  });

  it('leaves every other tag and every untagged element alone', () => {
    const next = removeTagFromModel(model, 'core');
    expect((next.components[0] as { tags?: string[] }).tags).toEqual(['pci']);
    expect(next.containers[2]).toEqual(model.containers[2]);
  });

  it('returns the model untouched for a tag nobody uses', () => {
    expect(removeTagFromModel(model, 'ghost').containers[0]).toEqual(model.containers[0]);
  });
});
