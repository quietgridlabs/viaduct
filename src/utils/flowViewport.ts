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

/**
 * Frame everything on the canvas, from outside the React Flow tree.
 *
 * The service graph is laid out asynchronously and lands nowhere near the
 * diagram's viewport, so whoever finishes building it has to frame it — and
 * that is not a component with `useReactFlow` to hand. Silently does nothing
 * before a canvas has registered, which is the right answer: there is no view
 * to fit yet.
 */
export function fitFlowView(options?: { padding?: number; duration?: number }): void {
  void _instance?.fitView({ padding: 0.2, duration: 380, ...options });
}

export type FlowViewport = { x: number; y: number; zoom: number };

/** Where the canvas is looking, or null before one has registered. */
export function getFlowViewport(): FlowViewport | null {
  return _instance?.getViewport() ?? null;
}

export function setFlowViewport(viewport: FlowViewport, duration = 380): void {
  void _instance?.setViewport(viewport, { duration });
}
