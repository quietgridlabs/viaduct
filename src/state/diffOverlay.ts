import type { ElementLevel } from '@shared/api';

/**
 * What the open comparison panel wants painted on the canvas — the one thing
 * the plan calls out as the actual point of v3: "the real value is the diff
 * directly on the diagram," not a list beside it.
 *
 * A tiny external store rather than a prop, because the panel that computes
 * this (VersionDiffPanel, opened from VersionRail) and the canvas that has to
 * show it (FlowCanvas) are siblings several layers apart in EditorPage — the
 * same reasoning as versionDrift.ts, and the same shape of solution.
 */

export type GhostElement = {
  id: string;
  level: ElementLevel;
  name: string;
  systemId?: string;
  containerId?: string;
  componentId?: string;
  position: { x: number; y: number };
  technology?: string;
  external: boolean;
  kind?: string;
};

export type DiffOverlay = {
  /** Element id → status, for elements that still exist to be outlined. */
  statusById: Record<string, 'added' | 'changed'>;
  /** Elements gone from the side being viewed — rendered as read-only ghosts. */
  ghosts: GhostElement[];
} | null;

let current: DiffOverlay = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function setDiffOverlay(overlay: DiffOverlay): void {
  current = overlay;
  emit();
}

export function clearDiffOverlay(): void {
  if (!current) return;
  current = null;
  emit();
}

export function subscribeDiffOverlay(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDiffOverlaySnapshot(): DiffOverlay {
  return current;
}
