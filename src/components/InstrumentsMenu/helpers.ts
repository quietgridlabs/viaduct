import type { InstrumentsMenuItem } from './types';

/** Losing the return path is not worth failing the navigation over. */
export function rememberReturnTo(key: string, path: string): void {
  try {
    sessionStorage.setItem(key, path);
  } catch {
    /* ignore */
  }
}

/**
 * Hover text: why it cannot be opened, or what opening it will and will not
 * let you do.
 */
export function menuItemTitle(item: InstrumentsMenuItem): string | undefined {
  if (item.disabled && !item.active) return item.disabledReason;
  return item.hint ? `${item.label} · ${item.hint}` : item.label;
}
