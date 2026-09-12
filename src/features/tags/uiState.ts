/**
 * Which tag the canvas is currently lighting up.
 *
 * Module-level like the other overlays: the rail sets it and the canvas reads
 * it, without threading a prop through the whole editor for a value only two
 * places care about.
 */
type Listener = () => void;

let highlighted: string | null = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function highlightTag(tag: string | null): void {
  const next = tag && tag.trim() ? tag : null;
  if (next === highlighted) return;
  highlighted = next;
  emit();
}

export function getHighlightedTag(): string | null {
  return highlighted;
}

export function subscribeHighlightedTag(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
