import { useColorMode } from '@contexts/ColorModeContext';
import {
  jsonSurface,
  jsonThemeName,
  registerJsonThemes,
} from '@components/common/MonacoJsonTheme';
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
  /** A JSON value, or text that already is JSON. */
  value: unknown;
  /**
   * Unique within the page: Monaco keys models by path, and two viewers on one
   * path would show — and fold — the same document.
   */
  modelId: string;
  minHeight?: number;
  maxHeight?: number;
};

/**
 * Read-only JSON with the editor's own highlighting and folding.
 *
 * A contract is read far more often than it is written, and a payload that
 * cannot be folded is a wall of text — so the preview gets the same Monaco the
 * editor uses rather than a `<pre>`.
 */
export default function JsonViewer({
  value,
  modelId,
  minHeight = 90,
  maxHeight = 420,
}: Props) {
  const { mode } = useColorMode();
  const theme = jsonThemeName(mode);

  const text = useMemo(
    () => (typeof value === 'string' ? value : JSON.stringify(value, null, 2)),
    [value]
  );

  /* Short payloads should not sit in a half-empty box, long ones should not
     push the rest of the operation off screen. */
  const height = Math.min(
    Math.max(text.split('\n').length * LINE_HEIGHT + CHROME, minHeight),
    maxHeight
  );

  const handleMount: OnMount = (editor, monaco) => {
    registerJsonThemes(monaco);
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
      bg={jsonSurface(mode)}
    >
      <Suspense fallback={<LoadingSkeleton variant="code" />}>
        <MonacoEditor
          height={height}
          language="json"
          theme={theme}
          value={text}
          path={`inmemory://contract-view/${modelId}.json`}
          onMount={handleMount}
          options={{
            readOnly: true,
            domReadOnly: true,
            minimap: { enabled: false },
            fontSize: 12,
            lineNumbers: 'on',
            folding: true,
            showFoldingControls: 'always',
            automaticLayout: true,
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            tabSize: 2,
            padding: { top: 8, bottom: 8 },
            overviewRulerLanes: 0,
            renderLineHighlight: 'none',
            scrollbar: { alwaysConsumeMouseWheel: false },
          }}
        />
      </Suspense>
    </Box>
  );
}
