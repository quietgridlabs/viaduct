/**
 * The public surface of the Community site, in one place.
 *
 * Used by the prerenderer (which snapshots each route into static HTML) and by
 * the sitemap generator.
 */
export const PUBLIC_ROUTES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/docs', changefreq: 'weekly', priority: '0.9' },
  { path: '/editor', changefreq: 'weekly', priority: '0.9' },
  { path: '/terms', changefreq: 'yearly', priority: '0.3' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.3' },
];

export const SITE_URL = 'https://github.com/quietgridlabs/viaduct';

/** `/docs` → `dist/docs/index.html`; `/` → `dist/index.html`. */
export function outputFileFor(routePath) {
  const clean = routePath.replace(/^\/+|\/+$/g, '');
  return clean ? `${clean}/index.html` : 'index.html';
}
