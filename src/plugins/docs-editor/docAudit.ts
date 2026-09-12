import type { ProjectDocumentation } from '@shared/api';
import type { AuditExtras, InlineDocumentation, PersonRef } from '@/types/c4Extensions';

export function personFromDocApi(doc: ProjectDocumentation | null | undefined): AuditExtras {
  if (!doc) return {};
  const createdUsername = doc.created_by_username?.trim() || null;
  const updatedUsername = doc.updated_by_username?.trim() || createdUsername;
  const createdBy = createdUsername
    ? {
        name: (doc.created_by_name && doc.created_by_name.trim()) || createdUsername,
        username: createdUsername,
      }
    : undefined;
  const updatedBy = updatedUsername
    ? {
        name:
          (doc.updated_by_name && doc.updated_by_name.trim()) ||
          (doc.created_by_name && doc.created_by_name.trim()) ||
          updatedUsername,
        username: updatedUsername,
      }
    : createdBy;
  return {
    createdBy,
    updatedBy,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}

export function auditFromInline(doc: InlineDocumentation | null | undefined): AuditExtras {
  if (!doc) return {};
  return {
    createdBy: doc.createdBy,
    updatedBy: doc.updatedBy,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function mergeInlineAudit(
  prev: InlineDocumentation | null | undefined,
  next: Pick<InlineDocumentation, 'id' | 'title' | 'markdown'>,
  author: PersonRef | null
): InlineDocumentation {
  const now = new Date().toISOString();
  const contentChanged =
    !prev || prev.title !== next.title || prev.markdown !== next.markdown;
  return {
    ...next,
    createdAt: prev?.createdAt || now,
    updatedAt: contentChanged ? now : prev?.updatedAt || now,
    createdBy: prev?.createdBy || author || undefined,
    updatedBy: contentChanged ? author || prev?.updatedBy : prev?.updatedBy || author || undefined,
  };
}
