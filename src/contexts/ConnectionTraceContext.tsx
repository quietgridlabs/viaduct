import type { ConnectionTraceState } from '@utils/connectionTrace';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type ConnectionTraceContextValue = {
  trace: ConnectionTraceState | null;
  startTrace: (state: ConnectionTraceState) => void;
  /** Clear highlight flags but keep the merged connection view. */
  clearHighlight: () => void;
  /** Exit connection-trace mode entirely. */
  clearTrace: () => void;
};

const ConnectionTraceContext = createContext<ConnectionTraceContextValue | undefined>(undefined);

export function ConnectionTraceProvider({ children }: { children: ReactNode }) {
  const [trace, setTrace] = useState<ConnectionTraceState | null>(null);

  const startTrace = useCallback((state: ConnectionTraceState) => {
    setTrace(state);
  }, []);

  const clearHighlight = useCallback(() => {
    setTrace((prev) => (prev ? { ...prev, highlightedIds: [] } : null));
  }, []);

  const clearTrace = useCallback(() => {
    setTrace(null);
  }, []);

  const value = useMemo(
    () => ({ trace, startTrace, clearHighlight, clearTrace }),
    [trace, startTrace, clearHighlight, clearTrace]
  );

  return (
    <ConnectionTraceContext.Provider value={value}>{children}</ConnectionTraceContext.Provider>
  );
}

export function useConnectionTrace(): ConnectionTraceContextValue {
  const ctx = useContext(ConnectionTraceContext);
  if (!ctx) {
    throw new Error('useConnectionTrace must be used within ConnectionTraceProvider');
  }
  return ctx;
}
