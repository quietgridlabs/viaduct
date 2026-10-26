/**
 * Whether the canvas shortcuts dialog is open.
 *
 * Same tiny-store pattern as serviceGraph: the toolbar button that opens it
 * and the `?` key that opens it sit on opposite sides of the canvas.
 */

let open = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function isCanvasShortcutsOpen(): boolean {
  return open;
}

export function setCanvasShortcutsOpen(next: boolean): void {
  if (open === next) return;
  open = next;
  emit();
}

export function openCanvasShortcuts(): void {
  setCanvasShortcutsOpen(true);
}

export function closeCanvasShortcuts(): void {
  setCanvasShortcutsOpen(false);
}

export function subscribeCanvasShortcuts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
