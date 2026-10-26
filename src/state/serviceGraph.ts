/**
 * Whether the canvas is showing the service graph instead of the C4 level.
 *
 * A tiny external store rather than a prop, for the same reason as
 * diffOverlay.ts: the control that flips it (CanvasZoomBar, inside FlowCanvas)
 * and the code that answers it (EditorCanvasGraph, above FlowCanvas) sit on
 * opposite sides of the canvas and share no owner between them.
 *
 * Deliberately not persisted. The graph is a way of looking at the model for a
 * moment — "what talks to what" — not a place to leave the editor parked; a
 * reload should land on the diagram the person was actually editing.
 */

let active = false;
let building = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function isServiceGraphActive(): boolean {
  return active;
}

/**
 * True while the graph is being built.
 *
 * Laying it out is asynchronous — ELK is a promise, and the first open also
 * fetches it — so between the press and the picture there is a wait with
 * nothing to show for it. The toggle wears the spinner, since the toggle is
 * what was pressed; it lives here rather than being passed down because the
 * button and the code doing the building sit on opposite sides of the canvas.
 */
export function isServiceGraphBuilding(): boolean {
  return building;
}

export function setServiceGraphBuilding(next: boolean): void {
  if (building === next) return;
  building = next;
  emit();
}

export function setServiceGraph(next: boolean): void {
  if (active === next) return;
  active = next;
  /* Closing the graph ends any wait with it. */
  if (!next) building = false;
  emit();
}

export function toggleServiceGraph(): boolean {
  setServiceGraph(!active);
  return active;
}

export function subscribeServiceGraph(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
