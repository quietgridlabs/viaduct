import { DIALOG_PAD } from '@components/common/BaseEditDialog';
import {
  parseChannelSchema,
  summarizeChannelSchema,
  type ChannelSchemaSide,
} from '@components/common/ChannelContract';
import MethodChip from '@components/common/MethodChip';
import JsonViewer from '@components/common/JsonViewer';
import ProtoViewer from '@components/common/ProtoViewer';
import { ToolbarIconButton, TOOLBAR_ICON_SIZE } from '@components/common/ToolbarIconButton';
import {
  channelSurfaceLabel,
  normalizeChannelProtocol,
  normalizeChannelSchemaFormat,
  type ChannelExtras,
} from '@/types/c4Extensions';
import { containerChannels, type ChannelElement } from '@utils/channelCatalog';
import { downloadChannelContract } from '@utils/channelContractExport';
import { useGlassSurface } from '@theme/glassSurfaces';
import { useFlatC4Store } from '@archivisio/c4-modelizer-sdk';
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
import { ChevronDown, ChevronRight, Download, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import {
  closeChannelContract,
  getChannelContractTarget,
  subscribeChannelContract,
} from '../UiState';

/** A real <button>: `Box as="button"` drops the button props in Chakra v3. */
const RowButton = chakra('button');

/** Delegates to the shared badge; the overlay only has to normalise first. */
function ProtocolChip({ protocol }: { protocol: string }) {
  return <MethodChip method={normalizeChannelProtocol(protocol)} />;
}

function SchemaBody({
  side,
  raw,
  format,
  modelId,
  emptyLabel,
}: {
  side: ChannelSchemaSide;
  raw: string;
  format: string;
  modelId: string;
  emptyLabel: string;
}) {
  const { t } = useTranslation();
  if (!raw.trim()) {
    return (
      <Text fontSize="sm" color="fg.subtle">
        {emptyLabel}
      </Text>
    );
  }
  const contract = parseChannelSchema(raw, side, normalizeChannelSchemaFormat(format));

  if (contract.format === 'protobuf') {
    return contract.source.trim() ? (
      <ProtoViewer value={contract.source} modelId={modelId} />
    ) : (
      <Text fontSize="sm" color="fg.subtle">
        {t('json_contract_none')}
      </Text>
    );
  }

  let jsonValue: unknown = contract.source;
  try {
    jsonValue = JSON.parse(contract.source);
  } catch {
    /* show as raw text via JsonViewer string path */
  }

  return contract.source.trim() ? (
    <JsonViewer value={jsonValue} modelId={modelId} />
  ) : (
    <Text fontSize="sm" color="fg.subtle">
      {t('json_contract_none')}
    </Text>
  );
}

type SchemaSectionId = ChannelSchemaSide;

/**
 * Key / value / headers fold independently — comparing value with headers is
 * the point, so this is not an accordion.
 */
function SchemaSection({
  id,
  title,
  raw,
  format,
  modelId,
  open,
  onToggle,
}: {
  id: SchemaSectionId;
  title: string;
  raw: string;
  format: string;
  modelId: string;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const hasBody = Boolean(raw.trim());
  const preview = summarizeChannelSchema(raw, t('json_contract_none'));

  return (
    <Box
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
        onClick={onToggle}
        _hover={{ bg: 'bg.list.hover' }}
        data-testid={`channel-contract-section-${id}`}
      >
        <Box color="fg.muted" flexShrink={0} display="flex">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </Box>
        <Text fontSize="sm" fontWeight="600">
          {title}
        </Text>
        <Box flex="1" />
        <Text
          fontSize="xs"
          color={hasBody ? 'fg.muted' : 'fg.subtle'}
          fontFamily="mono"
          flexShrink={0}
          truncate
          maxW="50%"
        >
          {preview}
        </Text>
      </RowButton>
      {open ? (
        <Box px="8px" pb="8px">
          <SchemaBody
            side={id}
            raw={raw}
            format={format}
            modelId={modelId}
            emptyLabel={t('json_contract_none')}
          />
        </Box>
      ) : null}
    </Box>
  );
}

function ChannelView({ channel }: { channel: ChannelElement }) {
  const { t } = useTranslation();
  const extras = channel as ChannelExtras;
  const protocol = normalizeChannelProtocol(extras.protocol);
  const format = normalizeChannelSchemaFormat(extras.schemaFormat);
  const surface = channelSurfaceLabel(protocol);
  const compatibility = extras.compatibility?.trim();

  const sections: Array<{ id: SchemaSectionId; title: string; raw: string }> = [
    { id: 'key', title: t('channel_key_schema'), raw: extras.keySchema || '' },
    { id: 'value', title: t('channel_value_schema'), raw: extras.valueSchema || '' },
    { id: 'headers', title: t('channel_headers_schema'), raw: extras.headersSchema || '' },
  ];

  /* Value with a body starts open; empty sides stay collapsed. Independent
     toggles so key/headers can sit next to value without scrolling forever. */
  const [openSections, setOpenSections] = useState<Set<SchemaSectionId>>(() => new Set());
  useEffect(() => {
    const next = new Set<SchemaSectionId>();
    if ((extras.valueSchema || '').trim()) next.add('value');
    else if ((extras.keySchema || '').trim()) next.add('key');
    else if ((extras.headersSchema || '').trim()) next.add('headers');
    setOpenSections(next);
    // Only when the reader moves to another channel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel.id]);

  const toggle = (id: SchemaSectionId) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <VStack align="stretch" gap="14px" minW={0}>
      <HStack gap="8px" align="center" flexWrap="wrap">
        <ProtocolChip protocol={protocol} />
        <Text fontSize="xs" fontWeight="700" color="fg.subtle" letterSpacing="0.04em">
          {surface}
        </Text>
        <Text fontFamily="mono" fontSize="sm" fontWeight="600" wordBreak="break-all">
          {channel.name}
        </Text>
      </HStack>

      {channel.description ? (
        <Text fontSize="sm" color="fg.muted" whiteSpace="pre-wrap">
          {channel.description}
        </Text>
      ) : null}

      <HStack gap="12px" flexWrap="wrap">
        <Text fontSize="xs" color="fg.muted">
          {t('channel_schema_format')}:{' '}
          <Box as="span" fontFamily="mono" color="fg.default">
            {format}
          </Box>
        </Text>
        {compatibility ? (
          <Text fontSize="xs" color="fg.muted">
            {t('channel_compatibility')}:{' '}
            <Box as="span" fontFamily="mono" color="fg.default">
              {compatibility}
            </Box>
          </Text>
        ) : null}
      </HStack>

      <VStack align="stretch" gap="8px">
        {sections.map((section) => (
          <SchemaSection
            key={section.id}
            id={section.id}
            title={section.title}
            raw={section.raw}
            format={format}
            modelId={`${channel.id}-${section.id}`}
            open={openSections.has(section.id)}
            onToggle={() => toggle(section.id)}
          />
        ))}
      </VStack>
    </VStack>
  );
}

/**
 * Broker channel contracts: topics down the left, key/value/headers on the
 * right — same split as the service OpenAPI viewer, without leaving the
 * container canvas.
 */
export default function ChannelContractOverlay() {
  const { t } = useTranslation();
  const glass = useGlassSurface();
  const target = useSyncExternalStore(subscribeChannelContract, getChannelContractTarget);
  const model = useFlatC4Store((s) => s.model);

  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const channels = useMemo(
    () => (target ? containerChannels(model, target.containerId) : []),
    [model, target]
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return channels;
    return channels.filter((ch) => {
      const extras = ch as ChannelExtras;
      return `${ch.name} ${ch.description || ''} ${extras.protocol || ''} ${extras.schemaFormat || ''}`
        .toLowerCase()
        .includes(needle);
    });
  }, [channels, query]);

  useEffect(() => {
    if (!target) {
      setSelected(null);
      setQuery('');
      return;
    }
    setQuery('');
    if (target.channelId) setSelected(target.channelId);
    // Intentionally keyed on identity fields only — other target props must not reset the picker.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- target.containerId / channelId
  }, [target?.containerId, target?.channelId]);

  useEffect(() => {
    if (!filtered.length) {
      setSelected(null);
      return;
    }
    if (!selected || !filtered.some((ch) => ch.id === selected)) {
      setSelected(filtered[0].id);
    }
  }, [filtered, selected]);

  const current =
    filtered.find((ch) => ch.id === selected) || filtered[0] || null;

  const subtitle = t('channel_contract_subtitle', { count: channels.length });

  if (!target) return null;

  return (
    <Dialog.Root
      open
      onOpenChange={(d) => {
        if (!d.open) closeChannelContract();
      }}
      placement="center"
      size="xl"
    >
      <Portal>
        <Dialog.Backdrop bg={glass.backdrop} zIndex={1790} />
        <Dialog.Positioner zIndex={1800}>
          <Dialog.Content
            data-testid="channel-contract-dialog"
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
                  <Button
                    size="xs"
                    variant="outline"
                    borderColor="border.strong"
                    onClick={() => {
                      if (current) downloadChannelContract(current);
                    }}
                    disabled={!current}
                    data-testid="channel-contract-export"
                  >
                    <Download size={13} />
                    {t('channel_contract_export')}
                  </Button>
                  <ToolbarIconButton
                    onClick={closeChannelContract}
                    aria-label={t('close')}
                    title={t('close')}
                    data-testid="channel-contract-close"
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
                      placeholder={t('channel_contract_search')}
                      aria-label={t('channel_contract_search')}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      data-testid="channel-contract-search"
                    />
                  </HStack>

                  <VStack align="stretch" gap="2px" overflowY="auto" flex="1" minH={0}>
                    {filtered.map((ch) => {
                      const active = ch.id === selected;
                      const extras = ch as ChannelExtras;
                      const protocol = normalizeChannelProtocol(extras.protocol);
                      const surface = channelSurfaceLabel(protocol);
                      return (
                        <Box
                          key={ch.id}
                          as="button"
                          textAlign="left"
                          px="8px"
                          py="6px"
                          borderRadius="md"
                          bg={active ? 'bg.list.selected' : 'transparent'}
                          _hover={{ bg: active ? 'bg.list.selected' : 'bg.list.hover' }}
                          onClick={() => setSelected(ch.id)}
                          data-testid={`channel-contract-item-${ch.id}`}
                          w="full"
                        >
                          <HStack gap="6px" align="center" minW={0}>
                            <ProtocolChip protocol={protocol} />
                            <Text fontSize="xs" fontFamily="mono" truncate>
                              {ch.name}
                            </Text>
                          </HStack>
                          <Text fontSize="xs" color="fg.muted" truncate mt="2px">
                            {surface}
                            {ch.description ? ` · ${ch.description}` : ''}
                          </Text>
                        </Box>
                      );
                    })}
                    {!filtered.length ? (
                      <Text fontSize="sm" color="fg.subtle" p="8px">
                        {t('channel_contract_empty')}
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
                    <ChannelView channel={current} />
                  ) : (
                    <Text fontSize="sm" color="fg.subtle">
                      {t('channel_contract_empty')}
                    </Text>
                  )}
                </Box>
              </HStack>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
