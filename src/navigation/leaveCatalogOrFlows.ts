/**
 * Docs / sequence editors are canvas overlays. Catalog, Magic flows and change
 * sets are full-page routes that would bury those overlays — leave them first.
 */
const FULL_PAGE_SEGMENTS = ['/catalog', '/flows', '/change-sets'];

export function leaveCatalogOrFlows(
  pathname: string,
  navigate: (to: string) => void
): void {
  for (const segment of FULL_PAGE_SEGMENTS) {
    if (!pathname.endsWith(segment)) continue;
    const base = pathname.slice(0, -segment.length) || '/';
    navigate(base);
    return;
  }
}
