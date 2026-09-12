import { lastUserActivityAt } from '@shared/lib/userActivity';

type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

/** Called when any API request returns 401 — AuthProvider clears local session UI. */
export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

function emitUnauthorized() {
  unauthorizedListeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore */
    }
  });
}

/**
 * The input the session was last extended for. Module-level, because the rule
 * is about the tab as a whole and not about any one caller.
 */
let slidForInputAt = 0;

/**
 * Marks a request the person did not cause, so the server declines to extend
 * the session for it. See sessionProbe.test.ts for the contract.
 */
function sessionProbeHeaders(force?: boolean): Record<string, string> | undefined {
  const inputAt = lastUserActivityAt();
  if (!force && inputAt > slidForInputAt) {
    slidForInputAt = inputAt;
    return undefined;
  }
  return { 'X-Session-Probe': 'idle' };
}

export type RequestOptions = { idle?: boolean };

export async function request<T>(
  path: string,
  init?: RequestInit,
  opts?: RequestOptions
): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...sessionProbeHeaders(opts?.idle),
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      emitUnauthorized();
    }
    const body = await res.json().catch(() => ({}));
    const error = new Error((body as { error?: string }).error || res.statusText);
    (error as Error & { status?: number }).status = res.status;
    throw error;
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

/** Image exports come back as a file, not JSON — the server does the drawing. */
export async function requestBlob(path: string, body: unknown): Promise<Blob> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `Export failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }
  return res.blob();
}
