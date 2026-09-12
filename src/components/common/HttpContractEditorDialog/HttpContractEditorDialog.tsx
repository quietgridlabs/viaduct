import { DIALOG_PAD } from '@components/common/BaseEditDialog';
import HttpBodyEditor from '@components/common/HttpBodyEditor';
import HttpParamRows from '@components/common/HttpParamRows';
import {
  COMMON_STATUS_CODES,
  QUICK_STATUS_CODES,
  derivePathParams,
  newMessage,
  newResponse,
  parseHttpContract,
  serializeHttpContract,
  statusClass,
  statusTextFor,
  syncPathParams,
  validateHttpContract,
  type HttpBody,
  type HttpContract,
  type HttpContractSide,
  type HttpMessage,
  type HttpParam,
  type HttpParamIn,
  type HttpRequestContract,
  type HttpResponseContract,
  type HttpResponseItem,
} from '@components/common/HttpContract';
import ThemedSelect from '@components/common/ThemedSelect';
import { useGlassSurface } from '@theme/glassSurfaces';
import MethodChip from '@components/common/MethodChip';
import {
  Badge,
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
import { AlertTriangle, ChevronDown, ChevronRight, Plus, Trash2, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  open: boolean;
  side: HttpContractSide;
  title: string;
  initialValue: string;
  /** Endpoint path — path parameters are checked against it. */
  path?: string;
  /** Method badge in the header; `WS`/`WSS` switches to the channel editor. */
  method?: string;
  channel?: boolean;
  onApply: (next: string) => void;
  onClose: () => void;
};

/** A real <button> with Chakra styling — `Box as="button"` loses the button props. */
const RowButton = chakra('button');

const STATUS_COLORS: Record<ReturnType<typeof statusClass>, string> = {
  success: 'green.fg',
  redirect: 'blue.fg',
  client: 'orange.fg',
  server: 'red.fg',
  info: 'fg.muted',
};

function Section({
  label,
  hint,
  action,
  children,
}: {
  label: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box>
      <HStack justify="space-between" align="center" gap="8px" mb="4px" flexWrap="wrap">
        <Text fontSize="sm" fontWeight="600">
          {label}
        </Text>
        {action}
      </HStack>
      {hint ? (
        <Text fontSize="xs" color="fg.subtle" mb="8px">
          {hint}
        </Text>
      ) : null}
      {children}
    </Box>
  );
}

type TabDef<Id extends string> = {
  id: Id;
  label: string;
  /** Rendered as a pill after the label — how much is filled in under that tab. */
  count?: number;
  /** For tabs that are either set or not, like the body's media type. */
  badge?: string;
};

/**
 * The parts of a call sit side by side rather than stacked: an endpoint with a
 * body and three kinds of parameter is a long scroll otherwise, and the tab
 * strip doubles as a summary of what is already filled in.
 */
function TabStrip<Id extends string>({
  tabs,
  active,
  onSelect,
  testId,
}: {
  tabs: TabDef<Id>[];
  active: Id;
  onSelect: (id: Id) => void;
  testId: string;
}) {
  /* No overflow on the strip: the tabs overlap its bottom border by a pixel to
     sit on it, and an `overflow: auto` box would grow a scrollbar over that
     pixel. A handful of tabs has nothing to scroll anyway — they wrap. */
  return (
    <HStack
      gap="2px"
      borderBottomWidth="1px"
      borderColor="border.default"
      mb="12px"
      flexWrap="wrap"
      role="tablist"
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <RowButton
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(tab.id)}
            display="flex"
            alignItems="center"
            gap="6px"
            flexShrink={0}
            px="10px"
            py="7px"
            bg="transparent"
            cursor="pointer"
            fontSize="sm"
            fontWeight={selected ? '600' : '500'}
            color={selected ? 'fg.default' : 'fg.muted'}
            borderBottomWidth="2px"
            borderColor={selected ? 'border.brand.emphasis' : 'transparent'}
            mb="-1px"
            _hover={{ color: 'fg.default' }}
            data-testid={`${testId}-tab-${tab.id}`}
          >
            {tab.label}
            {tab.count ? (
              <Badge
                borderRadius="full"
                bg="bg.muted"
                color="fg.muted"
                fontSize="10px"
                fontWeight="700"
                fontFamily="mono"
                px="5px"
              >
                {tab.count}
              </Badge>
            ) : null}
            {tab.badge ? (
              <Text as="span" color="fg.subtle" fontSize="10px" fontFamily="mono">
                {tab.badge}
              </Text>
            ) : null}
          </RowButton>
        );
      })}
    </HStack>
  );
}

