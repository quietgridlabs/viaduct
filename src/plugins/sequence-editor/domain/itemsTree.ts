import type { FragmentItem, MessageItem, SequenceItem } from './sequence-model';
import { createId } from './sequence-model';

export function isExpandFragment(item: SequenceItem): item is FragmentItem {
  return item.type === 'fragment' && item.kind === 'group';
}

/** Fragments that render as collapsible frames on the canvas. */
export function isCollapsibleFragment(item: SequenceItem): item is FragmentItem {
  return (
    item.type === 'fragment' &&
    (item.kind === 'group' ||
      item.kind === 'alt' ||
      item.kind === 'opt' ||
      item.kind === 'loop')
  );
}

export function collectMessages(items: SequenceItem[]): MessageItem[] {
  const out: MessageItem[] = [];
  for (const item of items) {
    if (item.type === 'message') out.push(item);
    else if (item.type === 'fragment') {
      for (const branch of item.branches) {
        out.push(...collectMessages(branch.items));
      }
    }
  }
  return out;
}

export function findItemDeep(
  items: SequenceItem[],
  id: string
): SequenceItem | null {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.type === 'fragment') {
      for (const branch of item.branches) {
        const hit = findItemDeep(branch.items, id);
        if (hit) return hit;
      }
    }
  }
  return null;
}

export function mapItemsDeep(
  items: SequenceItem[],
  mapFn: (item: SequenceItem) => SequenceItem | null
): SequenceItem[] {
  const out: SequenceItem[] = [];
  for (const item of items) {
    if (item.type === 'fragment') {
      const mappedBranches = item.branches.map((b) => ({
        ...b,
        items: mapItemsDeep(b.items, mapFn),
      }));
      const next: FragmentItem = { ...item, branches: mappedBranches };
      const mapped = mapFn(next);
      if (mapped) out.push(mapped);
    } else {
      const mapped = mapFn(item);
      if (mapped) out.push(mapped);
    }
  }
  return out;
}

export function updateItemDeep(
  items: SequenceItem[],
  id: string,
  patch: Partial<SequenceItem>
): SequenceItem[] {
  return items.map((item) => {
    if (item.id === id) {
      return { ...item, ...patch, id: item.id, type: item.type } as SequenceItem;
    }
    if (item.type === 'fragment') {
      return {
        ...item,
        branches: item.branches.map((b) => ({
          ...b,
          items: updateItemDeep(b.items, id, patch),
        })),
      };
    }
    return item;
  });
}

export function removeItemDeep(items: SequenceItem[], id: string): SequenceItem[] {
  const out: SequenceItem[] = [];
  for (const item of items) {
    if (item.id === id) continue;
    if (item.type === 'fragment') {
      out.push({
        ...item,
        branches: item.branches.map((b) => ({
          ...b,
          items: removeItemDeep(b.items, id),
        })),
      });
    } else {
      out.push(item);
    }
  }
  return out;
}

/** Wrap consecutive top-level message items in an expand/group fragment. */
export function wrapMessagesInExpand(
  items: SequenceItem[],
  messageIds: string[],
  label: string
): SequenceItem[] {
  if (!messageIds.length) return items;
  const idSet = new Set(messageIds);
  const indices: number[] = [];
  items.forEach((it, i) => {
    if (it.type === 'message' && idSet.has(it.id)) indices.push(i);
  });
  if (indices.length !== messageIds.length) return items;

  const start = Math.min(...indices);
  const end = Math.max(...indices);
  if (end - start + 1 !== indices.length) return items;

  for (let i = start; i <= end; i++) {
    if (items[i]?.type !== 'message') return items;
  }

  const slice = items.slice(start, end + 1) as MessageItem[];
  const fragment: FragmentItem = {
    id: createId('expand'),
    type: 'fragment',
    kind: 'group',
    label: label.trim() || 'Expand',
    branches: [{ id: createId('br'), items: slice }],
  };

  return [...items.slice(0, start), fragment, ...items.slice(end + 1)];
}

export function unwrapExpand(items: SequenceItem[], fragmentId: string): SequenceItem[] {
  const out: SequenceItem[] = [];
  for (const item of items) {
    if (item.id === fragmentId && isExpandFragment(item)) {
      out.push(...(item.branches[0]?.items ?? []));
    } else {
      out.push(item);
    }
  }
  return out;
}
