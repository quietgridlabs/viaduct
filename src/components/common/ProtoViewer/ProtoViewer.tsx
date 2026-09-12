import { useColorMode } from '@contexts/ColorModeContext';
import {
  PROTOBUF_LANGUAGE_ID,
  protobufSurface,
  protobufThemeName,
  registerProtobufLanguage,
  registerProtobufThemes,
} from '@components/common/MonacoProtobuf';
import { Box } from '@chakra-ui/react';
import LoadingSkeleton from '@components/common/LoadingSkeleton';
import type { OnMount } from '@monaco-editor/react';
import { lazy, Suspense, useMemo } from 'react';

const MonacoEditor = lazy(() =>
  import('@monaco-editor/react').then((m) => ({ default: m.default }))
);

const LINE_HEIGHT = 18;
const CHROME = 24;

type Props = {
  value: string;
  /** Unique within the page — Monaco keys models by path. */
  modelId: string;
  minHeight?: number;
  maxHeight?: number;
};

/**
 * Read-only protobuf with the same Monaco highlighting the contract editor uses.
 */
export default function ProtoViewer({
  value,
  modelId,
  minHeight = 90,
  maxHeight = 420,
}: Props) {
  const { mode } = useColorMode();
  const theme = protobufThemeName(mode);
  const text = value || '';

  const height = Math.min(
    Math.max(text.split('\n').length * LINE_HEIGHT + CHROME, minHeight),
    maxHeight
  );

  const path = useMemo(() => `inmemory://contract-view/${modelId}.proto`, [modelId]);

  const handleMount: OnMount = (editor, monaco) => {
    registerProtobufThemes(monaco);
    registerProtobufLanguage(monaco);
    monaco.editor.setTheme(theme);
    editor.layout();
  };

  return (
    <Box
      h={`${height}px`}
      borderWidth="1px"
      borderColor="border.input"
      borderRadius="md"
      overflow="hidden"
      bg={protobufSurface(mode)}
      data-testid={`proto-viewer-${modelId}`}
    >
      <Suspense fallback={<LoadingSkeleton variant="code" />}>
        <MonacoEditor
          height={height}
          language={PROTOBUF_LANGUAGE_ID}
          theme={theme}
          value={text}
          path={path}
          onMount={handleMount}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 12,
            lineNumbers: 'on',
            folding: true,
            foldingHighlight: true,
            showFoldingControls: 'mouseover',
            automaticLayout: true,
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            tabSize: 2,
            renderLineHighlight: 'none',
            padding: { top: 8, bottom: 8 },
            overviewRulerLanes: 0,
            scrollbar: {
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
            domReadOnly: true,
          }}
        />
      </Suspense>
    </Box>
  );
}
