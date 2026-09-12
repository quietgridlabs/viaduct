import { DIALOG_PAD } from '@components/common/BaseEditDialog';
import {
  SAMPLE_AVRO_RECORD,
  isJsonishFormat,
  parseChannelSchema,
  serializeChannelSchema,
  validateChannelSchema,
  type ChannelSchemaSide,
} from '@components/common/ChannelContract';
import {
  jsonSurface,
  jsonThemeName,
  registerJsonThemes,
} from '@components/common/MonacoJsonTheme';
import {
  PROTOBUF_LANGUAGE_ID,
  protobufSurface,
  protobufThemeName,
  registerProtobufLanguage,
  registerProtobufThemes,
} from '@components/common/MonacoProtobuf';
import type { ChannelSchemaFormat } from '@/types/c4Extensions';
import { useColorMode } from '@contexts/ColorModeContext';
import { useGlassSurface } from '@theme/glassSurfaces';
import { Box, Button, Dialog, HStack, Portal, Text, VStack } from '@chakra-ui/react';
import type { OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { AlignLeft, Braces } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const MonacoEditor = lazy(() =>
  import('@monaco-editor/react').then((m) => ({ default: m.default }))
);

/** Fixed px — percentage height inside a freshly-opened dialog measures as 0. */
const EDITOR_HEIGHT = 420;

const SAMPLE_PROTO = `message ExampleEvent {
  string id = 1;
}`;

type Props = {
  open: boolean;
  side: ChannelSchemaSide;
  title: string;
  format: ChannelSchemaFormat;
  initialValue: string;
  onApply: (next: string) => void;
  onClose: () => void;
};

function seedSource(raw: string, side: ChannelSchemaSide, format: ChannelSchemaFormat): string {
  const parsed = parseChannelSchema(raw, side, format);
  if (parsed.source.trim()) {
    if (isJsonishFormat(format)) {
      try {
        return JSON.stringify(JSON.parse(parsed.source), null, 2);
      } catch {
        return parsed.source;
      }
    }
    return parsed.source;
  }
  return format === 'protobuf' ? SAMPLE_PROTO : SAMPLE_AVRO_RECORD;
}

/**
 * Centered channel schema editor — same glass dialog + Monaco positioning as
 * ProtobufContractEditorDialog. Avro / JSON Schema / CloudEvents highlight as
 * JSON; protobuf uses the protobuf language pack.
 */
export default function ChannelSchemaEditorDialog({
  open,
  side,
  title,
  format,
  initialValue,
  onApply,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const { mode } = useColorMode();
  const glass = useGlassSurface();
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);

  const jsonish = isJsonishFormat(format);
  const [source, setSource] = useState(() => seedSource(initialValue, side, format));
  const sourceRef = useRef(source);
  sourceRef.current = source;

  useEffect(() => {
    if (!open) return;
    setSource(seedSource(initialValue, side, format));
  }, [open, initialValue, side, format]);

  const liveContract = useMemo(() => {
    const fromInitial = parseChannelSchema(initialValue, side, format);
    const fromSource = parseChannelSchema(source, side, format);
    return {
      side,
      format,
      name: fromSource.name || fromInitial.name,
      source,
    };
  }, [side, format, initialValue, source]);

  const validation = validateChannelSchema(liveContract);
  const themeName = jsonish ? jsonThemeName(mode) : protobufThemeName(mode);
  const surface = jsonish ? jsonSurface(mode) : protobufSurface(mode);

  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco || !open) return;
    monaco.editor.setTheme(themeName);
  }, [themeName, open]);

  useEffect(() => {
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    if (!monaco || !editor || !open) return;
    const model = editor.getModel();
    if (!model) return;
    monaco.editor.setModelMarkers(
      model,
      'channel-schema',
      validation.markers.map((marker) => ({
        startLineNumber: marker.line,
        startColumn: marker.column,
        endLineNumber: marker.line,
        endColumn: marker.endColumn,
        message: marker.message,
        severity:
          marker.severity === 'warning'
            ? monaco.MarkerSeverity.Warning
            : monaco.MarkerSeverity.Error,
      }))
    );
  }, [validation, open]);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    if (jsonish) {
      registerJsonThemes(monaco);
    } else {
      registerProtobufLanguage(monaco);
      registerProtobufThemes(monaco);
    }
    monaco.editor.setTheme(themeName);
    const sync = () => {
      editor.layout();
      const text = sourceRef.current;
      if (editor.getValue() !== text) {
        editor.setValue(text);
      }
      editor.focus();
    };
    sync();
    requestAnimationFrame(sync);
    window.setTimeout(sync, 50);
  };

  const formatDraft = () => {
    if (!jsonish) return;
    try {
      const pretty = JSON.stringify(JSON.parse(source), null, 2);
      setSource(pretty);
      editorRef.current?.setValue(pretty);
    } catch {
      /* keep draft — validation already shows the parse error */
    }
  };

  const foldAll = () => {
    void editorRef.current?.getAction('editor.foldAll')?.run();
  };

  const unfoldAll = () => {
    void editorRef.current?.getAction('editor.unfoldAll')?.run();
  };

  const apply = () => {
    if (!validation.ok) return;
    let body = source.trim();
    if (jsonish && body) {
      try {
        body = JSON.stringify(JSON.parse(body), null, 2);
      } catch {
        /* already validated */
      }
    }
    const next = parseChannelSchema(initialValue, side, format);
    next.format = format;
    next.source = body;
    if (!next.name) {
      next.name = parseChannelSchema(body, side, format).name;
    }
    onApply(body ? serializeChannelSchema(next) : '');
    onClose();
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(d) => {
        if (!d.open) onClose();
      }}
      placement="center"
      size="xl"
    >
      <Portal>
        <Dialog.Backdrop bg={glass.backdrop} zIndex={1790} />
        <Dialog.Positioner zIndex={1800}>
          <Dialog.Content
            data-testid="channel-schema-dialog"
            color="fg.default"
            maxW="720px"
            w="calc(100% - 32px)"
            maxH="min(860px, calc(100dvh - 48px))"
            display="flex"
            flexDirection="column"
            {...glass.dialog}
          >
            <Dialog.Header
              px={DIALOG_PAD.headerPx}
              pt={DIALOG_PAD.headerPt}
              pb={DIALOG_PAD.headerPb}
            >
              <Dialog.Title fontWeight="600">{title}</Dialog.Title>
            </Dialog.Header>

            <Dialog.Body
              px={DIALOG_PAD.bodyPx}
              pt="0"
              pb="8px"
              flex="1"
              minH={0}
              display="flex"
              flexDirection="column"
              gap="10px"
            >
              <Text fontSize="sm" color="fg.muted" lineHeight="1.5">
                {t('channel_schema_hint', { format })}
              </Text>

              <HStack gap="6px" flexWrap="wrap">
                {jsonish ? (
                  <>
                    <Button
                      size="xs"
                      variant="ghost"
                      color="fg.muted"
                      onClick={formatDraft}
                      disabled={!validation.ok || !source.trim()}
                    >
                      <AlignLeft size={13} />
                      {t('json_contract_format')}
                    </Button>
                    <Button size="xs" variant="ghost" color="fg.muted" onClick={foldAll}>
                      {t('json_contract_fold')}
                    </Button>
                    <Button size="xs" variant="ghost" color="fg.muted" onClick={unfoldAll}>
                      {t('json_contract_unfold')}
                    </Button>
                  </>
                ) : null}
              </HStack>

              <Box
                h={`${EDITOR_HEIGHT}px`}
                borderWidth="1px"
                borderColor={validation.ok ? 'border.input' : 'red.solid'}
                borderRadius="md"
                overflow="hidden"
                bg={surface}
              >
                <Suspense
                  fallback={
                    <VStack h="full" justify="center" color="fg.subtle" gap="8px">
                      <Braces size={22} />
                      <Text fontSize="sm">{t('json_contract_loading')}</Text>
                    </VStack>
                  }
                >
                  <MonacoEditor
                    height={EDITOR_HEIGHT}
                    language={jsonish ? 'json' : PROTOBUF_LANGUAGE_ID}
                    theme={themeName}
                    value={source}
                    path={`inmemory://channel-${side}-${format}.${jsonish ? 'json' : 'proto'}`}
                    onChange={(value) => setSource(value ?? '')}
                    onMount={handleMount}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      lineNumbers: 'on',
                      folding: true,
                      foldingHighlight: true,
                      showFoldingControls: 'always',
                      automaticLayout: true,
                      scrollBeyondLastLine: false,
                      wordWrap: 'on',
                      tabSize: 2,
                      renderLineHighlight: 'line',
                      padding: { top: 12, bottom: 12 },
                      overviewRulerLanes: 0,
                      scrollbar: {
                        verticalScrollbarSize: 8,
                        horizontalScrollbarSize: 8,
                      },
                    }}
                  />
                </Suspense>
              </Box>

              <Text
                fontSize="xs"
                color={
                  validation.ok
                    ? validation.warnings.length
                      ? 'orange.fg'
                      : 'fg.subtle'
                    : 'red.fg'
                }
                minH="1.2em"
                fontFamily={validation.ok ? undefined : 'mono'}
                data-testid="channel-schema-validation"
              >
                {!validation.ok
                  ? t('channel_schema_invalid_detail', {
                      error: validation.error || t('channel_schema_invalid'),
                    })
                  : validation.warnings.length
                    ? validation.warnings[0]
                    : source.trim()
                      ? t('channel_schema_valid', { format })
                      : t('json_contract_empty_ok')}
              </Text>
            </Dialog.Body>

            <Dialog.Footer
              gap="8px"
              px={DIALOG_PAD.footerPx}
              py={DIALOG_PAD.footerPy}
              justifyContent="flex-end"
            >
              <Button
                variant="ghost"
                color="fg.muted"
                onClick={onClose}
                data-testid="channel-schema-cancel"
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={apply}
                disabled={!validation.ok}
                data-testid="channel-schema-apply"
                bg="bg.neutral.emphasis"
                color="fg.onNeutral"
                _hover={{ bg: 'bg.neutral.emphasis.hover' }}
              >
                {t('json_contract_apply')}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
