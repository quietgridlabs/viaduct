/**
 * Product events from the browser.
 *
 * These go to Viaduct Metrics through our own API, which is what adds the
 * ingest token and the user id — neither of which the bundle is allowed to
 * know. Umami is untouched by this file: it keeps doing anonymous pageviews
 * and CTAs under its own flag.
 *
 * Sending is fire-and-forget. Nothing here awaits, retries or reports failure
 * to the caller: a metric that does not arrive is a gap in a report, and that
 * must never become a gap in the product.
 */
import { getOrCreateAnonymousId } from './anonymousId';
import type { MetricEvent, MetricProps } from './events';
import { isDevBuild, metricsDisabled } from './env';

export type { MetricEvent, MetricProps } from './events';
export { METRIC_EVENTS } from './events';
export { getOrCreateAnonymousId, isValidAnonymousId } from './anonymousId';

const ENDPOINT = '/api/metrics/event';

/* Values that may leave the browser. Kept in step with `scrubMetadata` on the
   server, which enforces the same rule for events that never pass through
   here — this copy exists so a mistake is visible in dev, close to the call. */
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const ENUM_LIKE = /^[a-z0-9][a-z0-9 _\-.:]{0,39}$/i;

export type ScrubResult = {
  props: Record<string, string | number | boolean>;
  dropped: string[];
};

/**
 * Keep the enums, counts and flags; drop anything that could identify a
 * project, an element or a person.
 *
 * Exported for the unit test that guards the data policy.
 */
export function scrubProps(props?: MetricProps): ScrubResult {
  const out: Record<string, string | number | boolean> = {};
  const dropped: string[] = [];
  if (!props) return { props: out, dropped };

  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'number') {
      if (Number.isFinite(value)) out[key] = value;
      else dropped.push(key);
      continue;
    }
    if (typeof value === 'boolean') {
      out[key] = value;
      continue;
    }
    const text = String(value).trim();
    if (!text || UUID.test(text) || EMAIL.test(text) || !ENUM_LIKE.test(text)) {
      dropped.push(key);
      continue;
    }
    out[key] = text;
  }

  return { props: out, dropped };
}

/* Events fired before the app is interactive — during module init, or on a
   first paint that is still hydrating — wait here rather than racing it. */
type Queued = {
  eventName: MetricEvent;
  metadata: Array<Record<string, string | number | boolean>>;
  /** Browser-stable id when there is no session; server may promote it to X-User-Id. */
  anonymousId?: string;
};
let ready = typeof document !== 'undefined' && document.readyState === 'complete';
const queue: Queued[] = [];

function send(payload: Queued): void {
  try {
    void fetch(ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      /* Best-effort: a metric is not worth a console error in a user's tab. */
    });
  } catch {
    /* `fetch` itself can throw in exotic environments (tests, extensions). */
  }
}

function flush(): void {
  ready = true;
  const jobs = queue.splice(0, queue.length);
  for (const job of jobs) send(job);
}

if (typeof window !== 'undefined' && !ready) {
  window.addEventListener('load', flush, { once: true });
  /* A tab closed before `load` still gets its events out — `keepalive` above
     is what lets the request outlive the page. */
  window.addEventListener('pagehide', flush, { once: true });
}

/**
 * Record one product event.
 *
 * @param name canonical name from the dictionary — the union type is the
 *   guard against typos, and the server refuses anything it does not know.
 * @param props enums / counts / flags only; see `scrubProps`.
 */
export function trackProductEvent(name: MetricEvent, props?: MetricProps): void {
  if (metricsDisabled() || typeof window === 'undefined') return;

  const { props: clean, dropped } = scrubProps(props);
  if (dropped.length && isDevBuild()) {
    console.warn(
      `metrics: dropped non-enum props on ${name}: ${dropped.join(', ')} — ` +
        'metadata takes enums, numbers and booleans only'
    );
  }

  const anonymousId = getOrCreateAnonymousId() ?? undefined;
  const payload: Queued = {
    eventName: name,
    metadata: Object.keys(clean).length ? [clean] : [],
    ...(anonymousId ? { anonymousId } : {}),
  };

  if (!ready) {
    queue.push(payload);
    return;
  }
  send(payload);
}

/**
 * `session.started` — once per browser session, when the app opens with a
 * signed-in user. Repeated calls in the same tab session do nothing, so it can
 * live in an effect that runs on every route change.
 */
const SESSION_KEY = 'c4-metrics-session';

export function trackSessionStarted(): void {
  if (metricsDisabled() || typeof window === 'undefined') return;
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    /* Private mode without storage: better a repeated event than none. */
  }
  trackProductEvent('session.started');
}
