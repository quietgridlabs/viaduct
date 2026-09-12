import { ensurePluginsLoaded } from '@plugins/manager';

/** Warm the editor bundle + plugins ahead of a likely navigation (CTA hover). */
export function prefetchWorkspace(): void {
  void import('../pages/EditorPage');
  void ensurePluginsLoaded();
}
