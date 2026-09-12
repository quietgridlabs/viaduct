import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import {
  clearDomainMembership,
  deriveDomainEdges,
  formatCloneHierarchyPath,
  getEditableDomains,
  getModelDomains,
  listDomainMembers,
  resolveCloneOriginLabel,
  sanitizeDomain,
  withModelDomains,
} from '../domains';

describe('domains', () => {
  it('sanitizes domain records', () => {
    expect(sanitizeDomain({ id: 'd1', name: '  Orders  ', level: 'system' })).toEqual({
      id: 'd1',
      name: 'Orders',
      level: 'system',
    });
    expect(sanitizeDomain({ name: '', level: 'container' })).toBeNull();
  });

  it('keeps a valid hex colour and drops anything else', () => {
    expect(sanitizeDomain({ id: 'd1', name: 'Orders', level: 'system', color: '#1F75CB' })).toEqual({
      id: 'd1',
      name: 'Orders',
      level: 'system',
      color: '#1f75cb',
    });
    expect(
      sanitizeDomain({ id: 'd1', name: 'Orders', level: 'system', color: 'red' })
    ).not.toHaveProperty('color');
  });

  it('reads domains without trimming live input', () => {
    const model = {
      domains: [{ id: 'd1', name: 'New domain ', description: 'line one ', level: 'system' }],
      systems: [],
      containers: [],
      components: [],
      codeElements: [],
      viewLevel: 'system',
    } as unknown as FlatC4Model;

    expect(getModelDomains(model)[0]).toEqual({
      id: 'd1',
      name: 'New domain ',
      description: 'line one ',
      level: 'system',
    });
  });

  /* Clearing the name box is a step of typing one, and the editor writes every
     keystroke to the model. A read that drops the half-typed record takes the
     row out of the list under the cursor and out of the next save with it. */
  describe('a name cleared back to empty', () => {
    const model = {
      domains: [
        { id: 'd1', name: 'Orders', level: 'container' },
        { id: 'd2', name: '', level: 'container' },
      ],
      systems: [],
      containers: [{ id: 'c1', name: 'Checkout API', domainId: 'd2' }],
      components: [],
      codeElements: [],
      viewLevel: 'container',
    } as unknown as FlatC4Model;

    it('is hidden from everything that only shows domains', () => {
      expect(getModelDomains(model).map((d) => d.id)).toEqual(['d1']);
    });

    it('survives the read the editor uses', () => {
      expect(getEditableDomains(model).map((d) => d.id)).toEqual(['d1', 'd2']);
    });

    it('keeps its members, which never depended on the name', () => {
      expect(listDomainMembers(model, 'd2').map((m) => m.id)).toEqual(['c1']);
    });
  });

  it('derives edges from cross-domain clones', () => {
    const model = {
      domains: [
        { id: 'dom-a', name: 'A', level: 'system' },
        { id: 'dom-b', name: 'B', level: 'system' },
      ],
      systems: [
        {
          id: 's1',
          name: 'Checkout',
          domainId: 'dom-a',
          connections: [{ targetId: 's2-clone' }],
        },
        {
          id: 's2',
          name: 'Billing',
          domainId: 'dom-b',
        },
        {
          id: 's2-clone',
          name: 'Billing',
          original: { id: 's2', type: 'system' },
        },
      ],
      containers: [],
      components: [],
      codeElements: [],
      viewLevel: 'system',
    } as unknown as FlatC4Model;

    expect(deriveDomainEdges(model)).toEqual([
      { fromDomainId: 'dom-a', toDomainId: 'dom-b' },
    ]);
  });

  it('derives edges from direct connections between originals in different domains', () => {
    const model = {
      domains: [
        { id: 'dom-a', name: 'A', level: 'system' },
        { id: 'dom-b', name: 'B', level: 'system' },
      ],
      systems: [
        {
          id: 's1',
          name: 'Checkout',
          domainId: 'dom-a',
          connections: [{ targetId: 's2' }],
        },
        {
          id: 's2',
          name: 'Billing',
          domainId: 'dom-b',
        },
      ],
      containers: [],
      components: [],
      codeElements: [],
      viewLevel: 'system',
    } as unknown as FlatC4Model;

    expect(deriveDomainEdges(model)).toEqual([
      { fromDomainId: 'dom-a', toDomainId: 'dom-b' },
    ]);
  });

  it('does not derive an edge across C4 levels', () => {
    const model = {
      domains: [
        { id: 'dom-a', name: 'A', level: 'system' },
        { id: 'dom-b', name: 'B', level: 'container' },
      ],
      systems: [{ id: 's1', name: 'Checkout', domainId: 'dom-a', connections: [{ targetId: 'c1' }] }],
      containers: [{ id: 'c1', name: 'API', domainId: 'dom-b' }],
      components: [],
      codeElements: [],
      viewLevel: 'system',
    } as unknown as FlatC4Model;

    expect(deriveDomainEdges(model)).toEqual([]);
  });

  it('clears membership when a domain is deleted', () => {
    const model = {
      domains: [{ id: 'dom-a', name: 'A', level: 'system' }],
      systems: [{ id: 's1', domainId: 'dom-a' }],
      containers: [{ id: 'c1', domainId: 'dom-a' }],
      components: [],
      codeElements: [],
      viewLevel: 'system',
    } as unknown as FlatC4Model;

    const next = withModelDomains(clearDomainMembership(model, 'dom-a'), []);
    expect(getModelDomains(next)).toEqual([]);
    expect((next.systems[0] as { domainId?: string }).domainId).toBeUndefined();
    expect((next.containers[0] as { domainId?: string }).domainId).toBeUndefined();
  });

  it('formats clone origin label with domain and hierarchy', () => {
    const model = {
      domains: [
        { id: 'dom-a', name: 'Orders', level: 'container' },
        { id: 'dom-b', name: 'Billing', level: 'container' },
      ],
      systems: [{ id: 'sys1', name: 'Shop' }],
      containers: [
        {
          id: 'api',
          name: 'Checkout API',
          systemId: 'sys1',
          domainId: 'dom-b',
        },
        {
          id: 'api-clone',
          name: 'Checkout API',
          original: {
            id: 'api',
            type: 'container',
            domainId: 'dom-b',
            domainName: 'Billing',
          },
        },
      ],
      components: [],
      codeElements: [],
      viewLevel: 'container',
      activeSystemId: 'sys1',
    } as unknown as FlatC4Model;

    expect(formatCloneHierarchyPath(model, { id: 'api', type: 'container' })).toBe(
      'Shop / Checkout API'
    );

    const label = resolveCloneOriginLabel(
      model.containers[1],
      model,
      'proj-a',
      null,
      null,
      null,
      (key, opts) => `${opts?.project ?? ''} ${opts?.domain ?? key}`
    );
    expect(label).toBe('Billing · Shop / Checkout API');
  });
});
