import { useQuery, type QueryClient } from '@tanstack/react-query';
import type {
  DomainElement,
  DomainMapEdge,
  DomainMapElement,
  WorkspaceSearchElement,
} from '../api/domains.api';
import { domainKeys, type DomainElementsParams, type WorkspaceSearchParams } from './domains.keys';

const EMPTY_MAP: { domains: DomainMapElement[]; edges: DomainMapEdge[] } = {
  domains: [],
  edges: [],
};
const EMPTY_ELEMENTS: { elements: DomainElement[]; hasMore: boolean; total: number } = {
  elements: [],
  hasMore: false,
  total: 0,
};

/** Community: no cross-project domain map API. */
export function useDomainMapQuery(enabled = true) {
  return useQuery({
    queryKey: domainKeys.map(),
    queryFn: async () => EMPTY_MAP,
    enabled,
    staleTime: Infinity,
  });
}

export function useDomainMap(enabled = true) {
  const query = useDomainMapQuery(enabled);
  return {
    domains: query.data?.domains ?? EMPTY_MAP.domains,
    edges: query.data?.edges ?? EMPTY_MAP.edges,
    loading: false,
    error: null as Error | null,
    refetch: query.refetch,
  };
}

export async function fetchDomainElements(
  _client: QueryClient,
  _params: DomainElementsParams
): Promise<{ elements: DomainElement[]; hasMore: boolean; total: number }> {
  return EMPTY_ELEMENTS;
}

export async function fetchWorkspaceSearch(
  _client: QueryClient,
  _params: WorkspaceSearchParams
): Promise<{ elements: WorkspaceSearchElement[]; hasMore: boolean; total: number }> {
  return EMPTY_ELEMENTS;
}
