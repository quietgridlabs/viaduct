import type * as Monaco from 'monaco-editor';
import type { C4CatalogParticipant } from '../host/c4Catalog';
import { PLANTUML_SEQUENCE_LANGUAGE_ID } from './language-definition';

export type CompletionContext = {
  catalog: C4CatalogParticipant[];
  /** Participants already on the diagram — the only C4 ids offered in suggest. */
  participantIds: string[];
};

export function registerCompletionProvider(
  monaco: typeof Monaco,
  getContext: () => CompletionContext
): Monaco.IDisposable {
  return monaco.languages.registerCompletionItemProvider(PLANTUML_SEQUENCE_LANGUAGE_ID, {
    // Only while typing message arrows — not space/newline (those open the widget with an idle cursor).
    triggerCharacters: ['-', '>'],
    provideCompletionItems(model, position) {
      const ctx = getContext();
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions: Monaco.languages.CompletionItem[] = [];

      const kindKeywords = [
        'actor',
        'participant',
        'boundary',
        'control',
        'entity',
        'database',
      ];

      for (const kw of kindKeywords) {
        suggestions.push({
          label: kw,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: kw,
          range,
        });
      }

      // Only participants already on the diagram (not the full C4 catalog).
      for (const id of ctx.participantIds) {
        const cat = ctx.catalog.find((c) => c.id === id);
        const typeLabel =
          cat?.plantUmlKind === 'database' ? 'database' : cat?.c4Type;
        suggestions.push({
          label: cat ? `${id} — ${cat.label} (${typeLabel})` : id,
          kind: monaco.languages.CompletionItemKind.Variable,
          insertText: id,
          detail: cat ? `C4 ${typeLabel}` : 'participant',
          documentation: cat
            ? `${cat.plantUmlKind} "${cat.label}" as ${cat.id}`
            : id,
          range,
        });
      }

      suggestions.push(
        {
          label: 'message',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: '${1:From} -> ${2:To}: ${3:text}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: 'return',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'return ${1:ok}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Reply to the previous message',
          range,
        },
        {
          label: 'note',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'note over ${1:Alias}: ${2:text}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: 'divider',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: '== ${1:section} ==',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: 'activate',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'activate ${1:Alias}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: 'participant',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'participant "${1:Label}" as ${2:Alias}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: 'expand / group',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'group ${1:Label}\n  ${2:A} -> ${3:B}: ${4:text}\nend',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Collapsible group (PlantUML group)',
          range,
        },
        {
          label: 'alt',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText:
            'alt ${1:success}\n  ${2:A} -> ${3:B}: ${4:ok}\nelse ${5:error}\n  ${2:A} -> ${3:B}: ${6:fail}\nend',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Collapsible alt / else',
          range,
        },
        {
          label: 'loop',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'loop ${1:n times}\n  ${2:A} -> ${3:B}: ${4:text}\nend',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Collapsible loop',
          range,
        }
      );

      return { suggestions };
    },
  });
}
