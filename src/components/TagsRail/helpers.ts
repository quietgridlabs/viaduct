import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import { collectTagUsage, type TagUsage } from '@utils/tagCatalog';
import { FLOATING_LAYER_SELECTOR } from './constants';

/**
 * A tag that nothing wears yet still belongs in the list — it is the whole
 * reason for naming one ahead of time — so it joins with the zero counts it
 * honestly has.
 */
export function mergeDeclaredUsage(model: FlatC4Model, declared: string[]): TagUsage[] {
  const fromModel = collectTagUsage(model);
  const seen = new Set(fromModel.map((entry) => entry.tag.toLowerCase()));
  const pending = declared
    .filter((tag) => !seen.has(tag.toLowerCase()))
    .map((tag) => ({ tag, onLevel: 0, total: 0 }));
  return [...fromModel, ...pending];
}

/** Whether a pointerdown landed somewhere that should close the panel. */
export function isClickAway(target: HTMLElement | null, root: HTMLElement | null): boolean {
  if (!target) return false;
  if (root?.contains(target)) return false;
  if (target.closest(FLOATING_LAYER_SELECTOR)) return false;
  return true;
}