/** Status code picker: a dropdown of the codes with names, plus quick picks. */
function StatusPicker({
  status,
  onChange,
  taken,
  testId,
}: {
  status: number;
  onChange: (next: number) => void;
  taken: number[];
  testId: string;
}) {
  const { t } = useTranslation();
  const options = useMemo(
    () =>
      COMMON_STATUS_CODES.map((code) => ({
        value: String(code),
        label: `${code} ${statusTextFor(code)}`,
        group:
          code < 300
            ? t('http_status_group_success')
            : code < 400
              ? t('http_status_group_redirect')
              : code < 500
                ? t('http_status_group_client')
                : t('http_status_group_server'),
      })),
    [t]
  );

  const known = COMMON_STATUS_CODES.includes(status);

  return (
    <HStack gap="6px" flexWrap="wrap" align="center">
      <Box w="210px" flexShrink={0}>
        <ThemedSelect
          size="sm"
          ariaLabel={t('http_status')}
          options={options}
          value={known ? String(status) : ''}
          placeholder={t('http_status_custom')}
          onChange={(next) => onChange(Number(next))}
          data-testid={`${testId}-select`}
        />
      </Box>
      <Input
        size="sm"
        type="number"
        min={100}
        max={599}
        w="84px"
        flexShrink={0}
        fontFamily="mono"
        aria-label={t('http_status_code')}
        value={Number.isFinite(status) ? status : ''}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
        data-testid={`${testId}-code`}
      />
      <Text fontSize="xs" color="fg.subtle" fontFamily="mono">
        {statusTextFor(status, t('http_status_custom'))}
      </Text>
      {taken.includes(status) ? (
        <Text fontSize="xs" color="red.fg">
          {t('http_status_duplicate')}
        </Text>
      ) : null}
    </HStack>
  );
}

