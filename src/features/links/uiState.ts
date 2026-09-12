/*
 * Which element's links are on screen.
 *
 * The same shape as the sequence and documentation sidebars: a module-level
 * value and a subscription, because the thing opening it is a button on a
 * canvas node and the thing rendering it is a panel at the top of the
 * workspace, with the whole editor in between.
 */
export type LinksSidebarState = {
  ownerId: string;
  ownerName: string;
} | null;

type Listener = () => void;

let sidebar: LinksSidebarState = null;
const listeners = new Set<Listener>();

export function subscribeLinksSidebar(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLinksSidebar(): LinksSidebarState {
  return sidebar;
}

export function closeLinksSidebar(): void {
  if (!sidebar) return;
  sidebar = null;
  listeners.forEach((l) => l());
}

/** Clicking the same element's mark again puts the panel away. */
export function toggleLinksSidebar(next: NonNullable<LinksSidebarState>): void {
  sidebar = sidebar && sidebar.ownerId === next.ownerId ? null : next;
  listeners.forEach((l) => l());
}
