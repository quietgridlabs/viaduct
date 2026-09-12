/**
 * Utilities for converting between screen and flow coordinates.
 */
import type { ReactFlowInstance } from '@xyflow/react';

// ─── viewportCenterFlowPosition ──────────────────────────────────────────────
// Used by useAddElementInView (existing code).

/**
 * Returns the flow-space position corresponding to the center of the viewport.
 * Requires a `screenToFlowPosition` function from `useReactFlow()`.
 */
export function viewportCenterFlowPosition(
  screenToFlowPosition: (point: { x: number; y: number }) => { x: number; y: number }
): { x: number; y: number } {
  return screenToFlowPosition({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  });
}

// ─── Singleton instance for use outside ReactFlow tree ───────────────────────

let _instance: ReactFlowInstance | null = null;

export function registerFlowInstance(inst: ReactFlowInstance) {
  _instance = inst;
}

export function unregisterFlowInstance() {
  _instance = null;
}

/**
 * Returns the flow-space position of the visible canvas center.
 * Falls back to (200, 200) if no instance is registered yet.
 */
export function screenCenterToFlow(): { x: number; y: number } {
  if (!_instance) return { x: 200, y: 200 };
  return _instance.screenToFlowPosition({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  });
}
