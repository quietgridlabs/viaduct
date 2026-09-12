import { pluginsAreReady, subscribeToPlugins } from '@plugins/manager';
import { useSyncExternalStore } from 'react';

/** Re-renders the caller once the plugin registry has been populated. */
export function usePluginsReady(): boolean {
  return useSyncExternalStore(subscribeToPlugins, pluginsAreReady, pluginsAreReady);
}
