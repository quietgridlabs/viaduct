import type { ElementLevel } from '@shared/api';

export type ViewContext = {
  /** Narrower than a bare string on purpose: `ghostBelongsToView` compares this
   *  against an `ElementLevel`, so an unrelated string would silently hide
   *  everything instead of failing. */
  viewLevel: ElementLevel;
  activeSystemId?: string;
  activeContainerId?: string;
  activeComponentId?: string;
};

export type Locatable = {
  level: ElementLevel;
  systemId?: string;
  containerId?: string;
  componentId?: string;
};

/**
 * Whether a removed element belongs on the screen currently open — the same
 * question the live model answers implicitly by which elements it even hands
 * to the canvas at this level. A ghost has no model to be filtered by, so
 * this reconstructs that scoping explicitly: not just "same level" but "same
 * parent", or a container removed from system A would show up while looking
 * at system B.
 */
export function ghostBelongsToView(ghost: Locatable, view: ViewContext): boolean {
  if (ghost.level !== view.viewLevel) return false;
  if (view.viewLevel === 'system') return true;
  if (ghost.systemId !== view.activeSystemId) return false;
  if (view.viewLevel === 'container') return true;
  if (ghost.containerId !== view.activeContainerId) return false;
  if (view.viewLevel === 'component') return true;
  return ghost.componentId === view.activeComponentId;
}
