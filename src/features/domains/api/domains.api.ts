/** Community: domain map API types only — no remote client. */
export type DomainElement = {
  id: string;
  name: string;
  type?: string;
  technology?: string;
  level?: 'system' | 'container';
  projectId?: string;
  projectName?: string;
  domainId?: string;
  domainName?: string;
  systemId?: string;
  containerId?: string;
};

export type DomainMapElement = DomainElement & {
  parentId?: string | null;
};

export type DomainMapEdge = {
  source: string;
  target: string;
};

export type WorkspaceSearchElement = DomainElement;

export const domainsApi = {
  getDomainMap: async () => ({ domains: [] as DomainMapElement[], edges: [] as DomainMapEdge[] }),
  listDomainElements: async () => ({ elements: [] as DomainElement[], hasMore: false, total: 0 }),
  searchWorkspaceElements: async () => ({
    elements: [] as WorkspaceSearchElement[],
    hasMore: false,
    total: 0,
  }),
};
