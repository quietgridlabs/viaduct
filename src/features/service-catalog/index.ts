/**
 * Community: catalog / flows run against the in-browser flat store.
 * Cloud project hydrate is a no-op — `ServiceCatalogPage` / `DataFlowsPage`
 * already read the model from `useFlatC4Store`.
 */
export function useCatalogProject(_options?: {
  enabled?: boolean;
  projectId?: string | null;
  projectMode?: boolean;
  embedded?: boolean;
  user?: unknown;
  authLoading?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setModel?: (m: any) => void;
  requireAuth?: boolean;
  [key: string]: unknown;
}) {
  return {
    projectName: null as string | null,
    loading: false,
    loadError: null as string | null,
    access: 'owner' as 'owner' | 'edit' | 'view',
    canWrite: true,
    handleRenameProject: async (_name: string) => {},
    projectStale: false,
    refetch: async () => undefined,
  };
}
