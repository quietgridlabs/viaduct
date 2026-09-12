import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import type { CloneOriginalRef, DocumentationExtras, InlineDocumentation } from '@/types/c4Extensions';
import { getCachedRemoteOriginal } from '@utils/cloneSource';
import { findEntityDocumentation, listEntityDocumentations } from './entityDocs';

type OwnerType = 'system' | 'container' | 'component' | 'code';

type EntityWithDocs = DocumentationExtras & {
  id: string;
  name?: string;
  original?: CloneOriginalRef;
};

const OWNER_TYPES: OwnerType[] = ['system', 'container', 'component', 'code'];

function isOwnerType(value: string | undefined): value is OwnerType {
  return value === 'system' || value === 'container' || value === 'component' || value === 'code';
}

function entityList(model: FlatC4Model, ownerType: OwnerType): EntityWithDocs[] {
  if (ownerType === 'system') return model.systems as EntityWithDocs[];
  if (ownerType === 'container') return model.containers as EntityWithDocs[];
  if (ownerType === 'component') return model.components as EntityWithDocs[];
  return model.codeElements as EntityWithDocs[];
}

function findInCollection(
  model: FlatC4Model,
  ownerType: OwnerType,
  ownerId: string
): EntityWithDocs | null {
  return entityList(model, ownerType).find((e) => e.id === ownerId) ?? null;
}

/**
 * The block that actually owns the documentation pages.
 *
 * Clone cards project the original's fields onto the canvas (badge count), but
 * the pages live on the original — or, for a remote clone, in the remote cache.
 * A system projected as a container card may also arrive with the wrong
 * ownerType; search every collection before giving up.
 */
export function resolveDocsEntity(
  model: FlatC4Model,
  ownerType: OwnerType,
  ownerId: string
): { ownerType: OwnerType; entity: EntityWithDocs } | null {
  if (!ownerId) return null;

  let type = ownerType;
  let entity = findInCollection(model, type, ownerId);
  if (!entity) {
    for (const candidate of OWNER_TYPES) {
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
    const remoteType = isOwnerType(ref.type) ? ref.type : type;
    return {
      ownerType: remoteType,
      entity: { ...(remote as EntityWithDocs), id: ref.id },
    };
  }

  const originalType = isOwnerType(ref.type) ? ref.type : type;
  return (
    resolveDocsEntity(model, originalType, ref.id) ?? {
      ownerType: type,
      entity,
    }
  );
}

export function getEntityDocsExtras(
  model: FlatC4Model,
  ownerType: OwnerType,
  ownerId: string
): DocumentationExtras | null {
  return resolveDocsEntity(model, ownerType, ownerId)?.entity ?? null;
}

/** @deprecated Prefer getInlineDocumentationById / list — kept for single-doc callers. */
export function getInlineDocumentation(
  model: FlatC4Model,
  ownerType: OwnerType,
  ownerId: string
): InlineDocumentation | null {
  const entity = getEntityDocsExtras(model, ownerType, ownerId);
  return listEntityDocumentations(entity)[0] ?? null;
}

export function getInlineDocumentationById(
  model: FlatC4Model,
  ownerType: OwnerType,
  ownerId: string,
  docId: string
): InlineDocumentation | null {
  return findEntityDocumentation(getEntityDocsExtras(model, ownerType, ownerId), docId);
}

export function listInlineDocumentation(
  model: FlatC4Model,
  ownerType?: OwnerType,
  ownerId?: string
): Array<InlineDocumentation & { ownerType: OwnerType; ownerId: string; ownerName: string }> {
  const out: Array<
    InlineDocumentation & { ownerType: OwnerType; ownerId: string; ownerName: string }
  > = [];
  /* One row per document, not per card it appears on. */
  const seen = new Set<string>();

  if (ownerType && ownerId) {
    const resolved = resolveDocsEntity(model, ownerType, ownerId);
    if (!resolved) return out;
    for (const doc of listEntityDocumentations(resolved.entity)) {
      if (seen.has(doc.id)) continue;
      seen.add(doc.id);
      out.push({
        ...doc,
        ownerType: resolved.ownerType,
        ownerId: resolved.entity.id,
        ownerName: resolved.entity.name || resolved.entity.id,
      });
    }
    return out;
  }

  const push = (type: OwnerType, entities: EntityWithDocs[]) => {
    for (const e of entities) {
      /* A clone card is a copy of another block, its documentation included —
         the page lives on the original, so listing the whole project would
         otherwise show it once per clone. */
      if ((e as { original?: unknown }).original) continue;
      for (const doc of listEntityDocumentations(e)) {
        if (seen.has(doc.id)) continue;
        seen.add(doc.id);
        out.push({
          ...doc,
          ownerType: type,
          ownerId: e.id,
          ownerName: e.name || e.id,
        });
      }
    }
  };
  push('system', model.systems as EntityWithDocs[]);
  push('container', model.containers as EntityWithDocs[]);
  push('component', model.components as EntityWithDocs[]);
  push('code', model.codeElements as EntityWithDocs[]);
  return out;
}

export function newLocalDocId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `doc_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  }
  return `doc_${Math.random().toString(36).slice(2, 14)}`;
}
