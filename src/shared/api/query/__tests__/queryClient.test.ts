/**
 * A refused request must not be asked again. 401 has already told AuthProvider
 * to drop the session and 403 means no access — retrying either only delays the
 * message the person needs to see, three times over.
 */
import { createQueryClient, MAX_QUERY_RETRIES } from '../queryClient';

type RetryFn = (failureCount: number, error: unknown) => boolean;

function retryPolicy(): RetryFn {
  const retry = createQueryClient().getDefaultOptions().queries?.retry;
  if (typeof retry !== 'function') throw new Error('expected a retry predicate');
  return retry as RetryFn;
}

function httpError(status: number) {
  return Object.assign(new Error(`HTTP ${status}`), { status });
}

describe('query retry policy', () => {
  it('never retries a refusal the server meant', () => {
    const retry = retryPolicy();
    for (const status of [400, 401, 403, 404, 409, 422]) {
      expect(retry(0, httpError(status))).toBe(false);
    }
  });

  it('retries a server fault, up to the cap', () => {
    const retry = retryPolicy();
    expect(retry(0, httpError(500))).toBe(true);
    expect(retry(MAX_QUERY_RETRIES - 1, httpError(503))).toBe(true);
    expect(retry(MAX_QUERY_RETRIES, httpError(500))).toBe(false);
  });

  it('retries a network failure, which carries no status at all', () => {
    const retry = retryPolicy();
    expect(retry(0, new Error('Failed to fetch'))).toBe(true);
  });

  it('does not retry mutations, which are not safe to repeat blindly', () => {
    expect(createQueryClient().getDefaultOptions().mutations?.retry).toBe(false);
  });

  it('leaves a hidden tab alone rather than polling it', () => {
    expect(createQueryClient().getDefaultOptions().queries?.refetchIntervalInBackground).toBe(false);
  });
});
