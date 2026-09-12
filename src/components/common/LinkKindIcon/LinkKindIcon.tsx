import { guessLinkKind, type ElementLink, type ElementLinkKind } from '@/types/c4Extensions';
import { useColorMode } from '@contexts/ColorModeContext';
import {
  Atlassian,
  Datadog,
  Docusaurus,
  Git,
  GitHubDark,
  GitHubLight,
  GitLab,
  Grafana,
  Notion,
  Sentry,
  Storybook,
  Swagger,
} from '@ridemountainpig/svgl-react';
import BrandMark, { type BrandSvg } from '@components/common/BrandMark';
import { Box } from '@chakra-ui/react';
import { Activity, BookOpen, Globe } from 'lucide-react';

/**
 * The mark for a link: the brand where the address names one, the kind's
 * glyph where it does not.
 *
 * A row of five links on one host all look alike as addresses; the mark is
 * what lets somebody find the repository without reading them. And a brand
 * says more than a category — a GitLab mark next to a GitHub mark tells you
 * there are two forges in play, which a pair of identical "git" glyphs would
 * hide. The brand marks come from svgl, the same source as the Figma mark
 * beside a design system, so the two kinds of logo on one panel are drawn the
 * same way.
 */
const BRANDS: { test: RegExp; light: BrandSvg; dark?: BrandSvg }[] = [
  { test: /gitlab\./i, light: GitLab },
  { test: /github\.com/i, light: GitHubLight, dark: GitHubDark },
  { test: /grafana/i, light: Grafana },
  { test: /sentry/i, light: Sentry },
  { test: /datadog/i, light: Datadog },
  { test: /notion\./i, light: Notion },
  { test: /atlassian|confluence|jira/i, light: Atlassian },
  { test: /swagger|redoc|openapi/i, light: Swagger },
  { test: /storybook/i, light: Storybook },
  { test: /docusaurus/i, light: Docusaurus },
];

export function linkKindOf(link: Pick<ElementLink, 'url' | 'kind'>): ElementLinkKind {
  return link.kind ?? guessLinkKind(link.url);
}

function brandFor(url: string | undefined, mode: 'light' | 'dark'): BrandSvg | null {
  const text = String(url || '');
  if (!text) return null;
  const hit = BRANDS.find((entry) => entry.test.test(text));
  if (!hit) return null;
  return mode === 'dark' && hit.dark ? hit.dark : hit.light;
}

/** The kind's own glyph, for an address on a host nobody has a logo for. */
function Glyph({ kind, size }: { kind: ElementLinkKind; size: number }) {
  const Icon = kind === 'git' ? Git : kind === 'docs' ? BookOpen : kind === 'observability' ? Activity : Globe;
  /* `Git` is a brand mark from svgl and draws itself; the lucide ones take
     the surrounding colour. */
  if (kind === 'git') return <BrandMark icon={Git} size={size} />;
  return (
    <Box as="span" display="inline-flex" color="fg.muted" lineHeight={0} aria-hidden>
      <Icon size={size} />
    </Box>
  );
}

export default function LinkKindIcon({
  kind,
  url,
  size = 14,
}: {
  kind: ElementLinkKind;
  /** The address, so a known host can show its own mark. */
  url?: string;
  size?: number;
}) {
  const { mode } = useColorMode();
  const brand = brandFor(url, mode);
  if (brand) return <BrandMark icon={brand} size={size} />;
  return <Glyph kind={kind} size={size} />;
}
