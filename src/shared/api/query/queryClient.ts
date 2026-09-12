import { QueryClient } from '@tanstack/react-query';

/**
 * 4xx answers are decisions, not hiccups: a 401 has already told AuthProvider to
 * drop the session and a 403 means the person lacks access. Retrying either one
 * just delays the UI that should already be showing the refusal.
 */
function isClientError(error: unknown): boolean {
  const status = (error as { status?: number } | null | undefined)?.status;
  return typeof status === 'number' && status >= 400 && status < 500;
}

export const MAX_QUERY_RETRIES = 2;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => !isClientError(error) && failureCount < MAX_QUERY_RETRIES,
        /* Long enough that returning to a tab does not restage every screen,
           short enough that the data on it is worth trusting. Screens with a
           poll of their own set their own interval. */
        staleTime: 30_000,
        /* A hidden tab asks for nothing. The transport would mark such a poll
           idle so it could not extend the session anyway, but the cheapest
           request is the one never sent. */
        refetchIntervalInBackground: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
