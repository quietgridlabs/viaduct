import type { BaseBlock } from '@archivisio/c4-modelizer-sdk';
import { useClonePath, useFlatC4Store } from '@archivisio/c4-modelizer-sdk';
import {
  cloneOriginalRef,
  resolveCloneOriginLabel,
} from '@utils/domains';
import {
  getCachedRemoteOriginal,
  getCachedRemoteOriginalMeta,
  getRemoteOriginalCacheVersion,
  subscribeRemoteOriginalCache,
} from '@utils/cloneSource';
import { useMemo, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

/** Path text under a clone card — domain origin and/or hierarchy (system / container). */
export function useCloneOriginLabel(item: BaseBlock): string | null {
  const { t } = useTranslation();
  const { projectId: currentProjectId } = useParams();
  const model = useFlatC4Store((s) => s.model);
  const clonePath = useClonePath(item);
  const original = cloneOriginalRef(item);

  const remoteCacheVersion = useSyncExternalStore(
    subscribeRemoteOriginalCache,
    getRemoteOriginalCacheVersion,
    () => 0
  );

  return useMemo(() => {
    /* Bust when a remote original finishes loading into the cache. */
    void remoteCacheVersion;
    if (!original?.id) return clonePath;
    const remoteElement =
      original.projectId && original.projectId !== currentProjectId
        ? getCachedRemoteOriginal(original.projectId, original.id) ?? null
        : null;
    const remoteMeta =
      original.projectId && original.projectId !== currentProjectId
        ? getCachedRemoteOriginalMeta(original.projectId, original.id)
        : null;

    return resolveCloneOriginLabel(
      item,
      model,
      currentProjectId,
      clonePath,
      remoteElement,
      remoteMeta,
      t
    );
  }, [item, model, currentProjectId, clonePath, original, remoteCacheVersion, t]);
}
