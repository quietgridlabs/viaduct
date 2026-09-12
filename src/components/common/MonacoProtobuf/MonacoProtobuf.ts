import type * as Monaco from 'monaco-editor';
import type { PaletteMode } from '@theme/theme';
import { JSON_SURFACE, jsonSurface, jsonThemeName, registerJsonThemes } from '../MonacoJsonTheme';

/**
 * Monaco language id for protobuf. Registered once; Monaco keeps languages
 * globally the same way it keeps themes.
 */
export const PROTOBUF_LANGUAGE_ID = 'protobuf';

const PROTO_KEYWORDS = [
  'syntax',
  'import',
  'option',
  'package',
  'message',
  'enum',
  'service',
  'rpc',
  'returns',
  'stream',
  'oneof',
  'map',
  'repeated',
  'optional',
  'required',
  'reserved',
  'extensions',
  'extend',
  'group',
  'to',
  'max',
  'true',
  'false',
];

const PROTO_TYPES = [
  'double',
  'float',
  'int32',
  'int64',
  'uint32',
  'uint64',
  'sint32',
  'sint64',
  'fixed32',
  'fixed64',
  'sfixed32',
  'sfixed64',
  'bool',
  'string',
  'bytes',
];

let languageRegistered = false;

/** Monarch tokenizer for `.proto` — keywords, types, field numbers, comments. */
export function registerProtobufLanguage(monaco: typeof Monaco): void {
  if (languageRegistered) return;
  languageRegistered = true;

  monaco.languages.register({ id: PROTOBUF_LANGUAGE_ID, extensions: ['.proto'] });
  monaco.languages.setMonarchTokensProvider(PROTOBUF_LANGUAGE_ID, {
    keywords: PROTO_KEYWORDS,
    typeKeywords: PROTO_TYPES,
    tokenizer: {
      root: [
        [/\/\/.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/'([^'\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string_double'],
        [/'/, 'string', '@string_single'],
        [/\b\d+\b/, 'number'],
        [
          /[a-zA-Z_][\w]*/,
          {
            cases: {
              '@keywords': 'keyword',
              '@typeKeywords': 'type',
              '@default': 'identifier',
            },
          },
        ],
        [/[{}()<>[\]]/, '@brackets'],
        [/[;,.=]/, 'delimiter'],
      ],
      comment: [
        [/[^/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[/*]/, 'comment'],
      ],
      string_double: [
        [/[^\\"]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, 'string', '@pop'],
      ],
      string_single: [
        [/[^\\']+/, 'string'],
        [/\\./, 'string.escape'],
        [/'/, 'string', '@pop'],
      ],
    },
  });

  monaco.languages.setLanguageConfiguration(PROTOBUF_LANGUAGE_ID, {
    comments: { lineComment: '//', blockComment: ['/*', '*/'] },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
      ['<', '>'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '<', close: '>' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '<', close: '>' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
    ],
  });
}

/** Reuse the JSON theme surfaces so proto and JSON editors match. */
export function registerProtobufThemes(monaco: typeof Monaco): void {
  registerJsonThemes(monaco);
}

export function protobufThemeName(mode: PaletteMode): string {
  return jsonThemeName(mode);
}

export function protobufSurface(mode: PaletteMode): string {
  return jsonSurface(mode);
}

export { JSON_SURFACE };
