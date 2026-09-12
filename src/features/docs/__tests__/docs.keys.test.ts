/**
 * Docs and threads share the `['projects', id, …]` root. Prefix invalidation
 * must refresh docs without dropping open thread caches.
 */
import { QueryClient } from '@tanstack/react-query';
import { docsKeys } from '../model/docs.keys';
import { invalidateProjectDocs } from '../model/docs.mutations';

const projectId = 'p1';
const threadList = ['projects', projectId, 'threads'] as const;
const threadComments = ['projects', projectId, 'threads', 't1', 'comments'] as const;
const allDocs = docsKeys.list(projectId);
const ownerDocs = docsKeys.list(projectId, { ownerType: 'system', ownerId: 's1' });

function seed(client: QueryClient) {
  client.setQueryData(threadList, [{ id: 't1' }]);
  client.setQueryData(threadComments, [{ id: 'c1' }]);
  client.setQueryData(allDocs, [{ id: 'd1', project_id: projectId }]);
  client.setQueryData(ownerDocs, [{ id: 'd1', project_id: projectId }]);
}

describe('docsKeys vs thread caches', () => {
  it('invalidateProjectDocs refreshes docs lists but not threads', async () => {
    const client = new QueryClient();
    seed(client);

    await invalidateProjectDocs(client, projectId);

    expect(client.getQueryState(allDocs)?.isInvalidated).toBe(true);
    expect(client.getQueryState(ownerDocs)?.isInvalidated).toBe(true);
    expect(client.getQueryState(threadList)?.isInvalidated).toBe(false);
    expect(client.getQueryState(threadComments)?.isInvalidated).toBe(false);
  });
});