function ResponseCard({
  response,
  expanded,
  onToggle,
  onChange,
  onRemove,
  takenStatuses,
  canRemove,
  index,
}: {
  response: HttpResponseItem;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<HttpResponseItem>) => void;
  onRemove: () => void;
  takenStatuses: number[];
  canRemove: boolean;
  index: number;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'body' | 'headers'>('body');
  const color = STATUS_COLORS[statusClass(response.status)];

  return (
    <Box
      borderWidth="1px"
      borderColor="border.default"
      borderRadius="md"
      bg="bg.subtle"
      overflow="hidden"
      data-testid={`http-response-${index}`}
    >
      <HStack gap="0" w="full" pr="6px" _hover={{ bg: 'bg.list.hover' }}>
        {/* The row toggles, the bin deletes: two buttons side by side rather
            than one nested in the other, which no browser allows. */}
        <RowButton
          type="button"
          display="flex"
          alignItems="center"
          gap="8px"
          flex="1"
          minW={0}
          px="10px"
          py="8px"
          textAlign="left"
          cursor="pointer"
          bg="transparent"
          onClick={onToggle}
          aria-expanded={expanded}
          data-testid={`http-response-${index}-toggle`}
        >
          <Box color="fg.muted" flexShrink={0} display="flex">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </Box>
          <Text fontFamily="mono" fontWeight="700" fontSize="sm" color={color} flexShrink={0}>
            {response.status}
          </Text>
          <Text fontSize="sm" color="fg.muted" truncate>
            {response.description.trim() || statusTextFor(response.status, t('http_status_custom'))}
          </Text>
          <Box flex="1" />
          {response.body.media !== 'none' ? (
            <Text fontSize="xs" color="fg.subtle" fontFamily="mono" flexShrink={0}>
              {response.body.media}
            </Text>
          ) : null}
        </RowButton>
        {canRemove ? (
          <Button
            size="xs"
            variant="ghost"
            color="fg.muted"
            flexShrink={0}
            aria-label={t('http_response_remove')}
            onClick={onRemove}
            data-testid={`http-response-${index}-remove`}
          >
            <Trash2 size={13} />
          </Button>
        ) : null}
      </HStack>

      {expanded ? (
        <VStack align="stretch" gap="12px" px="10px" pb="12px" pt="4px">
          <StatusPicker
            status={response.status}
            onChange={(status) => onChange({ status })}
            taken={takenStatuses}
            testId={`http-response-${index}-status`}
          />
          <Input
            size="sm"
            placeholder={t('http_response_description_placeholder')}
            aria-label={t('http_response_description')}
            value={response.description}
            onChange={(e) => onChange({ description: e.target.value })}
            data-testid={`http-response-${index}-description`}
          />
          <Box>
            <TabStrip
              testId={`http-response-${index}`}
              active={tab}
              onSelect={setTab}
              tabs={[
                {
                  id: 'body' as const,
                  label: t('http_tab_body'),
                  badge: response.body.media === 'none' ? undefined : response.body.media,
                },
                {
                  id: 'headers' as const,
                  label: t('http_tab_headers'),
                  count: response.headers.filter((h) => h.name.trim()).length,
                },
              ]}
            />
            {tab === 'headers' ? (
              <HttpParamRows
                where="header"
                params={response.headers}
                onChange={(headers) => onChange({ headers })}
                namePlaceholder="X-Request-Id"
                testId={`http-response-${index}-header`}
              />
            ) : (
              <HttpBodyEditor
                body={response.body}
                onChange={(patch) => onChange({ body: { ...response.body, ...patch } })}
                modelId={`response-${response.id}`}
                testId={`http-response-${index}-body`}
              />
            )}
          </Box>
        </VStack>
      ) : null}
    </Box>
  );
}

function MessageCard({
  message,
  onChange,
  onRemove,
  index,
}: {
  message: HttpMessage;
  onChange: (patch: Partial<HttpMessage>) => void;
  onRemove: () => void;
  index: number;
}) {
  const { t } = useTranslation();
  return (
    <VStack
      align="stretch"
      gap="10px"
      borderWidth="1px"
      borderColor="border.default"
      borderRadius="md"
      bg="bg.subtle"
      p="10px"
      data-testid={`http-message-${index}`}
    >
      <HStack gap="6px" flexWrap="wrap">
        <Input
          size="sm"
          flex="1 1 160px"
          fontFamily="mono"
          placeholder={t('http_message_name')}
          aria-label={t('http_message_name')}
          value={message.name}
          onChange={(e) => onChange({ name: e.target.value })}
          data-testid={`http-message-${index}-name`}
        />
        <Input
          size="sm"
          flex="2 1 200px"
          placeholder={t('http_message_description')}
          aria-label={t('http_message_description')}
          value={message.description}
          onChange={(e) => onChange({ description: e.target.value })}
          data-testid={`http-message-${index}-description`}
        />
        <Button
          size="xs"
          variant="ghost"
          color="fg.muted"
          aria-label={t('http_message_remove')}
          onClick={onRemove}
          data-testid={`http-message-${index}-remove`}
        >
          <Trash2 size={13} />
        </Button>
      </HStack>
      <HttpBodyEditor
        body={message.body}
        onChange={(patch) => onChange({ body: { ...message.body, ...patch } })}
        modelId={`message-${message.id}`}
        testId={`http-message-${index}-body`}
      />
    </VStack>
  );
}

