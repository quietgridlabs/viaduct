import type { User } from './types';

/** Community has no guest sessions — always treat as non-guest. */
export function isGuestUser(_user: User | null | undefined): boolean {
  return false;
}

/** Community has no GitLab SSO. */
export function hasGitlabIdentity(_user: User | null | undefined): boolean {
  return false;
}

/** No login page — send callers to the local editor. */
export function loginPagePath(_returnTo?: string | null, _opts?: { expired?: boolean }): string {
  return '/editor';
}

/** No-op: Community never hits an auth API. */
export function onUnauthorized(_listener: () => void): () => void {
  return () => {};
}

export const authApi = {
  me: async () => ({ user: null as User | null, providers: { gitlab: false, google: false, github: false } }),
  logout: async () => ({ ok: true as const }),
};

export const SUPPORT_MAILTO = 'mailto:support@quietgridlabs.com';

/** Mailto-only helper — no `/api/support`. */
export const supportApi = {
  supportMailto: (opts?: { subject?: string; body?: string }) => {
    const params = new URLSearchParams();
    if (opts?.subject) params.set('subject', opts.subject);
    if (opts?.body) params.set('body', opts.body);
    const q = params.toString();
    return q ? `${SUPPORT_MAILTO}?${q}` : SUPPORT_MAILTO;
  },
};
