import { useQuery, type QueryClient } from '@tanstack/react-query';
import { docsApi } from '../api/docs.api';
import { docsKeys, type DocOwnerFilter } from './docs.keys';
import type { ProjectDocumentation } from '../api/docs.api';

const EMPTY_DOCS: ProjectDocumentation[] = [];

/**
 * Opening the editor or hydrating badges is "show me docs now" — lists are
 * never treated as fresh. Cached rows still render immediately.
 */
export function useProjectDocsQuery(
  projectId: string | undefined,
  owner?: DocOwnerFilter,
  enabled = true
) {
  return useQuery({
    queryKey: docsKeys.list(projectId ?? '', owner),
    queryFn: () =>
      docsApi
        .listProjectDocs(projectId!, owner?.ownerType, owner?.ownerId)
        .then((r) => r.docs),
    enabled: Boolean(projectId) && enabled,
    staleTime: 0,
  });
}

export async function fetchProjectDocs(
  client: QueryClient,
  projectId: string,
  owner?: DocOwnerFilter
): Promise<ProjectDocumentation[]> {
  return client.fetchQuery({
    queryKey: docsKeys.list(projectId, owner),
    queryFn: () =>
      docsApi.listProjectDocs(projectId, owner?.ownerType, owner?.ownerId).then((r) => r.docs),
    staleTime: 0,
  });
}

/** Convenience for screens that only need the array and a first-load spinner. */
export function useProjectDocs(projectId: string | undefined, owner?: DocOwnerFilter, enabled = true) {
  const query = useProjectDocsQuery(projectId, owner, enabled);
  return {
    docs: query.data ?? EMPTY_DOCS,
    loading: query.isPending,
    refetching: query.isFetching && !query.isPending,
    error: query.error,
    refetch: query.refetch,
  };
}
