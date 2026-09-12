export const SITE_URL = 'https://github.com/quietgridlabs/viaduct';
/** Hosted Cloud product — linked from Community docs for team features. */
export const CLOUD_URL = 'https://c4.quietgridlabs.com';
export const SITE_NAME = 'Viaduct';
export const SITE_DEFAULT_DESCRIPTION =
  'Viaduct Community is a local C4 modeling editor: system, container, component and code diagrams, Magic flows, docs, sequence diagrams, OpenAPI contracts, and JSON import/export — all in the browser.';

export type PageMeta = {
  title: string;
  description: string;
  path?: string;
  canonicalPath?: string;
  robots?: string;
};

/** Update document title + primary meta/OG tags for the current route (SPA). */
export function applyPageMeta({
  title,
  description,
  path = '/',
  canonicalPath,
  robots = 'index, follow, max-image-preview:large',
}: PageMeta) {
  if (typeof document === 'undefined') return;

  document.title = title;

  const setMeta = (selector: string, attr: 'content' | 'href', value: string) => {
    const el = document.querySelector(selector);
    if (el) el.setAttribute(attr, value);
  };

  setMeta('meta[name="description"]', 'content', description);
  setMeta('meta[property="og:title"]', 'content', title);
  setMeta('meta[property="og:description"]', 'content', description);
  setMeta('meta[name="twitter:title"]', 'content', title);
  setMeta('meta[name="twitter:description"]', 'content', description);
  setMeta('meta[name="robots"]', 'content', robots);

  const resolvedCanonicalPath = canonicalPath ?? path;
  const url = `${SITE_URL}${resolvedCanonicalPath === '/' ? '' : resolvedCanonicalPath}`;
  setMeta('meta[property="og:url"]', 'content', url);
  setMeta('link[rel="canonical"]', 'href', url);
}

const ROUTE_JSON_LD_ID = 'route-jsonld';

export function setRouteJsonLd(payload: Record<string, unknown> | null) {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById(ROUTE_JSON_LD_ID);
  if (!payload) {
    existing?.remove();
    return;
  }
  const script = existing ?? document.createElement('script');
  script.id = ROUTE_JSON_LD_ID;
  script.setAttribute('type', 'application/ld+json');
  script.textContent = JSON.stringify(payload);
  if (!existing) document.head.appendChild(script);
}
