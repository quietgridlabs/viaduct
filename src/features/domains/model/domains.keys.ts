export type DomainElementsParams = {
  level?: 'system' | 'container';
  q: string;
  limit: number;
  offset: number;
};

export type WorkspaceSearchParams = {
  projectId: string;
  q: string;
  limit: number;
  offset: number;
};

/** Global domain map and cross-workspace search — not scoped under a project id. */
export const domainKeys = {
  all: ['domains'] as const,
  map: () => ['domains', 'map'] as const,
  elements: (params: DomainElementsParams) => ['domains', 'elements', params] as const,
  workspaceSearch: (params: WorkspaceSearchParams) =>
    ['domains', 'workspace-search', params] as const,
};
