import type { DocumentationExtras, InlineDocumentation } from '@/types/c4Extensions';

/** Normalize legacy single-doc fields + array into one list. */
export function listEntityDocumentations(
  entity: DocumentationExtras | null | undefined
): InlineDocumentation[] {
  if (!entity) return [];
  const fromArray = entity.documentations?.filter(Boolean) ?? [];
  if (fromArray.length) {
    // Prefer array; keep legacy entry if missing from array.
    const ids = new Set(fromArray.map((d) => d.id));
    if (entity.documentation?.id && !ids.has(entity.documentation.id)) {
      return [...fromArray, entity.documentation];
    }
    return fromArray;
  }
  if (entity.documentation) return [entity.documentation];
  return [];
}

export function documentationCount(entity: DocumentationExtras | null | undefined): number {
  return listEntityDocumentations(entity).length;
}

export function findEntityDocumentation(
  entity: DocumentationExtras | null | undefined,
  docId: string
): InlineDocumentation | null {
  return listEntityDocumentations(entity).find((d) => d.id === docId) ?? null;
}

export function upsertEntityDocumentation(
  entity: DocumentationExtras | null | undefined,
  doc: InlineDocumentation
): DocumentationExtras {
  const list = listEntityDocumentations(entity);
  const idx = list.findIndex((d) => d.id === doc.id);
  const next = idx >= 0 ? list.map((d, i) => (i === idx ? doc : d)) : [...list, doc];
  return {
    documentations: next,
    // Legacy mirrors for older readers / badges mid-migration.
    documentationId: next[0]?.id,
    documentation: next[0],
  };
}

export function removeEntityDocumentation(
  entity: DocumentationExtras | null | undefined,
  docId: string
): DocumentationExtras {
  const next = listEntityDocumentations(entity).filter((d) => d.id !== docId);
  return {
    documentations: next,
    documentationId: next[0]?.id,
    documentation: next[0],
  };
}

export function clearEntityDocumentation(): DocumentationExtras {
  return {
    documentations: [],
    documentationId: undefined,
    documentation: undefined,
  };
}

/** Replace entity docs list (e.g. hydrate from API). */
export function setEntityDocumentations(
  docs: InlineDocumentation[]
): DocumentationExtras {
  const next = docs.filter(Boolean);
  return {
    documentations: next,
    documentationId: next[0]?.id,
    documentation: next[0],
  };
}
