import type { FlowSequenceOption } from '@plugins/data-flows/attachments';

export const SEQUENCE_LIST_PAGE_SIZE = 40;
export const SEQUENCE_LIST_DRAFT_ID = '__draft__';

export type SequenceListSortKey = 'updated' | 'created' | 'name-asc' | 'name-desc';

export const SEQUENCE_LIST_SORT_KEYS: SequenceListSortKey[] = [
  'updated',
  'created',
  'name-asc',
  'name-desc',
];

export type SequenceListItem = FlowSequenceOption & {
  /** Unsaved editor draft not yet attached to an owner. */
  isDraft?: boolean;
};

export function parseSequenceListSortKey(
  raw: string | null | undefined
): SequenceListSortKey {
  return SEQUENCE_LIST_SORT_KEYS.includes(raw as SequenceListSortKey)
    ? (raw as SequenceListSortKey)
    : 'updated';
}

function compareLocale(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
}

export function filterSequenceList(
  items: SequenceListItem[],
  query: string
): SequenceListItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    if (item.name.toLowerCase().includes(q)) return true;
    if (item.ownerName.toLowerCase().includes(q)) return true;
    if (item.label.toLowerCase().includes(q)) return true;
    return false;
  });
}

export function sortSequenceList(
  items: SequenceListItem[],
  sort: SequenceListSortKey
): SequenceListItem[] {
  const next = items.slice();
  next.sort((a, b) => {
    if (a.isDraft && !b.isDraft) return -1;
    if (!a.isDraft && b.isDraft) return 1;
    switch (sort) {
      case 'name-asc':
        return compareLocale(a.name, b.name) || compareLocale(a.id, b.id);
      case 'name-desc':
        return compareLocale(b.name, a.name) || compareLocale(a.id, b.id);
      case 'created':
        return (
          (b.createdAt || '').localeCompare(a.createdAt || '') ||
          compareLocale(a.id, b.id)
        );
      case 'updated':
      default:
        return (
          (b.updatedAt || '').localeCompare(a.updatedAt || '') ||
          compareLocale(a.id, b.id)
        );
    }
  });
  return next;
}
