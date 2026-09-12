import {
  HTTP_MEDIA_KINDS,
  isJsonMedia,
  mediaTypeFor,
  type HttpBody,
  type HttpMediaKind,
} from '@components/common/HttpContract';
import { parseJsonContract } from '@components/common/JsonContract';
import ThemedSelect from '@components/common/ThemedSelect';
import { useColorMode } from '@contexts/ColorModeContext';
import LoadingSkeleton from '@components/common/LoadingSkeleton';
import { jsonSurface, jsonThemeName, registerJsonThemes } from '@components/common/MonacoJsonTheme';
import { Box, Button, HStack, Text, Textarea, VStack } from '@chakra-ui/react';
import type { OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { AlignLeft } from 'lucide-react';
import { lazy, Suspense, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const MonacoEditor = lazy(() =>
  import('@monaco-editor/react').then((m) => ({ default: m.default }))
);

const EDITOR_HEIGHT = 200;

type Tab = 'example' | 'schema';

type Props = {
  body: HttpBody;
  onChange: (patch: Partial<HttpBody>) => void;
  /**
   * Unique within the dialog. Monaco keys its models by path, so two editors
   * sharing one path would show — and edit — the same document.
   */
  modelId: string;
  testId: string;
};

/**
 * Payload editor for one side of a contract: media type, an example, and an
 * optional JSON Schema. JSON payloads get Monaco (folding, linting); anything
 * else is plain text, because there is nothing to lint about a CSV or a blob.
 */
export default function HttpBodyEditor({ body, onChange, modelId, testId }: Props) {
  const { t } = useTranslation();
  const { mode } = useColorMode();
  const [tab, setTab] = useState<Tab>('example');
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const themeName = jsonThemeName(mode);
  const surface = jsonSurface(mode);

  const mediaOptions = useMemo(
    () =>
      HTTP_MEDIA_KINDS.map((kind) => ({
        value: kind,
        label: kind === 'none' ? t('http_body_none') : mediaTypeFor(kind) || kind,
      })),
    [t]
  );

  const schemaAvailable = isJsonMedia(body.media);
  const activeTab: Tab = schemaAvailable ? tab : 'example';
  const value = activeTab === 'schema' ? body.schema : body.example;
  const setValue = (next: string) =>
    onChange(activeTab === 'schema' ? { schema: next } : { example: next });

  /* The schema is JSON even when the payload it describes is not. */
  const jsonEditor = activeTab === 'schema' || isJsonMedia(body.media);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    registerJsonThemes(monaco);
    monaco.editor.setTheme(themeName);
    editor.layout();
  };

  const parsed = jsonEditor && value.trim() ? parseJsonContract(value) : null;

  return (
    <VStack align="stretch" gap="8px" w="full">
      <HStack gap="8px" flexWrap="wrap" align="center">
        <Box w="220px" flexShrink={0}>
          <ThemedSelect
            size="sm"
            ariaLabel={t('http_body_media')}
            options={mediaOptions}
            value={body.media}
            onChange={(media) => onChange({ media: media as HttpMediaKind })}
            data-testid={`${testId}-media`}
          />
        </Box>

        {body.media !== 'none' && schemaAvailable ? (
          <HStack gap="2px">
            {(['example', 'schema'] as Tab[]).map((id) => (
              <Button
                key={id}
                size="xs"
                variant={activeTab === id ? 'solid' : 'ghost'}
                bg={activeTab === id ? 'bg.muted' : undefined}
                color={activeTab === id ? 'fg.default' : 'fg.muted'}
                onClick={() => setTab(id)}
                data-testid={`${testId}-tab-${id}`}
              >
                {id === 'example' ? t('http_body_example') : t('http_body_schema')}
                {id === 'schema' && body.schema.trim() ? ' •' : ''}
              </Button>
            ))}
          </HStack>
        ) : null}

        {body.media !== 'none' && jsonEditor ? (
          <HStack gap="2px" ml="auto">
            <Button
              size="xs"
              variant="ghost"
              color="fg.muted"
              onClick={() => {
                const formatted = parseJsonContract(value);
                if (!formatted.ok || formatted.empty) return;
                setValue(formatted.formatted);
                editorRef.current?.setValue(formatted.formatted);
              }}
              data-testid={`${testId}-format`}
            >
              <AlignLeft size={13} />
              {t('json_contract_format')}
            </Button>
            <Button
              size="xs"
              variant="ghost"
              color="fg.muted"
              onClick={() => void editorRef.current?.getAction('editor.foldAll')?.run()}
            >
              {t('json_contract_fold')}
            </Button>
            <Button
              size="xs"
              variant="ghost"
              color="fg.muted"
              onClick={() => void editorRef.current?.getAction('editor.unfoldAll')?.run()}
            >
              {t('json_contract_unfold')}
            </Button>
          </HStack>
        ) : null}
      </HStack>

      {body.media === 'none' ? (
        <Text fontSize="sm" color="fg.subtle">
          {t('http_body_none_hint')}
        </Text>
      ) : jsonEditor ? (
        <Box
          h={`${EDITOR_HEIGHT}px`}
          borderWidth="1px"
          borderColor={parsed && !parsed.ok ? 'red.solid' : 'border.input'}
          borderRadius="md"
          overflow="hidden"
          bg={surface}
        >
          <Suspense fallback={<LoadingSkeleton variant="code" />}>
            <MonacoEditor
              height={EDITOR_HEIGHT}
              language="json"
              theme={themeName}
              value={value}
              path={`inmemory://http-contract/${modelId}/${activeTab}.json`}
              onChange={(v) => setValue(v ?? '')}
              onMount={handleMount}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                folding: true,
                showFoldingControls: 'always',
                automaticLayout: true,
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                tabSize: 2,
                padding: { top: 12, bottom: 12 },
                overviewRulerLanes: 0,
              }}
            />
          </Suspense>
        </Box>
      ) : (
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label={t('http_body_example')}
          fontFamily="mono"
          fontSize="13px"
          w="full"
          h={`${EDITOR_HEIGHT}px`}
          p="12px"
          borderWidth="1px"
          borderColor="border.input"
          borderRadius="md"
          bg={surface}
          color="fg.default"
          resize="vertical"
          outline="none"
          data-testid={`${testId}-text`}
        />
      )}

      {activeTab === 'schema' && body.media !== 'none' ? (
        <Text fontSize="xs" color="fg.subtle">
          {t('http_body_schema_hint')}
        </Text>
      ) : null}
    </VStack>
  );
}
