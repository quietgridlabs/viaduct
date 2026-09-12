import Editor, { type OnMount } from '@monaco-editor/react';
import LoadingSkeleton from '@components/common/LoadingSkeleton';
import { Box } from '@chakra-ui/react';
import type * as Monaco from 'monaco-editor';
import { useEffect, useRef } from 'react';
import type { Diagnostic } from '../plantuml/diagnostics';
import type { C4CatalogParticipant } from '../host/c4Catalog';
import { registerCompletionProvider } from './completion-provider';
import {
  PLANTUML_SEQUENCE_LANGUAGE_ID,
  registerPlantUmlSequenceLanguage,
} from './language-definition';

type Props = {
  value: string;
  revision: number;
  updateOrigin?: string;
  diagnostics: Diagnostic[];
  catalog: C4CatalogParticipant[];
  participantIds: string[];
  readOnly?: boolean;
  theme?: 'light' | 'dark';
  onChange: (value: string) => void;
};

function toMarkers(
  monaco: typeof Monaco,
  diagnostics: Diagnostic[]
): Monaco.editor.IMarkerData[] {
  return diagnostics.map((d) => ({
    severity:
      d.severity === 'error'
        ? monaco.MarkerSeverity.Error
        : monaco.MarkerSeverity.Warning,
    message: d.message,
    startLineNumber: d.line,
    startColumn: d.column,
    endLineNumber: d.endLine ?? d.line,
    endColumn: d.endColumn ?? d.column + 1,
    code: d.code,
  }));
}

export default function PlantUmlMonacoEditor({
  value,
  revision,
  updateOrigin,
  diagnostics,
  catalog,
  participantIds,
  readOnly,
  theme = 'light',
  onChange,
}: Props) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyingRef = useRef(false);
  const catalogRef = useRef(catalog);
  const participantsRef = useRef(participantIds);
  const onChangeRef = useRef(onChange);
  catalogRef.current = catalog;
  participantsRef.current = participantIds;
  onChangeRef.current = onChange;

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    try {
      registerPlantUmlSequenceLanguage(monaco);
      registerCompletionProvider(monaco, () => ({
        catalog: catalogRef.current,
        participantIds: participantsRef.current,
      }));
    } catch (err) {
      console.error('[sequence-editor] monaco language init failed', err);
    }
    const model = editor.getModel();
    if (model) {
      monaco.editor.setModelMarkers(
        model,
        PLANTUML_SEQUENCE_LANGUAGE_ID,
        toMarkers(monaco, diagnostics)
      );
    }

    /*
     * No blanket stopPropagation here. It was added to keep window-level
     * shortcuts from swallowing keys out of the editor, but Monaco dispatches
     * its own commands from a listener on the editor container — above the
     * EditContext element this fires on — so cutting propagation cut cursor
     * movement, selection-aware delete and backspace-joins-lines with it.
     * The global handlers now recognise Monaco through `isTypingTarget`, which
     * is where that concern belongs.
     *
     * Space is the exception: React Flow's pan-on-Space and suggestion commit
     * still eat it under Monaco's EditContext host (a plain div). Same fix as
     * the docs markdown editor — stop bubble + force a literal space.
     */
    editor.onKeyDown((e) => {
      if (e.keyCode !== monaco.KeyCode.Space || e.ctrlKey || e.metaKey || e.altKey) return;
      e.browserEvent.stopPropagation();
    });
    editor.addCommand(monaco.KeyCode.Space, () => {
      editor.trigger('keyboard', 'type', { text: ' ' });
    });

    // Uncontrolled after mount: push source only from canvas/inspector, not on every keystroke.
    editor.onDidChangeModelContent(() => {
      if (applyingRef.current) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onChangeRef.current(editor.getValue());
      }, 300);
    });
  };

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (updateOrigin === 'code') return;
    const current = editor.getValue();
    if (current !== value) {
      applyingRef.current = true;
      editor.setValue(value);
      applyingRef.current = false;
    }
  }, [value, revision, updateOrigin]);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (!model) return;
    monaco.editor.setModelMarkers(
      model,
      PLANTUML_SEQUENCE_LANGUAGE_ID,
      toMarkers(monaco, diagnostics)
    );
  }, [diagnostics]);

  useEffect(() => {
    monacoRef.current?.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'light');
  }, [theme]);

  return (
    <Box h="100%" minH={0} className="nokey">
      <Editor
        loading={<LoadingSkeleton variant="code" />}
        height="100%"
        language={PLANTUML_SEQUENCE_LANGUAGE_ID}
        theme={theme === 'dark' ? 'vs-dark' : 'light'}
        defaultValue={value}
        onMount={handleMount}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: 'on',
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          // Keep default editor keybindings (Ctrl/Cmd+A, Delete, etc.)
          tabCompletion: 'on',
          // Suggest only while typing / on trigger chars — not on bare cursor placement.
          quickSuggestions: {
            other: true,
            comments: false,
            strings: false,
          },
          suggestOnTriggerCharacters: true,
          quickSuggestionsDelay: 150,
          wordBasedSuggestions: 'off',
          // Space must insert a space, not accept a ghost suggestion.
          acceptSuggestionOnCommitCharacter: false,
        }}
      />
    </Box>
  );
}
