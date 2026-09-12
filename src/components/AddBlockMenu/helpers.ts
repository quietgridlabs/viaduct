import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';

/**
 * Every level below systems needs a parent to hang the new block on, so the
 * menu offers its rows disabled rather than hiding them.
 */
export function canAddAtLevel(
  model: Pick<
    FlatC4Model,
    'viewLevel' | 'activeSystemId' | 'activeContainerId' | 'activeComponentId'
  >
): boolean {
  const level = model.viewLevel;
  return (
    level === 'system' ||
    (level === 'container' && Boolean(model.activeSystemId)) ||
    (level === 'component' && Boolean(model.activeContainerId)) ||
    (level === 'code' && Boolean(model.activeComponentId))
  );
}
