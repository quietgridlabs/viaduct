/**
 * What Figma refusing looks like, in words, in one place.
 *
 * The server answers a code so callers can tell the cases apart — a rate limit
 * is waited out, an expired token is replaced, an unreachable Figma is simply
 * not our problem to fix. Every screen that can trigger a read has to turn
 * those into a sentence, and two screens with two wordings for the same
 * failure is how a product ends up telling people different stories about the
 * same thing.
 */
const FIGMA_ERRORS: Record<string, string> = {
  figma_token_invalid:
    'Figma refused that token. It may have expired — create a new one and paste it here.',
  figma_not_connected: 'No Figma account is attached. Connect one in Settings → Design tools.',
  figma_not_found: 'That file or node is not visible to this token.',
  figma_rate_limited: 'Figma is rate-limiting this token. Try again in a minute.',
  figma_unreachable: 'Figma did not answer. Nothing was changed.',
  figma_timeout: 'Figma took too long — the file may be very large. Nothing was changed.',
  figma_failed: 'Figma answered with an error.',
  no_figma_source: 'This design system has no Figma file to read from.',
  no_design_node: 'This element names no design node.',
  not_a_figma_node: 'This element does not point at a node Viaduct can read.',
  token_required: 'Paste the token first.',
  token_invalid: 'That does not look like a Figma personal access token.',
};

/**
 * @param err What `request` threw, or a bare code — `last_error` on a stored
 *   connection is one. A thrown error carries the server's code as its
 *   message, so both fields are looked up, and anything unrecognised is shown
 *   as it came rather than swallowed.
 */
export function figmaErrorText(err: unknown, fallback = 'Could not read from Figma'): string {
  if (typeof err === 'string') return FIGMA_ERRORS[err] || err || fallback;
  const code = (err as { code?: string })?.code;
  const message = (err as Error)?.message || '';
  return FIGMA_ERRORS[code || ''] || FIGMA_ERRORS[message] || message || fallback;
}
