import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import type { ProjectSnapshot } from '@features/versions';
import { useCallback, useEffect, useState } from 'react';

type Options = {
  projectMode: boolean;
  projectId: string | undefined;
  versionId: string | undefined;
  user: { id: string } | null | undefined;
  authLoading: boolean;
  viewingVersion: boolean;
  model: FlatC4Model;
  setModel: (model: FlatC4Model) => void;
  setNotificationError: (key: string) => void;
};

/**
 * Community edition: always local. No projects/versions API, no cloud hydrate.
 */
export function useEditorProject(_options: Options) {
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);

  useEffect(() => {
    setHasInitiallyLoaded(true);
  }, []);

  const handleManualSave = useCallback(async () => {
    /* Local persistence is via zustand persist middleware. */
  }, []);

  const handleRenameProject = useCallback(async (_name: string) => {
    /* No cloud project to rename. */
  }, []);

  return {
    projectName: null as string | null,
    versionMeta: null as ProjectSnapshot | null,
    isHydrating: false,
    hasInitiallyLoaded,
    saveConflict: false,
    setSaveConflict: (_v: boolean) => {},
    access: null as null,
    project: undefined as undefined,
    signInRequired: false,
    projectStale: false,
    snapshotStale: false,
    loadError: null as string | null,
    projectInitialLoading: false,
    projectRestoring: false,
    trunkProtected: false,
    collabEnabled: false,
    versionNamePattern: null as string | null,
    handleManualSave,
    handleRenameProject,
    canWrite: true,
    viewOnly: false,
  };
}
