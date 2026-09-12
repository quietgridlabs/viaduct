const DEFAULT_SCRIPT_SRC = 'https://cloud.umami.is/script.js';

type UmamiConfig = {
  enabled: boolean;
  scriptSrc: string;
  websiteId: string;
};

declare global {
  interface Window {
    umami?: {
      track: (
        event?:
          | string
          | Record<string, unknown>
          | ((props: Record<string, unknown>) => Record<string, unknown>),
        data?: Record<string, unknown>
      ) => void;
    };
  }
}

function readConfig(): UmamiConfig {
  const disabled =
    (import.meta.env.VITE_ANALYTICS_DISABLED || '').toLowerCase() === 'true' ||
    import.meta.env.VITE_ANALYTICS_DISABLED === '1';
  const scriptSrc =
    (import.meta.env.VITE_UMAMI_SCRIPT_SRC || '').trim() || DEFAULT_SCRIPT_SRC;
  /* Empty by default — Community never ships a hardcoded Cloud website id. */
  const websiteId = (import.meta.env.VITE_UMAMI_WEBSITE_ID || '').trim();

  return {
    enabled: !disabled && Boolean(websiteId),
    scriptSrc,
    websiteId,
  };
}

let initialized = false;
let scriptReady = false;
const pending: Array<() => void> = [];

function whenReady(fn: () => void): void {
  if (scriptReady && window.umami?.track) {
    fn();
    return;
  }
  pending.push(fn);
}

function flushPending(): void {
  scriptReady = true;
  const jobs = pending.splice(0, pending.length);
  for (const job of jobs) job();
}

/** Load Umami script once when VITE_UMAMI_WEBSITE_ID is set. Safe to call repeatedly. */
export function initAnalytics(): void {
  if (initialized || typeof document === 'undefined') return;
  const cfg = readConfig();
  if (!cfg.enabled) return;

  const existing = document.querySelector(
    'script[data-c4-analytics="umami"]'
  ) as HTMLScriptElement | null;
  if (existing) {
    initialized = true;
    if (window.umami?.track) flushPending();
    else existing.addEventListener('load', flushPending, { once: true });
    return;
  }

  const script = document.createElement('script');
  script.defer = true;
  script.src = cfg.scriptSrc;
  script.dataset.websiteId = cfg.websiteId;
  script.dataset.autoTrack = 'false';
  script.dataset.c4Analytics = 'umami';
  script.addEventListener('load', flushPending, { once: true });
  document.head.appendChild(script);
  initialized = true;
}

/**
 * Collapse private project ids so analytics never stores workspace UUIDs.
 * `/projects/abc-123` → `/projects/:projectId`
 */
export function analyticsPath(pathname: string, search = ''): string {
  let path = pathname || '/';
  if (path.startsWith('/projects/') && path !== '/projects/') {
    path = '/projects/:projectId';
  }
  if (search.includes('projects=1')) {
    return `${path}?projects=1`;
  }
  return path;
}

/** SPA pageview — call on every client-side navigation. */
export function trackPageview(pathname: string, search = ''): void {
  const cfg = readConfig();
  if (!cfg.enabled) return;

  const path = analyticsPath(pathname, search);
  whenReady(() => {
    window.umami?.track((props) => ({
      ...props,
      url: path,
      website: cfg.websiteId || props.website,
    }));
  });
}

/** Custom event (feature usage, CTAs, etc.). */
export function trackEvent(
  name: string,
  data?: Record<string, string | number | boolean>
): void {
  if (!readConfig().enabled) return;
  whenReady(() => {
    window.umami?.track(name, data);
  });
}
