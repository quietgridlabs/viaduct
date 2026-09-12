import { ensurePluginsLoaded } from '@plugins/manager';
import { usePluginsReady } from '@plugins/usePluginsReady';
import { useEffect } from 'react';
import type { PluginBootProps } from './types';

/** Boots the plugin registry before rendering workspace routes. */
export default function PluginBoot({ children, fallback = null }: PluginBootProps) {
  const ready = usePluginsReady();

  useEffect(() => {
    void ensurePluginsLoaded();
  }, []);

  if (!ready) return <>{fallback}</>;

  return <>{children}</>;
}