type RequestTab = 'path' | 'query' | 'headers' | 'body';

/**
 * Which tab to land on: whatever the call already describes, otherwise the
 * part it most likely needs — path parameters when the URL declares any.
 */
function openingTab(contract: HttpContract, path?: string): RequestTab {
  if (contract.mode !== 'http' || contract.side !== 'request') return 'query';
  const has = (where: HttpParamIn) =>
    contract.params.some((p) => p.in === where && p.name.trim());
  if (has('path')) return 'path';
  if (has('query')) return 'query';
  if (contract.body.media !== 'none') return 'body';
  if (has('header')) return 'headers';
  return derivePathParams(path || '').length ? 'path' : 'query';
}

/**
 * Endpoint contract editor, shaped after an OpenAPI operation: typed
 * parameters on the request side, one card per status on the response side,
 * and a message list when the endpoint is a WebSocket channel.
 */
export default function HttpContractEditorDialog({
  open,
  side,
  title,
  initialValue,
  path,
  method,
  channel = false,
  onApply,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const glass = useGlassSurface();
  const [contract, setContract] = useState<HttpContract>(() =>
    parseHttpContract(initialValue, side, { channel })
  );
  const [expandedResponse, setExpandedResponse] = useState<string | null>(null);
  const [requestTab, setRequestTab] = useState<RequestTab>('query');

  useEffect(() => {
    if (!open) return;
    const parsed = parseHttpContract(initialValue, side, { channel });
    setContract(parsed);
    setExpandedResponse(
      parsed.mode === 'http' && parsed.side === 'response' ? (parsed.responses[0]?.id ?? null) : null
    );
    setRequestTab(openingTab(parsed, path));
    /* `path` is read when the dialog opens — not a dependency. Resetting the
       whole contract on every path keystroke in the parent endpoint form wiped
       in-progress edits, including the required flag on parameters. */
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open-time snapshot of path
  }, [open, initialValue, side, channel]);

  const validation = validateHttpContract(contract, { path });
  const pathParams = useMemo(() => derivePathParams(path || ''), [path]);

  const apply = () => {
    if (!validation.ok) return;
    onApply(serializeHttpContract(contract));
    onClose();
  };

  const setRequest = (patch: Partial<HttpRequestContract>) =>
    setContract((prev) =>
      prev.mode === 'http' && prev.side === 'request' ? { ...prev, ...patch } : prev
    );

  const setResponses = (next: HttpResponseItem[]) =>
    setContract((prev) =>
      prev.mode === 'http' && prev.side === 'response'
        ? ({ ...prev, responses: next } as HttpResponseContract)
        : prev
    );

  const setMessages = (next: HttpMessage[]) =>
    setContract((prev) => (prev.mode === 'channel' ? { ...prev, messages: next } : prev));

  const paramsIn = (where: HttpParamIn) =>
    contract.mode === 'http' && contract.side === 'request'
      ? contract.params.filter((p) => p.in === where)
      : [];

  /** Only filled-in rows count towards a tab's badge — a blank row is not data. */
  const named = (where: HttpParamIn) => paramsIn(where).filter((p) => p.name.trim());

  const replaceParams = (where: HttpParamIn, next: HttpParam[]) => {
    setContract((prev) => {
      if (prev.mode !== 'http' || prev.side !== 'request') return prev;
      const order: HttpParamIn[] = ['path', 'query', 'header'];
      const merged = order.flatMap((slot) =>
        slot === where ? next : prev.params.filter((p) => p.in === slot)
      );
      return { ...prev, params: merged };
    });
  };

  const setBody = (patch: Partial<HttpBody>) => {
    if (contract.mode !== 'http' || contract.side !== 'request') return;
    setRequest({ body: { ...contract.body, ...patch } });
  };

  const missingPathParams =
    contract.mode === 'http' && contract.side === 'request'
      ? pathParams.filter(
          (name) =>
            !contract.params.some(
              (p) => p.in === 'path' && p.name.trim().toLowerCase() === name.toLowerCase()
            )
        )
      : [];

  const responses =
    contract.mode === 'http' && contract.side === 'response' ? contract.responses : [];

  const addResponse = (status: number) => {
    const created = newResponse(status);
    setResponses([...responses, created]);
    setExpandedResponse(created.id);
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
            data-testid="http-contract-dialog"
            color="fg.default"
            maxW="820px"
            w="calc(100% - 32px)"
            maxH="min(900px, calc(100dvh - 40px))"
            display="flex"
            flexDirection="column"
            {...glass.dialog}
          >
            <Dialog.Header
              px={DIALOG_PAD.headerPx}
              pt={DIALOG_PAD.headerPt}
              pb={DIALOG_PAD.headerPb}
            >
              <VStack align="stretch" gap="6px" w="full">
                <Dialog.Title fontWeight="600">{title}</Dialog.Title>
                {method || path ? (
                  <HStack gap="6px" minW={0}>
                    {method ? <MethodChip method={method} /> : null}
                    {path ? (
                      <Text fontSize="xs" fontFamily="mono" color="fg.muted" truncate>
                        {path}
                      </Text>
                    ) : null}
                  </HStack>
                ) : null}
              </VStack>
            </Dialog.Header>

            <Dialog.Body
              px={DIALOG_PAD.bodyPx}
              pt="0"
              pb="8px"
              flex="1"
              minH={0}
              overflowY="auto"
              display="flex"
              flexDirection="column"
              gap="16px"
            >
              <Text fontSize="sm" color="fg.muted" lineHeight="1.5">
                {channel
                  ? t('http_channel_hint')
                  : side === 'request'
                    ? t('http_request_hint')
                    : t('http_response_hint')}
              </Text>

              {contract.mode === 'channel' ? (
                <Section label={t('http_messages')} hint={t('http_messages_hint')}>
                  <VStack align="stretch" gap="10px">
                    {contract.messages.map((message, index) => (
                      <MessageCard
                        key={message.id}
                        message={message}
                        index={index}
                        onChange={(patch) =>
                          setMessages(
                            contract.messages.map((m) =>
                              m.id === message.id ? { ...m, ...patch } : m
                            )
                          )
                        }
                        onRemove={() =>
                          setMessages(contract.messages.filter((m) => m.id !== message.id))
                        }
                      />
                    ))}
                    <Button
                      size="xs"
                      variant="outline"
                      borderColor="border.strong"
                      alignSelf="flex-start"
                      onClick={() => setMessages([...contract.messages, newMessage()])}
                      data-testid="http-message-add"
                    >
                      <Plus size={13} />
                      {t('http_message_add')}
                    </Button>
                  </VStack>
                </Section>
              ) : contract.side === 'request' ? (
                <Box>
                  <TabStrip
                    testId="http-request"
                    active={requestTab}
                    onSelect={setRequestTab}
                    tabs={[
                      {
                        id: 'path' as const,
                        label: t('http_tab_path'),
                        count: named('path').length,
                      },
                      {
                        id: 'query' as const,
                        label: t('http_tab_query'),
                        count: named('query').length,
                      },
                      {
                        id: 'headers' as const,
                        label: t('http_tab_headers'),
                        count: named('header').length,
                      },
                      {
                        id: 'body' as const,
                        label: t('http_tab_body'),
                        badge: contract.body.media === 'none' ? undefined : contract.body.media,
                      },
                    ]}
                  />

                  {requestTab === 'path' ? (
                    <Section
                      label={t('http_path_params')}
                      hint={t('http_path_params_hint')}
                      action={
                        missingPathParams.length ? (
                          <Button
                            size="xs"
                            variant="outline"
                            borderColor="border.strong"
                            onClick={() =>
                              setRequest({ params: syncPathParams(contract.params, path || '') })
                            }
                            data-testid="http-path-sync"
                          >
                            <Wand2 size={13} />
                            {t('http_path_sync', { count: missingPathParams.length })}
                          </Button>
                        ) : null
                      }
                    >
                      <HttpParamRows
                        where="path"
                        params={paramsIn('path')}
                        onChange={(next) => replaceParams('path', next)}
                        expected={pathParams.length ? pathParams : undefined}
                        namePlaceholder="id"
                        testId="http-path"
                      />
                    </Section>
                  ) : null}

                  {requestTab === 'query' ? (
                    <Section label={t('http_query')} hint={t('http_query_hint')}>
                      <HttpParamRows
                        where="query"
                        params={paramsIn('query')}
                        onChange={(next) => replaceParams('query', next)}
                        namePlaceholder="page"
                        testId="http-query"
                      />
                    </Section>
                  ) : null}

                  {requestTab === 'headers' ? (
                    <Section
                      label={t('http_request_headers')}
                      hint={t('http_request_headers_hint')}
                    >
                      <HttpParamRows
                        where="header"
                        params={paramsIn('header')}
                        onChange={(next) => replaceParams('header', next)}
                        namePlaceholder="Authorization"
                        testId="http-header"
                      />
                    </Section>
                  ) : null}

                  {requestTab === 'body' ? (
                    <Section label={t('http_body')}>
                      <HttpBodyEditor
                        body={contract.body}
                        onChange={setBody}
                        modelId="request"
                        testId="http-request-body"
                      />
                    </Section>
                  ) : null}
                </Box>
              ) : (
                <Section
                  label={t('http_responses')}
                  hint={t('http_responses_hint')}
                  action={
                    <HStack gap="4px" flexWrap="wrap">
                      {QUICK_STATUS_CODES.filter(
                        (code) => !responses.some((r) => r.status === code)
                      )
                        .slice(0, 6)
                        .map((code) => (
                          <Button
                            key={code}
                            size="xs"
                            variant="ghost"
                            color="fg.muted"
                            fontFamily="mono"
                            onClick={() => addResponse(code)}
                            data-testid={`http-response-add-${code}`}
                          >
                            <Plus size={11} />
                            {code}
                          </Button>
                        ))}
                    </HStack>
                  }
                >
                  <VStack align="stretch" gap="8px">
                    {responses.map((response, index) => (
                      <ResponseCard
                        key={response.id}
                        response={response}
                        index={index}
                        expanded={expandedResponse === response.id}
                        canRemove={responses.length > 1}
                        takenStatuses={responses
                          .filter((r) => r.id !== response.id)
                          .map((r) => r.status)}
                        onToggle={() =>
                          setExpandedResponse((prev) => (prev === response.id ? null : response.id))
                        }
                        onChange={(patch) =>
                          setResponses(
                            responses.map((r) => (r.id === response.id ? { ...r, ...patch } : r))
                          )
                        }
                        onRemove={() => setResponses(responses.filter((r) => r.id !== response.id))}
                      />
                    ))}
                  </VStack>
                </Section>
              )}

              <VStack align="stretch" gap="4px" minH="1.2em">
                {validation.ok ? null : (
                  <Text fontSize="xs" color="red.fg" fontFamily="mono">
                    {t('http_contract_invalid', { error: validation.error })}
                  </Text>
                )}
                {validation.warnings.map((warning) => (
                  <HStack key={warning} gap="6px" color="orange.fg">
                    <AlertTriangle size={12} />
                    <Text fontSize="xs">{warning}</Text>
                  </HStack>
                ))}
                {validation.ok && !validation.warnings.length ? (
                  <Text fontSize="xs" color="fg.subtle">
                    {t('http_contract_valid')}
                  </Text>
                ) : null}
              </VStack>
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
                data-testid="http-contract-cancel"
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={apply}
                disabled={!validation.ok}
                data-testid="http-contract-apply"
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
