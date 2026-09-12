import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import { getElementTags, normalizeTag } from '@/types/c4Extensions';

export type TagUsage = {
  tag: string;
  /** How many elements on the level currently being viewed carry it. */
  onLevel: number;
  /** How many carry it anywhere in the model — what deleting would touch. */
  total: number;
};

type Level = FlatC4Model['viewLevel'];

function listsOf(model: FlatC4Model) {
  return [
    { level: 'system' as Level, items: model.systems || [] },
    { level: 'container' as Level, items: model.containers || [] },
    { level: 'component' as Level, items: model.components || [] },
    { level: 'code' as Level, items: model.codeElements || [] },
  ];
}

/**
 * Every tag in the model, with how much of it sits on the level in view.
 *
 * Counted across the whole model rather than the level alone: a tag used
 * elsewhere is still a tag you can delete, and hiding it would make the
 * catalogue disagree with what deleting actually does.
 */
export function collectTagUsage(model: FlatC4Model): TagUsage[] {
  const total = new Map<string, number>();
  const onLevel = new Map<string, number>();

  for (const { level, items } of listsOf(model)) {
    for (const item of items) {
      for (const tag of getElementTags(item)) {
        total.set(tag, (total.get(tag) || 0) + 1);
        if (level === model.viewLevel) onLevel.set(tag, (onLevel.get(tag) || 0) + 1);
      }
    }
  }

  return [...total.entries()]
    .map(([tag, count]) => ({ tag, total: count, onLevel: onLevel.get(tag) || 0 }))
    .sort((a, b) => b.onLevel - a.onLevel || b.total - a.total || a.tag.localeCompare(b.tag));
}

/** Ids on the level in view that carry the tag — what highlighting lights up. */
export function elementIdsWithTag(model: FlatC4Model, tag: string): string[] {
  const wanted = normalizeTag(tag).toLowerCase();
  if (!wanted) return [];
  const list = listsOf(model).find((entry) => entry.level === model.viewLevel);
  return (list?.items || [])
    .filter((item) => getElementTags(item).some((t) => t.toLowerCase() === wanted))
    .map((item) => (item as { id: string }).id)
    .filter(Boolean);
}

/**
 * The model with a tag taken off every element that carried it.
 *
 * Model-wide on purpose: the catalogue is shared, so a tag deleted while
 * looking at containers must not survive on a component and reappear the
 * moment someone changes level.
 */
export function removeTagFromModel(model: FlatC4Model, tag: string): FlatC4Model {
  const wanted = normalizeTag(tag).toLowerCase();
  if (!wanted) return model;

  const strip = <T,>(items: T[]): T[] =>
    items.map((item) => {
      const tags = getElementTags(item);
      if (!tags.some((t) => t.toLowerCase() === wanted)) return item;
      const next = tags.filter((t) => t.toLowerCase() !== wanted);
      const copy = { ...(item as object) } as T & { tags?: string[] };
      if (next.length) copy.tags = next;
      else delete copy.tags;
      return copy;
    });

  return {
    ...model,
    systems: strip(model.systems || []),
    containers: strip(model.containers || []),
    components: strip(model.components || []),
    codeElements: strip(model.codeElements || []),
  };
}
