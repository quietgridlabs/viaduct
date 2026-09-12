import { useFlatC4Store, type ContainerBlock } from '@archivisio/c4-modelizer-sdk';
import { DIALOG_PAD } from '@components/common/BaseEditDialog';
import QuackSpinner from '@components/QuackSpinner';
import JsonViewer from '@components/common/JsonViewer';
import ConfirmDialog from '@components/common/ConfirmDialog';
import MethodChip from '@components/common/MethodChip';
import ProtoViewer from '@components/common/ProtoViewer';
import { ToolbarIconButton, TOOLBAR_ICON_SIZE } from '@components/common/ToolbarIconButton';
import { useGlassSurface } from '@theme/glassSurfaces';
import {
  removeOperationFromDocument,
  operationKey,
  applyImportedDocument,
  buildGrpcProtoFiles,
  buildServiceDocument,
  containerEndpoints,
  documentJson,
  documentProtocolMix,
  exportFileName,
  exportServiceDocument,
  parseServiceDocument,
  refreshServiceContract,
  serviceMetaFor,
  storedDocument,
  toPayload,
  viewerOperations,
  type OpenApiDocument,
  type ViewerOperation,
} from '@utils/serviceContract';
import { zipSync, strToU8 } from 'fflate';
import { useAuth } from '@contexts/AuthContext';
import { stampAuditCreate, stampAuditUpdate } from '@utils/audit';
import {
  Box,
  Button,
  chakra,
  Dialog,
  HStack,
  Input,
  Portal,
  Text,
  VStack,
} from '@chakra-ui/react';
import { Trash2,
  Braces,
  ChevronDown,
  ChevronRight,
  Download,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import {
  closeServiceContract,
  getServiceContractTarget,
  subscribeServiceContract,
} from '../UiState';

/** A real <button>: `Box as="button"` drops the button props in Chakra v3. */
const RowButton = chakra('button');

/** Payloads are read with the editor's highlighting and folding, not as text. */
function JsonBlock({ value, modelId }: { value: unknown; modelId: string }) {
  return <JsonViewer value={value} modelId={modelId} />;
}

/** Protobuf source — same Monaco highlighting as the contract editor. */
function ProtoBlock({ value, modelId }: { value: string; modelId: string }) {
  if (!value.trim()) return null;
  return <ProtoViewer value={value} modelId={modelId} />;
}

function newElementId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ep_${Math.random().toString(36).slice(2, 12)}`;
}

/** Imported endpoints land under whatever the container already shows. */
function nextEndpointPosition(existing: Array<{ position?: { x: number; y: number } }>) {
  const bottom = existing.reduce(
    (max, element) => Math.max(max, element.position?.y ?? 0),
    0
  );
  return { x: 0, y: existing.length ? bottom + 160 : 0 };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Text fontSize="xs" fontWeight="700" color="fg.subtle" mb="6px">
        {label}
      </Text>
      {children}
    </Box>
  );
}

/** Parameters of an operation, as the table a reader expects. */
function ParameterTable({ parameters }: { parameters: unknown[] }) {
  const { t } = useTranslation();
  const rows = parameters.filter(
    (p): p is Record<string, unknown> => typeof p === 'object' && p !== null
  );
  if (!rows.length) return null;

  return (
    <Field label={t('service_contract_parameters')}>
      <VStack align="stretch" gap="4px">
        {rows.map((param, index) => {
          const schema =
            typeof param.schema === 'object' && param.schema !== null
              ? (param.schema as Record<string, unknown>)
              : {};
          return (
            <HStack
              key={`${String(param.name)}-${index}`}
              gap="8px"
              align="baseline"
              flexWrap="wrap"
              borderWidth="1px"
              borderColor="border.input"
              borderRadius="md"
              px="8px"
              py="6px"
              bg="bg.subtle"
            >
              <Text fontFamily="mono" fontSize="sm" fontWeight="600">
                {String(param.name)}
              </Text>
              <Text fontSize="xs" color="fg.muted" fontFamily="mono">
                {String(schema.type || 'string')}
              </Text>
              <Text fontSize="xs" color="fg.subtle" fontFamily="mono">
                in: {String(param.in)}
              </Text>
              {param.required ? (
                <Text fontSize="xs" color="orange.fg">
                  {t('http_param_required')}
                </Text>
              ) : null}
              {param.example !== undefined ? (
                <Text fontSize="xs" color="fg.muted" fontFamily="mono">
                  = {typeof param.example === 'string' ? param.example : JSON.stringify(param.example)}
                </Text>
              ) : null}
              {param.description ? (
                <Text fontSize="xs" color="fg.muted">
                  {String(param.description)}
                </Text>
              ) : null}
            </HStack>
          );
        })}
      </VStack>
    </Field>
  );
}

function ContentView({
  content,
  label,
  modelId,
}: {
  content: unknown;
  label: string;
  modelId: string;
}) {
  if (typeof content !== 'object' || content === null) return null;
  const entries = Object.entries(content as Record<string, unknown>);
  if (!entries.length) return null;

  return (
    <>
      {entries.map(([media, raw]) => {
        const entry = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
        return (
          <Field key={media} label={`${label} · ${media}`}>
            <VStack align="stretch" gap="6px">
              {entry.example !== undefined ? (
                <JsonBlock value={entry.example} modelId={`${modelId}-${media}-example`} />
              ) : null}
              {entry.schema !== undefined ? (
                <JsonBlock value={entry.schema} modelId={`${modelId}-${media}-schema`} />
              ) : null}
            </VStack>
          </Field>
        );
      })}
    </>
  );
}

function OperationView({ item }: { item: ViewerOperation }) {
  const { t } = useTranslation();
  const [raw, setRaw] = useState(false);
  const op = item.operation;
  const isGrpc = item.kind === 'grpc';
  const responses =
    typeof op.responses === 'object' && op.responses !== null
      ? (op.responses as Record<string, unknown>)
      : {};
  const messages = Array.isArray(op.messages) ? op.messages : null;
  const grpcRequest =
    isGrpc && typeof op.request === 'object' && op.request !== null
      ? (op.request as { name?: string; proto?: string })
      : null;
  const grpcResponse =
    isGrpc && typeof op.response === 'object' && op.response !== null
      ? (op.response as { name?: string; proto?: string })
      : null;
  const streaming = isGrpc && typeof op.streaming === 'string' ? op.streaming : null;

  /* A single payload can be hundreds of lines, so the replies collapse and the
     success one starts open — the list of statuses stays readable either way.
     Independent toggles, not an accordion: comparing 200 with 4xx is the whole
     reason to look at more than one. */
  const [openResponses, setOpenResponses] = useState<Set<string>>(new Set());
  useEffect(() => {
    const first = Object.keys(responses)[0];
    setOpenResponses(new Set(first ? [first] : []));
    /* Only when the reader moves to another operation. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.key]);

  const toggleResponse = (code: string) => {
    setOpenResponses((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  return (
    <VStack align="stretch" gap="14px" minW={0}>
      <HStack gap="8px" align="center" flexWrap="wrap">
        <MethodChip method={item.method} />
        <Text fontFamily="mono" fontSize="sm" fontWeight="600" wordBreak="break-all">
          {item.path}
        </Text>
        {streaming && streaming !== 'unary' ? (
          <Text fontSize="xs" color="fg.muted" fontFamily="mono">
            {t(`grpc_stream_${streaming}`, { defaultValue: streaming })}
          </Text>
        ) : null}
        <Box flex="1" />
        <Button
          size="xs"
          variant={raw ? 'solid' : 'ghost'}
          bg={raw ? 'bg.muted' : undefined}
          color={raw ? 'fg.default' : 'fg.muted'}
          onClick={() => setRaw((prev) => !prev)}
          data-testid="service-contract-raw"
        >
          <Braces size={13} />
          {t('service_contract_raw')}
        </Button>
      </HStack>

      {item.summary ? <Text fontWeight="600">{item.summary}</Text> : null}
      {item.description ? (
        <Text fontSize="sm" color="fg.muted" whiteSpace="pre-wrap">
          {item.description}
        </Text>
      ) : null}

      {raw ? (
        <JsonBlock value={op} modelId={`${item.key}-raw`} />
      ) : isGrpc ? (
        <>
          <Field
            label={
              grpcRequest?.name
                ? `${t('endpoint_grpc_request')} · ${grpcRequest.name}`
                : t('endpoint_grpc_request')
            }
          >
            {grpcRequest?.proto?.trim() ? (
              <ProtoBlock
                value={grpcRequest.proto}
                modelId={`${item.key}-grpc-request`}
              />
            ) : (
              <Text fontSize="sm" color="fg.subtle">
                {t('json_contract_none')}
              </Text>
            )}
          </Field>
          <Field
            label={
              grpcResponse?.name
                ? `${t('endpoint_grpc_response')} · ${grpcResponse.name}`
                : t('endpoint_grpc_response')
            }
          >
            {grpcResponse?.proto?.trim() ? (
              <ProtoBlock
                value={grpcResponse.proto}
                modelId={`${item.key}-grpc-response`}
              />
            ) : (
              <Text fontSize="sm" color="fg.subtle">
                {t('json_contract_none')}
              </Text>
            )}
          </Field>
        </>
      ) : (
        <>
          {Array.isArray(op.parameters) ? <ParameterTable parameters={op.parameters} /> : null}

          {typeof op.requestBody === 'object' && op.requestBody !== null ? (
            <ContentView
              content={(op.requestBody as Record<string, unknown>).content}
              label={t('service_contract_request_body')}
              modelId={`${item.key}-request`}
            />
          ) : null}

          {messages ? (
            <Field label={t('http_messages')}>
              <VStack align="stretch" gap="8px">
                {messages.map((rawMsg, index) => {
                  const message = (typeof rawMsg === 'object' && rawMsg !== null ? rawMsg : {}) as Record<
                    string,
                    unknown
                  >;
                  return (
                    <Box
                      key={`${String(message.name)}-${index}`}
                      borderWidth="1px"
                      borderColor="border.input"
                      borderRadius="md"
                      p="8px"
                      bg="bg.subtle"
                    >
                      <Text fontFamily="mono" fontSize="sm" fontWeight="600">
                        {String(message.name || '—')}
                      </Text>
                      {message.description ? (
                        <Text fontSize="xs" color="fg.muted" mt="2px">
                          {String(message.description)}
                        </Text>
                      ) : null}
                      <Box mt="6px">
                        <ContentView
                          content={message.content}
                          label={t('http_body')}
                          modelId={`${item.key}-message-${index}`}
                        />
                      </Box>
                    </Box>
                  );
                })}
              </VStack>
            </Field>
          ) : null}

          {Object.keys(responses).length ? (
            <Field label={t('http_responses')}>
              <VStack align="stretch" gap="10px">
                {Object.entries(responses).map(([code, rawResp]) => {
                  const entry = (typeof rawResp === 'object' && rawResp !== null ? rawResp : {}) as Record<
                    string,
                    unknown
                  >;
                  const status = Number(code);
                  const color =
                    status >= 500
                      ? 'red.fg'
                      : status >= 400
                        ? 'orange.fg'
                        : status >= 200
                          ? 'green.fg'
                          : 'fg.muted';
                  const open = openResponses.has(code);
                  const media = Object.keys(
                    (typeof entry.content === 'object' && entry.content !== null
                      ? entry.content
                      : {}) as Record<string, unknown>
                  )[0];
                  return (
                    <Box
                      key={code}
                      borderWidth="1px"
                      borderColor="border.input"
                      borderRadius="md"
                      bg="bg.subtle"
                      overflow="hidden"
                    >
                      <RowButton
                        type="button"
                        display="flex"
                        alignItems="center"
                        gap="8px"
                        w="full"
                        px="8px"
                        py="8px"
                        textAlign="left"
                        bg="transparent"
                        cursor="pointer"
                        aria-expanded={open}
                        onClick={() => toggleResponse(code)}
                        _hover={{ bg: 'bg.list.hover' }}
                        data-testid={`service-contract-response-${code}`}
                      >
                        <Box color="fg.muted" flexShrink={0} display="flex">
                          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </Box>
                        <Text fontFamily="mono" fontWeight="700" fontSize="sm" color={color}>
                          {code}
                        </Text>
                        <Text fontSize="sm" color="fg.muted" truncate>
                          {String(entry.description || '')}
                        </Text>
                        <Box flex="1" />
                        {media ? (
                          <Text
                            fontSize="xs"
                            color="fg.subtle"
                            fontFamily="mono"
                            flexShrink={0}
                            truncate
                          >
                            {media}
                          </Text>
                        ) : null}
                      </RowButton>
                      {open ? (
                        <Box px="8px" pb="8px">
                          <ContentView
                            content={entry.content}
                            label={t('http_body')}
                            modelId={`${item.key}-response-${code}`}
                          />
                        </Box>
                      ) : null}
                    </Box>
                  );
                })}
              </VStack>
            </Field>
          ) : null}
        </>
      )}
    </VStack>
  );
}

/**
 * The whole contract of one service, read from its OpenAPI document: the
 * endpoints down the left, the operation the reader picked in the middle.
 */
export default function ServiceContractOverlay() {
  const { t } = useTranslation();
  const glass = useGlassSurface();
  const target = useSyncExternalStore(subscribeServiceContract, getServiceContractTarget);
  const model = useFlatC4Store((s) => s.model);
  const setModel = useFlatC4Store((s) => s.setModel);
  const updateContainer = useFlatC4Store((s) => s.updateContainer);
  const removeComponent = useFlatC4Store((s) => s.removeComponent);
  const { user } = useAuth();

  const [doc, setDoc] = useState<OpenApiDocument | null>(null);
  /* Same document with its `$ref`s followed. Everything on screen reads this;
     `doc` is what gets stored and exported, so shared components stay shared. */
  const [resolved, setResolved] = useState<OpenApiDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ updated: number; added: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [pendingRemoval, setPendingRemoval] = useState<ViewerOperation | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const container = useMemo(
    () => (target ? model.containers.find((c) => c.id === target.containerId) : undefined),
    [model.containers, target]
  );

  const endpoints = useMemo(
    () => (target ? containerEndpoints(model, target.containerId) : []),
    [model, target]
  );

  /* Rebuild from canvas when the owner is local; otherwise show the OpenAPI
     projected onto a remote clone card. */
  useEffect(() => {
    if (!target) return;
    let alive = true;
    setBusy(true);
    setError(null);

    const finish = (
      next: OpenApiDocument | null,
      message?: string,
      followed?: OpenApiDocument | null
    ) => {
      if (!alive) return;
      setDoc(next);
      setResolved(followed ?? next);
      setError(message || null);
      setBusy(false);
    };

    if (container) {
      buildServiceDocument(
        endpoints.map(toPayload),
        serviceMetaFor(container as ContainerBlock),
        storedDocument(container as ContainerBlock) || target.openapi
      )
        .then(({ doc: next, resolved: followed }) => finish(next, undefined, followed))
        .catch((err: Error) => finish(null, err.message));
    } else if (target.openapi?.trim()) {
      try {
        finish(JSON.parse(target.openapi) as OpenApiDocument);
      } catch (err) {
        finish(null, err instanceof Error ? err.message : String(err));
      }
    } else {
      finish(null);
    }

    return () => {
      alive = false;
    };
    /* `endpoints` is derived from the model and would re-run this on every
       unrelated model touch; the container id is what identifies the service. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.containerId, container?.name, target?.openapi]);

  /* Opened from the node menu's "Import OpenAPI": the viewer is only the shell
     the picker needs, so go straight to the file dialog. Keyed on the target so
     reopening the same container asks again, and closing does not re-fire. */
  const importRequestedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!target?.autoImport) {
      importRequestedFor.current = null;
      return;
    }
    if (importRequestedFor.current === target.containerId) return;
    importRequestedFor.current = target.containerId;
    fileInput.current?.click();
  }, [target?.autoImport, target?.containerId]);

  const operations = useMemo(() => viewerOperations(resolved), [resolved]);
  const mix = useMemo(() => documentProtocolMix(resolved), [resolved]);
  const hasGrpc = mix.grpc > 0;
  const hasHttpish = mix.http > 0 || mix.websocket > 0;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return operations;
    return operations.filter((op) =>
      `${op.method} ${op.path} ${op.summary} ${op.tags.join(' ')}`.toLowerCase().includes(needle)
    );
  }, [operations, query]);

  const grouped = useMemo(() => {
    const order: Array<{ kind: ViewerOperation['kind']; label: string }> = [
      { kind: 'http', label: t('endpoint_method_http') },
      { kind: 'websocket', label: t('endpoint_method_websocket') },
      { kind: 'grpc', label: t('endpoint_method_grpc') },
    ];
    return order
      .map((section) => ({
        ...section,
        items: filtered.filter((op) => op.kind === section.kind),
      }))
      .filter((section) => section.items.length > 0);
  }, [filtered, t]);

  useEffect(() => {
    if (!filtered.length) {
      setSelected(null);
      return;
    }
    if (!selected || !filtered.some((op) => op.key === selected)) {
      setSelected(filtered[0].key);
    }
  }, [filtered, selected]);

  const current = filtered.find((op) => op.key === selected) || null;

  const subtitle = useMemo(() => {
    const parts: string[] = [];
    if (mix.http) parts.push(t('service_contract_count_http', { count: mix.http }));
    if (mix.websocket) parts.push(t('service_contract_count_websocket', { count: mix.websocket }));
    if (mix.grpc) parts.push(t('service_contract_count_grpc', { count: mix.grpc }));
    if (!parts.length) {
      return t('service_contract_subtitle', {
        count: 0,
        version: doc?.info?.version || '—',
      });
    }
    return t('service_contract_subtitle_mixed', {
      parts: parts.join(' · '),
      version: doc?.info?.version || '—',
    });
  }, [mix, doc?.info?.version, t]);

  /* Pure HTTP/WS → OpenAPI JSON. With gRPC → ZIP (openapi.json + .proto files). */
  const exportDocument = async () => {
    if (!target || !doc) return;
    setError(null);
    try {
      const serviceName = container?.name || target.containerName || 'service';
      if (!hasGrpc) {
        if (container) {
          const blob = await exportServiceDocument(
            endpoints.map(toPayload),
            serviceMetaFor(container as ContainerBlock),
            storedDocument(container as ContainerBlock) || target.openapi
          );
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = exportFileName(serviceName);
          link.click();
          URL.revokeObjectURL(url);
          return;
        }
        const blob = new Blob([documentJson(doc)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = exportFileName(serviceName);
        link.click();
        URL.revokeObjectURL(url);
        return;
      }

      const files: Record<string, Uint8Array> = {
        /* Keep the full document so a re-import still sees x-grpc / x-channels. */
        'openapi.json': strToU8(documentJson(doc)),
      };
      const protos = buildGrpcProtoFiles(doc);
      for (const file of protos) {
        files[file.filename] = strToU8(file.content);
      }
      const zipped = zipSync(files, { level: 6 });
      const slug =
        serviceName
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'service';
      const url = URL.createObjectURL(
        new Blob([new Uint8Array(zipped)], { type: 'application/zip' })
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `${slug}-contract.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  };

  /**
   * Import merges: an operation the file describes wins, one it is silent
   * about is left alone, and anything the canvas has never heard of arrives as
   * a new endpoint element under this container.
   */
  const importDocument = async (file: File) => {
    if (!target || !container) return;
    setBusy(true);
    setError(null);
    try {
      const json = await file.text();
      const { doc: merged, endpoints: imported, refErrors } = await parseServiceDocument(
        json,
        storedDocument(container as ContainerBlock)
      );

      const base = nextEndpointPosition(containerEndpoints(model, target.containerId));
      const outcome = applyImportedDocument(model, {
        containerId: target.containerId,
        imported,
        openapi: documentJson(merged),
        stamp: stampAuditUpdate(null, user),
        newElement: (index) => ({
          id: newElementId(),
          systemId: (container as ContainerBlock).systemId,
          technology: '',
          url: '',
          headers: '',
          position: { x: base.x, y: base.y + index * 120 },
          ...stampAuditCreate(user),
        }),
      });

      setModel(outcome.model);
      /* The file is only part of the service: endpoints it says nothing about
         are still on the canvas, so the contract is rebuilt over the merge. */
      const rebuilt = await refreshServiceContract(target.containerId, updateContainer);
      setDoc(rebuilt?.doc ?? merged);
      setResolved(rebuilt?.resolved ?? merged);
      /* A pointer that goes nowhere is the file's problem, not a failed import:
         say so, but keep everything the file did describe. */
      setError(refErrors?.length ? refErrors.join('; ') : null);
      setSummary({ updated: outcome.updated, added: outcome.added });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  /*
   * Delete an operation from here, which is the same act as deleting its
   * element on the canvas.
   *
   * A service's contract is two halves — the endpoint elements and the stored
   * document — and the merge that joins them keeps any stored path no element
   * claims, so that an imported spec may run ahead of the diagram. That rule
   * also made an imported operation impossible to remove: taking the element
   * away left the path behind with nothing pointing at it. Both halves go
   * together now, from whichever side you start.
   */
  const removeOperation = async (op: ViewerOperation) => {
    if (!target || !container) return;
    setPendingRemoval(null);
    setError(null);
    try {
      const stripped = removeOperationFromDocument(
        storedDocument(container as ContainerBlock),
        op
      );
      if (stripped) {
        updateContainer(target.containerId, { openapi: stripped } as Partial<ContainerBlock>);
      }
      const element = endpoints.find(
        (candidate) =>
          operationKey(candidate.endpoint || '/', candidate.method || 'GET') ===
          operationKey(op.path, op.method)
      );
      if (element) removeComponent(element.id);

      /* Rebuilt from what is left rather than patched in place: the same
         builder the viewer opened with, so the two cannot drift. */
      const rebuilt = await refreshServiceContract(target.containerId, updateContainer);
      if (rebuilt) {
        setDoc(rebuilt.doc);
        setResolved(rebuilt.resolved);
      }
      if (selected === op.key) setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  if (!target) return null;

  return (
    <Dialog.Root
      open
      onOpenChange={(d) => {
        if (!d.open) closeServiceContract();
      }}
      placement="center"
      size="xl"
    >
      <Portal>
        <Dialog.Backdrop bg={glass.backdrop} zIndex={1790} />
        <Dialog.Positioner zIndex={1800}>
          <Dialog.Content
            data-testid="service-contract-dialog"
            color="fg.default"
            maxW="1100px"
            w="calc(100% - 32px)"
            h="min(820px, calc(100dvh - 40px))"
            display="flex"
            flexDirection="column"
            {...glass.dialog}
          >
            <Dialog.Header
              px={DIALOG_PAD.headerPx}
              pt={DIALOG_PAD.headerPt}
              pb={DIALOG_PAD.headerPb}
            >
              <HStack justify="space-between" align="center" gap="10px" w="full" flexWrap="wrap">
                <VStack align="start" gap="2px" minW={0}>
                  <Dialog.Title fontWeight="600">{target.containerName}</Dialog.Title>
                  <Text fontSize="xs" color="fg.muted">
                    {subtitle}
                  </Text>
                </VStack>
                <HStack gap="6px">
                  {container && (hasHttpish || !hasGrpc) ? (
                    <Button
                      size="xs"
                      variant="outline"
                      borderColor="border.strong"
                      onClick={() => fileInput.current?.click()}
                      data-testid="service-contract-import"
                    >
                      <Upload size={13} />
                      {t('service_contract_import')}
                    </Button>
                  ) : null}
                  <Button
                    size="xs"
                    variant="outline"
                    borderColor="border.strong"
                    onClick={() => void exportDocument()}
                    disabled={!doc}
                    data-testid="service-contract-export"
                  >
                    <Download size={13} />
                    {hasGrpc
                      ? t('service_contract_export_bundle')
                      : t('service_contract_export')}
                  </Button>
                  <Input
                    ref={fileInput}
                    type="file"
                    accept="application/json,application/yaml,.json,.yaml,.yml"
                    display="none"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) void importDocument(file);
                    }}
                  />
                  <ToolbarIconButton
                    onClick={closeServiceContract}
                    aria-label={t('close')}
                    title={t('close')}
                    data-testid="service-contract-close"
                  >
                    <X size={TOOLBAR_ICON_SIZE} />
                  </ToolbarIconButton>
                </HStack>
              </HStack>
            </Dialog.Header>

            <Dialog.Body
              px={DIALOG_PAD.bodyPx}
              pt="0"
              pb="12px"
              flex="1"
              minH={0}
              display="flex"
              flexDirection="column"
              gap="10px"
            >
              {error ? (
                <Text fontSize="sm" color="red.fg" data-testid="service-contract-error">
                  {t('service_contract_failed', { error })}
                </Text>
              ) : null}

              {summary ? (
                <Text fontSize="sm" color="green.fg" data-testid="service-contract-imported">
                  {t('service_contract_imported', summary)}
                </Text>
              ) : null}

              {busy && !doc ? (
                <VStack flex="1" justify="center" gap="10px">
                  <QuackSpinner size={40} />
                  <Text fontSize="sm" color="fg.muted">
                    {t('service_contract_loading')}
                  </Text>
                </VStack>
              ) : (
                <HStack align="stretch" gap="12px" flex="1" minH={0}>
                  <VStack
                    align="stretch"
                    gap="6px"
                    w={{ base: '200px', md: '280px' }}
                    flexShrink={0}
                    minH={0}
                  >
                    <HStack
                      gap="6px"
                      borderWidth="1px"
                      borderColor="border.input"
                      borderRadius="md"
                      px="8px"
                      flexShrink={0}
                    >
                      <Search size={13} />
                      <Input
                        size="sm"
                        variant="flushed"
                        border="none"
                        placeholder={t('service_contract_search')}
                        aria-label={t('service_contract_search')}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        data-testid="service-contract-search"
                      />
                    </HStack>

                    <VStack align="stretch" gap="2px" overflowY="auto" flex="1" minH={0}>
                      {grouped.map((section) => (
                        <Box key={section.kind}>
                          {grouped.length > 1 ? (
                            <Text
                              fontSize="10px"
                              fontWeight="700"
                              color="fg.subtle"
                              letterSpacing="0.06em"
                              textTransform="uppercase"
                              px="8px"
                              pt="8px"
                              pb="4px"
                            >
                              {section.label}
                            </Text>
                          ) : null}
                          {section.items.map((op) => {
                            const active = op.key === selected;
                            return (
                              <HStack
                                key={op.key}
                                gap="2px"
                                align="center"
                                borderRadius="md"
                                bg={active ? 'bg.list.selected' : 'transparent'}
                                _hover={{
                                  bg: active ? 'bg.list.selected' : 'bg.list.hover',
                                  '& [data-op-remove]': { opacity: 1 },
                                }}
                              >
                                <Box
                                  as="button"
                                  textAlign="left"
                                  px="8px"
                                  py="6px"
                                  flex="1"
                                  minW={0}
                                  onClick={() => setSelected(op.key)}
                                  data-testid={`service-contract-item-${op.key}`}
                                >
                                  <HStack gap="6px" align="center" minW={0}>
                                    <MethodChip method={op.method} />
                                    <Text fontSize="xs" fontFamily="mono" truncate>
                                      {op.path}
                                    </Text>
                                  </HStack>
                                  {op.summary ? (
                                    <Text fontSize="xs" color="fg.muted" truncate mt="2px">
                                      {op.summary}
                                    </Text>
                                  ) : null}
                                </Box>
                                {/* Only where the service is in this model —
                                    the same condition import already carries,
                                    since both write to the container. */}
                                {container ? (
                                  <Box
                                    as="button"
                                    data-op-remove=""
                                    aria-label={t('delete')}
                                    title={t('delete')}
                                    px="6px"
                                    py="6px"
                                    lineHeight={0}
                                    color="fg.muted"
                                    opacity={0}
                                    _hover={{ color: 'red.400' }}
                                    _focusVisible={{ opacity: 1 }}
                                    onClick={() => setPendingRemoval(op)}
                                    data-testid={`service-contract-remove-${op.key}`}
                                  >
                                    <Trash2 size={13} />
                                  </Box>
                                ) : null}
                              </HStack>
                            );
                          })}
                        </Box>
                      ))}
                      {!filtered.length ? (
                        <Text fontSize="sm" color="fg.subtle" p="8px">
                          {t('service_contract_empty')}
                        </Text>
                      ) : null}
                    </VStack>
                  </VStack>

                  <Box
                    flex="1"
                    minW={0}
                    overflowY="auto"
                    borderLeftWidth="1px"
                    borderColor="border.default"
                    pl="12px"
                  >
                    {current ? (
                      <OperationView item={current} />
                    ) : (
                      <Text fontSize="sm" color="fg.subtle">
                        {t('service_contract_empty')}
                      </Text>
                    )}
                  </Box>
                </HStack>
              )}
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
      <ConfirmDialog
        open={Boolean(pendingRemoval)}
        title={t('service_contract_remove_title')}
        content={t('service_contract_remove_confirm', {
          method: pendingRemoval?.method || '',
          path: pendingRemoval?.path || '',
        })}
        confirmText={t('delete')}
        onCancel={() => setPendingRemoval(null)}
        onConfirm={() => {
          if (pendingRemoval) void removeOperation(pendingRemoval);
        }}
      />
    </Dialog.Root>
  );
}
