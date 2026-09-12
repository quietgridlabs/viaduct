import { describe, expect, it } from 'vitest';
import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import { listInlineDocumentation, resolveDocsEntity } from '../localDocs';

const doc = {
  id: 'doc1',
  title: 'Overview',
  markdown: '# Hi',
};

describe('resolveDocsEntity', () => {
  it('follows a local clone pointer to the original', () => {
    const model = {
      systems: [],
      containers: [
        {
          id: 'api',
          name: 'API',
          documentations: [doc],
        },
        {
          id: 'clone',
          name: 'API',
          original: { id: 'api', type: 'container' },
          documentations: [doc],
        },
      ],
      components: [],
      codeElements: [],
    } as unknown as FlatC4Model;

    const resolved = resolveDocsEntity(model, 'container', 'clone');
    expect(resolved?.entity.id).toBe('api');
    expect(listInlineDocumentation(model, 'container', 'clone')).toEqual([
      expect.objectContaining({ id: 'doc1', ownerId: 'api' }),
    ]);
  });

  it('finds a system when a container card opens docs with the system id', () => {
    const model = {
      systems: [
        {
          id: 'sys',
          name: 'Billing',
          documentations: [doc],
        },
      ],
      containers: [
        {
          id: 'sys-clone',
          name: 'Billing',
          systemId: 'other',
          original: { id: 'sys', type: 'system' },
        },
      ],
      components: [],
      codeElements: [],
    } as unknown as FlatC4Model;

    /* Badge used to pass ownerType=container with ownerId=sys. */
    expect(resolveDocsEntity(model, 'container', 'sys')?.ownerType).toBe('system');
    expect(listInlineDocumentation(model, 'container', 'sys')).toEqual([
      expect.objectContaining({ id: 'doc1', ownerId: 'sys', ownerType: 'system' }),
    ]);
  });
});
