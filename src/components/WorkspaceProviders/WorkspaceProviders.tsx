import { ConnectionTraceProvider } from '@contexts/ConnectionTraceContext';
import { DialogProvider } from '@contexts/DialogProvider';
import PortalTarget from '@slots/PortalTarget';
import type { WorkspaceProvidersProps } from './types';

/**
 * Providers that only the workspace needs. They pull in React Flow and the C4
 * SDK, so they must stay out of the entry chunk the public pages download.
 */
export default function WorkspaceProviders({ children }: WorkspaceProvidersProps) {
  return (
    <DialogProvider>
      <ConnectionTraceProvider>
        {children}
        <PortalTarget id="global-overlay" />
      </ConnectionTraceProvider>
    </DialogProvider>
  );
}
