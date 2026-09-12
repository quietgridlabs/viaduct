import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import type { ProjectDocumentation } from '@shared/api';
import type { DocumentationExtras, InlineDocumentation } from '@/types/c4Extensions';
import { setEntityDocumentations } from './entityDocs';

type OwnerType = 'system' | 'container' | 'component' | 'code';

function toInline(doc: ProjectDocumentation): InlineDocumentation {
  return {
    id: doc.id,
    title: doc.title,
    markdown: doc.markdown,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
    createdBy: doc.created_by_username
      ? {
          name: doc.created_by_name || doc.created_by_username,
          username: doc.created_by_username,
        }
      : undefined,
    updatedBy: doc.updated_by_username
      ? {
          name: doc.updated_by_name || doc.updated_by_username,
          username: doc.updated_by_username,
        }
      : undefined,
  };
}

/**
 * Merge server docs onto entities so badges / export see the full list.
 * Existing inline docs for owners without API rows are preserved.
 */
export function hydrateModelDocumentations(
  model: FlatC4Model,
  docs: ProjectDocumentation[]
): FlatC4Model {
  if (!docs.length) return model;

  const grouped = new Map<string, InlineDocumentation[]>();
  for (const doc of docs) {
    const key = `${doc.owner_type}:${doc.owner_id}`;
    const list = grouped.get(key) ?? [];
    list.push(toInline(doc));
    grouped.set(key, list);
  }

  const apply = <T extends { id: string } & DocumentationExtras>(
    entities: T[],
    ownerType: OwnerType
  ): T[] =>
    entities.map((e) => {
      const list = grouped.get(`${ownerType}:${e.id}`);
      if (!list?.length) return e;
      return { ...e, ...setEntityDocumentations(list) };
    });

  return {
    ...model,
    systems: apply(
      model.systems as Array<(typeof model.systems)[number] & DocumentationExtras>,
      'system'
    ),
    containers: apply(
      model.containers as Array<(typeof model.containers)[number] & DocumentationExtras>,
      'container'
    ),
    components: apply(
      model.components as Array<(typeof model.components)[number] & DocumentationExtras>,
      'component'
    ),
    codeElements: apply(
      model.codeElements as Array<(typeof model.codeElements)[number] & DocumentationExtras>,
      'code'
    ),
  };
}
