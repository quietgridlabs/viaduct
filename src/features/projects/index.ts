import { useQuery } from '@tanstack/react-query';

export type ProjectAccess = 'owner' | 'editor' | 'viewer' | null;

export function isProjectNetworkError(_err: unknown): boolean {
  return false;
}

export function useProjectsQuery(_enabled = false) {
  return useQuery({
    queryKey: ['projects', 'community'],
    queryFn: async () =>
      [] as {
        id: string;
        name: string;
        mine?: boolean;
        access?: string;
      }[],
    enabled: false,
  });
}

export function useProjectQuery(_projectId?: string, _enabled = false) {
  return useQuery({
    queryKey: ['project', 'community', _projectId],
    queryFn: async () => null,
    enabled: false,
  });
}

export function useCatalogProject(options?: {
  enabled?: boolean;
  projectId?: string | null;
  projectMode?: boolean;
  embedded?: boolean;
  user?: unknown;
  authLoading?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setModel?: (m: any) => void;
  [key: string]: unknown;
}) {
  return {
    projectId: options?.projectId ?? null,
    projectName: null as string | null,
    loading: false,
    loadError: null as string | null,
    error: null as string | null,
    access: 'owner' as ProjectAccess | 'owner' | 'edit' | 'view',
    signInRequired: false,
    isLocal: true,
    canWrite: true,
    handleRenameProject: async (_name: string) => {},
    model: null,
    setModel: options?.setModel ?? ((_m: unknown) => {}),
  };
}

export function useCreateProject() {
  return {
    mutateAsync: async (_input: { name: string }) => ({ id: 'local', name: _input.name }),
    isPending: false,
  };
}

export function useSaveProjectModel() {
  return { mutateAsync: async () => ({}), isPending: false };
}

export function useUpdateProject() {
  return { mutateAsync: async () => ({}), isPending: false };
}

export async function fetchProject(_queryClient: unknown, _projectId: string) {
  return null;
}
