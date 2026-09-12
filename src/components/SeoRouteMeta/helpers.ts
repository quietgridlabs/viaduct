import { SITE_NAME, SITE_URL } from '@/seo';

/** `/docs/` and `/docs` are the same page — index them as one. */
export function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.replace(/\/+$/, '');
  return pathname || '/';
}

/** Trail from the home page to here, so results can show a path. */
export function breadcrumbs(label: string, publicUrl: string) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: label, item: publicUrl },
    ],
  };
}

export function buildRouteJsonLd(pathname: string, title: string, description: string) {
  const publicUrl = `${SITE_URL}${pathname === '/' ? '' : pathname}`;

  const page =
    pathname === '/docs'
      ? {
          '@type': 'TechArticle',
          headline: 'Viaduct Community — local C4 modeling',
          name: title,
          description,
          url: publicUrl,
          inLanguage: 'en',
          isPartOf: { '@id': `${SITE_URL}/#website` },
          about: [
            'C4 model',
            'software architecture documentation',
            'Magic flows',
            'OpenAPI',
          ],
          author: { '@id': `${SITE_URL}/#organization` },
          publisher: { '@id': `${SITE_URL}/#organization` },
          mainEntityOfPage: publicUrl,
        }
      : {
          '@type': 'WebPage',
          name: title,
          description,
          url: publicUrl,
          inLanguage: 'en',
          isPartOf: { '@id': `${SITE_URL}/#website` },
          ...(pathname === '/' ? { about: { '@id': `${SITE_URL}/#app` } } : {}),
        };

  return {
    '@context': 'schema.org',
    '@graph':
      pathname === '/'
        ? [page]
        : [page, breadcrumbs(title.split(' — ')[0], publicUrl)],
  };
}
