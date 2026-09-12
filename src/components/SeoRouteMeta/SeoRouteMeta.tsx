import {
  applyPageMeta,
  setRouteJsonLd,
  SITE_DEFAULT_DESCRIPTION,
  SITE_NAME,
} from '@/seo';
import { initAnalytics, trackPageview } from '@/analytics';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ROUTE_META } from './constants';
import { buildRouteJsonLd, normalizePath } from './helpers';

/** Keeps <title>/OG tags in sync with the SPA route + Umami pageviews. */
export default function SeoRouteMeta() {
  const { pathname: rawPathname, search } = useLocation();
  const pathname = normalizePath(rawPathname);

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    const meta = ROUTE_META[pathname] ?? ROUTE_META['/'];

    // Project-specific workspace URLs are user-private and should not be indexed.
    if (pathname.startsWith('/projects/')) {
      applyPageMeta({
        title: `${SITE_NAME} — Workspace`,
        description: SITE_DEFAULT_DESCRIPTION,
        path: pathname,
        canonicalPath: '/',
        robots: 'noindex, nofollow, noarchive',
      });
      setRouteJsonLd(null);
      trackPageview(pathname, search);
      return;
    }

    const pathWithQuery = `${pathname}${search || ''}`;
    const isWorkspaceQuery = pathWithQuery.includes('projects=1');
    const robots = isWorkspaceQuery ? 'noindex, nofollow, noarchive' : meta.robots;

    applyPageMeta({
      ...meta,
      path: pathWithQuery,
      canonicalPath: isWorkspaceQuery ? pathname : pathWithQuery,
      robots,
    });

    if (robots?.startsWith('noindex')) {
      setRouteJsonLd(null);
    } else {
      setRouteJsonLd(buildRouteJsonLd(pathname, meta.title, meta.description));
    }

    trackPageview(pathname, search);
  }, [pathname, search]);

  return null;
}
