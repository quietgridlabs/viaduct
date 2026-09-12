import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import { buildElementSearchIndex, searchElementIndex } from '../elementSearch';

const model = {
  domains: [{ id: 'd1', name: 'Marketplace', level: 'container' }],
  systems: [{ id: 's1', name: 'corp-gateway' }],
  containers: [
    { id: 'c1', name: 'corp-abm-gateway', systemId: 's1' },
    { id: 'c2', name: 'corp-config-server', systemId: 's1' },
    { id: 'c3', name: 'corp-marketplace-analytics-api', systemId: 's1', domainId: 'd1' },
    { id: 'c4', name: 'corp-marketplace', systemId: 's1', domainId: 'd1' },
    { id: 'c5', name: 'corp-marketplace-analytics-api', systemId: 's2' },
    { id: 'c6', name: 'corp-marketplace-clone', original: { id: 'c4' } },
  ],
  components: [],
  codeElements: [],
  viewLevel: 'system',
} as unknown as FlatC4Model;

const index = buildElementSearchIndex(model);
const names = (q: string) => searchElementIndex(index, q).map((h) => h.name);

describe('elementSearch', () => {
  it('only returns names that actually contain the query', () => {
    expect(names('corp-marketplace')).toEqual([
      'corp-marketplace',
      'corp-marketplace-analytics-api',
      'corp-marketplace-analytics-api',
    ]);
  });

  it('puts an exact name first, then a prefix, then a mid-name hit', () => {
    expect(names('gateway')).toEqual(['corp-gateway', 'corp-abm-gateway']);
  });

  it('matches across separators once the query is split into words', () => {
    expect(names('marketplace api')).toEqual([
      'corp-marketplace-analytics-api',
      'corp-marketplace-analytics-api',
    ]);
  });

  it('keeps a single hyphenated word strict rather than splitting it', () => {
    expect(names('gateway-corp')).toEqual([]);
  });

  it('leaves clones out — the original is already listed', () => {
    expect(names('clone')).toEqual([]);
  });

  it('carries the domain and the parent that tells duplicates apart', () => {
    const hits = searchElementIndex(index, 'corp-marketplace-analytics-api');
    expect(hits).toHaveLength(2);
    expect(hits.map((h) => h.parentPath)).toEqual(['corp-gateway', undefined]);
    expect(hits.map((h) => h.domainName)).toEqual(['Marketplace', undefined]);
  });

  it('answers nothing for an empty query', () => {
    expect(names('   ')).toEqual([]);
  });
});
