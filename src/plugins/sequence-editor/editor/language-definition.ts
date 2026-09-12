import type * as Monaco from 'monaco-editor';

export const PLANTUML_SEQUENCE_LANGUAGE_ID = 'plantuml-sequence';

export function registerPlantUmlSequenceLanguage(monaco: typeof Monaco): void {
  const languages = monaco.languages.getLanguages();
  if (languages.some((l) => l.id === PLANTUML_SEQUENCE_LANGUAGE_ID)) return;

  monaco.languages.register({ id: PLANTUML_SEQUENCE_LANGUAGE_ID });

  // In Monarch, `@foo` is an attribute reference — literal `@` must be written as `@@`.
  monaco.languages.setMonarchTokensProvider(PLANTUML_SEQUENCE_LANGUAGE_ID, {
    ignoreCase: true,
    tokenizer: {
      root: [
        [/'.*$/, 'comment'],
        [/@@startuml|@@enduml/, 'keyword'],
        [
          /\b(title|actor|participant|boundary|control|entity|database|queue|collections|as|activate|deactivate|note|left|right|over|of|return|alt|else|opt|loop|par|and|break|critical|group|expand|end)\b/,
          'keyword',
        ],
        [/-->>|->>|-->x|->x|-->|->|\+\+|--/, 'operator'],
        [/^==.*==$/, 'string'],
        [/^\.\.\..*$/, 'string'],
        [/"[^"]*"/, 'string'],
        [/[A-Za-z_][A-Za-z0-9_]*/, 'identifier'],
        [/:.+$/, 'string'],
      ],
    },
  });

  monaco.languages.setLanguageConfiguration(PLANTUML_SEQUENCE_LANGUAGE_ID, {
    comments: { lineComment: "'" },
    autoClosingPairs: [
      { open: '"', close: '"' },
      { open: '(', close: ')' },
    ],
  });
}
