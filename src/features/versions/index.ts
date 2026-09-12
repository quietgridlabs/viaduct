import { useQuery } from '@tanstack/react-query';

export type ProjectSnapshot = {
  id: string;
  name?: string;
  pinned?: number;
  created_at?: string;
  created_by_name?: string;
  created_by_username?: string;
};

export function useSnapshotsQuery(_projectId?: string, _enabled = false) {
  return useQuery({
    queryKey: ['snapshots', 'community', _projectId],
    queryFn: async () => ({ snapshots: [] as ProjectSnapshot[] }),
    enabled: false,
  });
}

export function useSnapshotDetailQuery(
  _projectId?: string,
  _versionId?: string,
  _enabled = false
) {
  return useQuery({
    queryKey: ['snapshot', 'community', _projectId, _versionId],
    queryFn: async () => null as ProjectSnapshot | null,
    enabled: false,
  });
}
