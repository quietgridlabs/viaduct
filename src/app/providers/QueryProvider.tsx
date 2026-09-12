import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { createQueryClient } from '@shared/api/query/queryClient';

/**
 * One client per mounted app, created in state so that StrictMode's double
 * render — and any future remount — reuses it instead of throwing the cache away.
 */
export default function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
