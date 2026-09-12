import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import {
  catalogEditorPath,
  catalogHitById,
  classifyContainer,
  diagramFocusMatchesView,
  groupContainersBySystem,
  resolveDiagramFocus,
  searchCatalogElements,
} from '../serviceCatalog';

const model = (): FlatC4Model =>
  ({
    viewLevel: 'system',
    systems: [
      { id: 'sys1', name: 'Platform', type: 'system', position: { x: 0, y: 0 }, connections: [] },
      { id: 'sys2', name: 'Empty', type: 'system', position: { x: 1, y: 0 }, connections: [] },
    ],
    containers: [
      {
        id: 'api',
        name: 'Seller API',
        type: 'container',
        systemId: 'sys1',
        technology: 'nodejs',
        position: { x: 0, y: 0 },
        connections: [],
      },
      {
        id: 'gw',
        name: 'Edge Gateway',
        type: 'container',
        systemId: 'sys1',
        technology: 'nginx',
        position: { x: 1, y: 0 },
        connections: [],
      },
      {
        id: 'bus',
        name: 'Events',
        type: 'container',
        systemId: 'sys1',
        technology: 'kafka',
        position: { x: 2, y: 0 },
        connections: [],
      },
      {
        id: 'db',
        name: 'Subscriptions DB',
        type: 'container',
        systemId: 'sys1',
        technology: 'postgresql',
        position: { x: 3, y: 0 },
        connections: [],
      },
      {
        id: 'clone',
        name: 'Seller API clone',
        type: 'container',
        systemId: 'sys1',
        original: { id: 'api', type: 'container' },
        position: { x: 4, y: 0 },
        connections: [],
      },
    ],
    components: [
      {
        id: 'ep',
        name: 'Check subscription',
        type: 'component',
        systemId: 'sys1',
        containerId: 'api',
        kind: 'endpoint',
        endpoint: '/v1/subscriptions/check',
        position: { x: 0, y: 0 },
        connections: [],
      },
    ],
    codeElements: [],
  }) as FlatC4Model;

describe('serviceCatalog', () => {
  it('classifies containers by technology', () => {
    expect(classifyContainer({ technology: 'nodejs' })).toBe('service');
    expect(classifyContainer({ technology: 'nginx' })).toBe('gateway');
    expect(classifyContainer({ technology: 'kafka' })).toBe('broker');
    expect(classifyContainer({ technology: 'apachekafka' })).toBe('broker');
    expect(classifyContainer({ technology: 'postgresql' })).toBe('database');
  });

  it('groups originals by system and category, skipping clones and empty systems', () => {
    const groups = groupContainersBySystem(model());
    expect(groups.map((g) => g.system.id)).toEqual(['sys1']);
    expect(groups[0].categories.map((c) => c.category)).toEqual([
      'service',
      'gateway',
      'broker',
      'database',
    ]);
    expect(groups[0].categories.flatMap((c) => c.containers.map((x) => x.id))).not.toContain(
      'clone'
    );
  });

  it('searches systems, containers, and endpoint paths by name', () => {
    const m = model();
    expect(searchCatalogElements(m, 'platform').map((h) => h.id)).toEqual(['sys1']);
    expect(searchCatalogElements(m, 'seller api').map((h) => h.kind)).toEqual(['container']);
    expect(searchCatalogElements(m, 'subscriptions/check')[0]?.id).toBe('ep');
    expect(searchCatalogElements(m, 'clone')).toEqual([]);
  });

  it('resolves diagram focus to the parent C4 view', () => {
    const m = model();
    expect(resolveDiagramFocus(m, 'sys1')).toEqual({ id: 'sys1', viewLevel: 'system' });
    expect(resolveDiagramFocus(m, 'api')).toEqual({
      id: 'api',
      viewLevel: 'container',
      activeSystemId: 'sys1',
    });
    expect(resolveDiagramFocus(m, 'ep')).toEqual({
      id: 'ep',
      viewLevel: 'component',
      activeSystemId: 'sys1',
      activeContainerId: 'api',
    });
    expect(
      diagramFocusMatchesView(
        { ...m, viewLevel: 'container', activeSystemId: 'sys1' },
        resolveDiagramFocus(m, 'api')!
      )
    ).toBe(true);
  });

  it('looks up a hit after search is cleared and builds the editor path', () => {
    expect(catalogHitById(model(), 'ep')?.kind).toBe('component');
    expect(catalogEditorPath('proj', 'api')).toBe('/projects/proj?focus=api');
    expect(catalogEditorPath(undefined, 'api')).toBe('/?focus=api');
    expect(catalogEditorPath('proj', 'api', '/projects/proj?focus=ep')).toBe(
      '/projects/proj?focus=api&returnTo=%2Fprojects%2Fproj%3Ffocus%3Dep'
    );
  });
});
