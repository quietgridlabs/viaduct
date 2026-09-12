import { DIALOG_PAD } from '@components/common/BaseEditDialog';
import {
  extractMessageName,
  GRPC_STREAM_KINDS,
  parseProtobufContract,
  serializeProtobufContract,
  validateProtobufContract,
  type GrpcStreamKind,
  type ProtobufContractSide,
} from '@components/common/ProtobufContract';
import {
  PROTOBUF_LANGUAGE_ID,
  protobufSurface,
  protobufThemeName,
  registerProtobufLanguage,
  registerProtobufThemes,
} from '@components/common/MonacoProtobuf';
import ThemedSelect from '@components/common/ThemedSelect';
import { useColorMode } from '@contexts/ColorModeContext';
import { useGlassSurface } from '@theme/glassSurfaces';
import { Box, Button, Dialog, HStack, Input, Portal, Text, VStack } from '@chakra-ui/react';
import type { OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { AlignLeft, Braces } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const MonacoEditor = lazy(() =>
  import('@monaco-editor/react').then((m) => ({ default: m.default }))
);

const EDITOR_HEIGHT = 420;

const SAMPLE_MESSAGE = `message ExampleRequest {
  string id = 1;
  string name = 2;
}`;

type Props = {
  open: boolean;
  side: ProtobufContractSide;
  title: string;
  initialValue: string;
  onApply: (next: string) => void;
  onClose: () => void;
};

/**
 * Centered protobuf contract editor — Monaco with protobuf highlighting and
 * syntax validation before the value is written back into the endpoint form.
 */
export default function ProtobufContractEditorDialog({
  open,
  side,
  title,
  initialValue,
  onApply,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const { mode } = useColorMode();
  const glass = useGlassSurface();
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);

  const seeded = useMemo(() => parseProtobufContract(initialValue, side), [initialValue, side]);
  const [name, setName] = useState(seeded.name);
  const [stream, setStream] = useState<GrpcStreamKind>(seeded.stream);
  const [source, setSource] = useState(seeded.source || SAMPLE_MESSAGE);
  const sourceRef = useRef(source);
  sourceRef.current = source;

  useEffect(() => {
    if (!open) return;
    const next = parseProtobufContract(initialValue, side);
    setName(next.name);
    setStream(next.stream);
    setSource(next.source || SAMPLE_MESSAGE);
  }, [open, initialValue, side]);

  const contract = useMemo(
    () => ({
      side,
      mode: 'protobuf' as const,
      name: name.trim() || extractMessageName(source),
      source,
      stream,
    }),
    [side, name, source, stream]
  );
  const validation = validateProtobufContract(contract);
  const themeName = protobufThemeName(mode);
  const surface = protobufSurface(mode);

  const streamOptions = useMemo(
    () =>
      GRPC_STREAM_KINDS.map((kind) => ({
        value: kind,
        label: t(`grpc_stream_${kind}`),
      })),
    [t]
  );

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
      'protobuf',
      validation.markers.map((marker) => ({
        startLineNumber: marker.line,
        startColumn: marker.column,
        endLineNumber: marker.line,
        endColumn: marker.endColumn,
        message: marker.message,
        severity:
          marker.severity === 'error'
            ? monaco.MarkerSeverity.Error
            : monaco.MarkerSeverity.Warning,
      }))
    );
  }, [validation.markers, open]);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    registerProtobufThemes(monaco);
    registerProtobufLanguage(monaco);
    monaco.editor.setTheme(themeName);
    const sync = () => {
      editor.layout();
      const text = sourceRef.current;
      if (editor.getValue() !== text) editor.setValue(text);
      editor.focus();
    };
    sync();
    requestAnimationFrame(sync);
    window.setTimeout(sync, 50);
  };

  const formatDraft = () => {
    const next = source
      .split('\n')
      .map((line) => line.replace(/\s+$/, ''))
      .join('\n')
      .trim();
    setSource(next);
    editorRef.current?.setValue(next);
    if (!name.trim()) {
      const extracted = extractMessageName(next);
      if (extracted) setName(extracted);
    }
  };

  const handleApply = () => {
    if (!validation.ok) return;
    const extracted = name.trim() || extractMessageName(source);
    onApply(
      serializeProtobufContract({
        ...contract,
        name: extracted,
      })
    );
    onClose();
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(details) => {
        if (!details.open) onClose();
      }}
      size="xl"
      placement="center"
    >
      <Portal>
        <Dialog.Backdrop bg={glass.backdrop} zIndex={1790} />
        <Dialog.Positioner zIndex={1800}>
          <Dialog.Content
            data-testid="protobuf-contract-dialog"
            color="fg.default"
            maxW="760px"
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
              <HStack gap="10px" align="center">
                <Braces size={18} />
                <Dialog.Title fontWeight="600">{title}</Dialog.Title>
              </HStack>
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
                {t('protobuf_contract_hint')}
              </Text>

              <HStack gap="10px" flexWrap="wrap" align="end">
                <Box flex="1" minW="180px">
                  <Text fontSize="xs" color="fg.muted" mb="4px">
                    {t('protobuf_message_name')}
                  </Text>
                  <Input
                    size="sm"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="GetUserRequest"
                    fontFamily="mono"
                    data-testid="protobuf-message-name"
                  />
                </Box>
                {side === 'request' ? (
                  <Box w="200px" flexShrink={0}>
                    <Text fontSize="xs" color="fg.muted" mb="4px">
                      {t('protobuf_streaming')}
                    </Text>
                    <ThemedSelect
                      size="sm"
                      ariaLabel={t('protobuf_streaming')}
                      options={streamOptions}
                      value={stream}
                      onChange={(v) => setStream(v as GrpcStreamKind)}
                      data-testid="protobuf-stream"
                    />
                  </Box>
                ) : null}
              </HStack>

              <HStack gap="6px" flexWrap="wrap">
                <Button
                  size="xs"
                  variant="ghost"
                  color="fg.muted"
                  onClick={formatDraft}
                  data-testid="protobuf-format"
                >
                  <AlignLeft size={13} />
                  {t('json_contract_format')}
                </Button>
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
                    language={PROTOBUF_LANGUAGE_ID}
                    theme={themeName}
                    value={source}
                    path={`inmemory://protobuf-${side}.proto`}
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
                      : 'fg.muted'
                    : 'red.fg'
                }
                data-testid="protobuf-validation"
              >
                {!validation.ok
                  ? t('protobuf_contract_invalid', { error: validation.error })
                  : validation.warnings.length
                    ? validation.warnings[0]
                    : source.trim()
                      ? t('protobuf_contract_valid')
                      : t('protobuf_contract_empty_ok')}
              </Text>
            </Dialog.Body>

            <Dialog.Footer px={DIALOG_PAD.footerPx} py={DIALOG_PAD.footerPy} gap="8px">
              <Button variant="ghost" onClick={onClose}>
                {t('cancel')}
              </Button>
              <Button
                colorPalette="brand"
                onClick={handleApply}
                disabled={!validation.ok}
                data-testid="protobuf-apply"
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
