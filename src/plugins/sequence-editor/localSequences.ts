import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import type { CloneOriginalRef, SequenceDiagramExtras, StoredSequenceDiagram } from '@/types/c4Extensions';
import { getCachedRemoteOriginal } from '@utils/cloneSource';

type SeqOwnerType = 'container' | 'component';

type EntityWithDiagrams = SequenceDiagramExtras & {
  id: string;
  name?: string;
  original?: CloneOriginalRef;
};

const SEQ_OWNER_TYPES: SeqOwnerType[] = ['container', 'component'];

function isSeqOwnerType(value: string | undefined): value is SeqOwnerType {
  return value === 'container' || value === 'component';
}

function entityList(model: FlatC4Model, ownerType: SeqOwnerType): EntityWithDiagrams[] {
  if (ownerType === 'container') return model.containers as EntityWithDiagrams[];
  return model.components as EntityWithDiagrams[];
}

function findInCollection(
  model: FlatC4Model,
  ownerType: SeqOwnerType,
  ownerId: string
): EntityWithDiagrams | null {
  return entityList(model, ownerType).find((e) => e.id === ownerId) ?? null;
}

/**
 * The block that actually owns the sequence diagrams.
 *
 * Clone cards are views of another block — the diagrams live on the original,
 * or in the remote cache when the original is in another project.
 */
export function resolveSequencesEntity(
  model: FlatC4Model,
  ownerType: SeqOwnerType,
  ownerId: string
): { ownerType: SeqOwnerType; entity: EntityWithDiagrams } | null {
  if (!ownerId) return null;

  let type = ownerType;
  let entity = findInCollection(model, type, ownerId);
  if (!entity) {
    for (const candidate of SEQ_OWNER_TYPES) {
      if (candidate === ownerType) continue;
      const found = findInCollection(model, candidate, ownerId);
      if (found) {
        type = candidate;
        entity = found;
        break;
      }
    }
  }

  if (!entity) return null;

  const ref = entity.original;
  if (!ref?.id) return { ownerType: type, entity };

  if (ref.projectId) {
    const remote = getCachedRemoteOriginal(ref.projectId, ref.id);
    if (!remote) return { ownerType: type, entity };
    const remoteType = isSeqOwnerType(ref.type) ? ref.type : type;
    return {
      ownerType: remoteType,
      entity: { ...(remote as EntityWithDiagrams), id: ref.id },
    };
  }

  const originalType = isSeqOwnerType(ref.type) ? ref.type : type;
  return (
    resolveSequencesEntity(model, originalType, ref.id) ?? {
      ownerType: type,
      entity,
    }
  );
}

export function listEntitySequences(
  model: FlatC4Model,
  ownerType: SeqOwnerType,
  ownerId: string
): StoredSequenceDiagram[] {
  return resolveSequencesEntity(model, ownerType, ownerId)?.entity.sequenceDiagrams ?? [];
}
