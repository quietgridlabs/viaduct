import type { InlineDocumentation } from '@/types/c4Extensions';

export type DocListSortKey = 'updated' | 'created' | 'name-asc' | 'name-desc';

export const DOC_LIST_SORT_KEYS: DocListSortKey[] = [
  'updated',
  'created',
  'name-asc',
  'name-desc',
];

export type DocOwnerType = 'system' | 'container' | 'component' | 'code';

export type DocListItem = InlineDocumentation & {
  ownerType: DocOwnerType;
  ownerId: string;
  ownerName: string;
  /** Open in the editor but not saved yet — pinned to the top of the list. */
  isDraft?: boolean;
};

/** The id the unsaved draft answers to while it has no real one. */
export const DOC_LIST_DRAFT_ID = '__doc_draft__';

export function parseDocListSortKey(raw: string | null | undefined): DocListSortKey {
  return DOC_LIST_SORT_KEYS.includes(raw as DocListSortKey)
    ? (raw as DocListSortKey)
    : 'updated';
}

function compareLocale(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
}

export function filterDocList(items: DocListItem[], query: string): DocListItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    if ((item.title || '').toLowerCase().includes(q)) return true;
    if ((item.ownerName || '').toLowerCase().includes(q)) return true;
    /* The body counts too: people look for a doc by a phrase inside it. */
    if ((item.markdown || '').toLowerCase().includes(q)) return true;
    return false;
  });
}

export function sortDocList(items: DocListItem[], sort: DocListSortKey): DocListItem[] {
  const next = items.slice();
  next.sort((a, b) => {
    if (a.isDraft && !b.isDraft) return -1;
    if (!a.isDraft && b.isDraft) return 1;
    switch (sort) {
      case 'name-asc':
        return compareLocale(a.title || '', b.title || '') || compareLocale(a.id, b.id);
      case 'name-desc':
        return compareLocale(b.title || '', a.title || '') || compareLocale(a.id, b.id);
      case 'created':
        return (
          (b.createdAt || '').localeCompare(a.createdAt || '') || compareLocale(a.id, b.id)
        );
      case 'updated':
      default:
        return (
          (b.updatedAt || '').localeCompare(a.updatedAt || '') || compareLocale(a.id, b.id)
        );
    }
  });
  return next;
}
