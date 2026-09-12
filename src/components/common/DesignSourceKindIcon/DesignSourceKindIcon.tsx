import { Figma } from '@ridemountainpig/svgl-react';
import BrandMark from '@components/common/BrandMark';
import { Box } from '@chakra-ui/react';
import { CircleOff, Code2, FileCode2 } from 'lucide-react';

type Props = {
  kind?: string | null;
  size?: number;
};

/**
 * Brand or glyph for where a design system's values come from.
 * Figma is the real mark from svgl; the rest are lucide stand-ins.
 */
export default function DesignSourceKindIcon({ kind, size = 14 }: Props) {
  if (kind === 'figma') {
    /* Through BrandMark: the Figma mark clips with a `<defs>` id, and a
       second copy of it on the page — in a closed list, say — would otherwise
       point at a hidden definition and paint nothing. */
    return <BrandMark icon={Figma} size={size} />;
  }
  const Icon = kind === 'tokens-file' ? FileCode2 : kind === 'code' ? Code2 : CircleOff;
  return (
    <Box as="span" display="inline-flex" color="fg.muted" lineHeight={0} aria-hidden>
      <Icon size={size} />
    </Box>
  );
}

/**
 * What to show instead of a raw Figma URL: the path after `/design`
 * (`/KEY/File-Name`), query stripped. Other kinds keep the ref as typed.
 */
export function designSourceDisplayRef(kind: string | undefined | null, ref: string): string {
  if (kind !== 'figma') return ref;
  try {
    const path = new URL(ref).pathname;
    const design = path.toLowerCase().indexOf('/design/');
    if (design >= 0) return path.slice(design + '/design'.length) || path;
    const file = path.toLowerCase().indexOf('/file/');
    if (file >= 0) return path.slice(file + '/file'.length) || path;
    return path;
  } catch {
    return ref;
  }
}
