import { SITE_DEFAULT_DESCRIPTION, SITE_NAME } from '@/seo';

export const ROUTE_META: Record<string, { title: string; description: string; robots?: string }> = {
  '/': {
    title: `${SITE_NAME} Community — Local C4 Model Editor`,
    description: SITE_DEFAULT_DESCRIPTION,
  },
  '/editor': {
    title: `${SITE_NAME} — C4 Model Editor`,
    description: SITE_DEFAULT_DESCRIPTION,
    robots: 'noindex, nofollow, noarchive',
  },
  '/docs': {
    title: `Documentation — ${SITE_NAME} Community`,
    description:
      'How to use Viaduct Community: C4 model levels, documentation and sequence diagrams, Magic flows, OpenAPI contracts, and JSON import/export. Team features (MCP, change sets, collab) live in Viaduct Cloud.',
  },
  '/catalog': {
    title: `Service Catalog — ${SITE_NAME}`,
    description:
      'Browse every container in the C4 model by system and kind, inspect a service, then jump to it on the diagram.',
    robots: 'noindex, nofollow, noarchive',
  },
  '/flows': {
    title: `Magic Flows — ${SITE_NAME}`,
    description:
      'Design and browse Magic Flows as ordered steps between services, then play them back on the C4 diagram.',
    robots: 'noindex, nofollow, noarchive',
  },
  '/terms': {
    title: `Terms of Service — ${SITE_NAME}`,
    description:
      'The terms covering use of Viaduct Community: your content, acceptable use, and how the agreement ends.',
  },
  '/privacy': {
    title: `Privacy Policy — ${SITE_NAME}`,
    description:
      'What Viaduct Community collects locally in the browser, and how to contact us about privacy.',
  },
};
