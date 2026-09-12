import { useColorMode } from '@contexts/ColorModeContext';
import { Box, type BoxProps } from '@chakra-ui/react';
import { useMemo, type ReactNode } from 'react';

/**
 * A short, static JSON sample with its syntax coloured in.
 *
 * Deliberately not Prism or Monaco: this is a fixed string on a marketing
 * page, and neither a highlighting library nor an editor is worth its weight
 * on the first paint of a page whose whole job is to load fast. JSON has four
 * kinds of token, which is a regex.
 *
 * The palette is GitHub's, the same one the Monaco contract editors are
 * themed to, so a sample here and the real editor look like the same product.
 */
const PALETTE = {
  light: {
    key: '#0550ae',
    string: '#0a3069',
    number: '#0550ae',
    literal: '#cf222e',
    punctuation: '#57606a',
    plain: '#24292f',
  },
  dark: {
    key: '#79c0ff',
    string: '#a5d6ff',
    number: '#79c0ff',
    literal: '#ff7b72',
    punctuation: '#8b949e',
    plain: '#c9d1d9',
  },
} as const;

type TokenKind = keyof (typeof PALETTE)['light'];

/* One pass: a string (with the colon after it, if any, marking it as a key),
   a literal, a number, or punctuation. Anything unmatched falls through as
   plain text, which is what keeps whitespace and line breaks intact. */
const TOKENS =
  /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],:])/g;

function tokenize(source: string, color: Record<TokenKind, string>): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  const push = (text: string, kind: TokenKind) => {
    if (!text) return;
    out.push(
      <span key={key++} style={{ color: color[kind] }}>
        {text}
      </span>
    );
  };

  TOKENS.lastIndex = 0;
  while ((match = TOKENS.exec(source)) !== null) {
    push(source.slice(last, match.index), 'plain');
    const [, str, colon, literal, number, punctuation] = match;
    if (str) {
      push(str, colon ? 'key' : 'string');
      if (colon) push(colon, 'punctuation');
    } else if (literal) {
      push(literal, 'literal');
    } else if (number) {
      push(number, 'number');
    } else if (punctuation) {
      push(punctuation, 'punctuation');
    }
    last = match.index + match[0].length;
  }
  push(source.slice(last), 'plain');
  return out;
}

export default function JsonSnippet({
  code,
  ...boxProps
}: { code: string } & BoxProps) {
  const { mode } = useColorMode();
  const color = PALETTE[mode === 'light' ? 'light' : 'dark'];
  const content = useMemo(() => tokenize(code, color), [code, color]);
  return (
    <Box as="pre" {...boxProps}>
      <code>{content}</code>
    </Box>
  );
}
