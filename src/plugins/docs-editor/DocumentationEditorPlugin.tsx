import DocumentationPreview, { type ResolvedSequenceRef } from './DocumentationPreview';
import type { ChannelOption, ResolvedChannelRef } from './channelRefs';
import type { ResolvedUiRef, UiOption } from './uiRefs';
import InsertPickerDialog, { type PickerItem } from './InsertPickerDialog';
import InsertTableDialog from './InsertTableDialog';
import type { EndpointOption, ResolvedEndpointRef } from './endpointRefs';
import CollaborativeMarkdownEditor, { type MarkdownEditorHandle } from './CollaborativeMarkdownEditor';
import {
  formatChannelRefToken,
  formatUiRefToken,
  formatEndpointRefToken,
  formatMarkdownTableToken,
  formatSequenceRefToken,
} from './markdown';
import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Input,
  Menu,
  Portal,
  Select,
  Text,
  createListCollection,
} from '@chakra-ui/react';
import SidePanelShell from '@components/common/SidePanelShell';
import LoadingSkeleton from '@components/common/LoadingSkeleton';
import DocumentationListPanel, {
  DocumentationListSort,
  DocumentationListTitle,
} from './DocumentationListPanel';
import { parseDocListSortKey, type DocListItem, type DocListSortKey } from './docsList';
import PanelCollapseRail, { PanelCollapseStack } from '@components/common/PanelCollapseRail';
import GlassMenuContent from '@components/common/GlassMenuContent';
import { ToolbarIconButton, TOOLBAR_ICON_SIZE } from '@components/common/ToolbarIconButton';
import AuditMetaText from '@components/common/AuditMetaText';
import ConfirmDialog from '@components/common/ConfirmDialog';
import type { AuditExtras } from '@/types/c4Extensions';
import { usePaneRoom, useRubberOpen } from '@hooks/useRubberPane';
import { useGlassSurface } from '@theme/glassSurfaces';
import {
  APP_FOOTER_OFFSET,
  POPPER_LAYER_Z,
  SIDE_PANEL_INSET,
  WORKSPACE_CONTENT_TOP,
  WORKSPACE_EDITOR_OVERLAY_Z,
  WORKSPACE_EDITOR_Z,
} from '@theme/sidePanelLayout';
import {
  BookOpen,
  GitBranch,
  Plus,
  Frame,
  Radio,
  Route,
  Rows3,
  Save,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';


/** Sort choice outlives the session, the way the sequence list's does. */
const DOC_LIST_SORT_STORAGE_KEY = 'c4-documentation-list-sort';

export type BindTargetOption = {
  ownerType: 'system' | 'container' | 'component' | 'code';
  ownerId: string;
  label: string;
  group: string;
};

type SequenceOption = {
  id: string;
  name: string;
  plantUmlSource: string;
};

type Props = {
  title: string;
  markdown: string;
  /** Every documentation page in the project, for the list on the left. */
  listItems?: DocListItem[];
  selectedListId?: string | null;
  /** Manager open with nothing picked — list plus empty state, no document. */
  idle?: boolean;
  /** The document is still being fetched. */
  loading?: boolean;
  onSelectListItem?: (id: string) => void;
  onCreateDoc?: () => void;
  bindValue: string;
  bindTargets: BindTargetOption[];
  sequenceOptions: SequenceOption[];
  endpointOptions: EndpointOption[];
  channelOptions?: ChannelOption[];
  uiOptions?: UiOption[];
  resolveSequence: (id: string) => ResolvedSequenceRef | null;
  resolveEndpoint: (id: string) => ResolvedEndpointRef | null;
  resolveChannel?: (id: string) => ResolvedChannelRef | null;
  resolveUi?: (id: string) => ResolvedUiRef | null;
  onOpenSequence?: (ref: ResolvedSequenceRef) => void;
  onOpenEndpoint?: (ref: ResolvedEndpointRef) => void;
  onOpenChannel?: (ref: ResolvedChannelRef) => void;
  onOpenUi?: (ref: ResolvedUiRef) => void;
  /** Keep mounted but invisible (diagram peek). */
  hidden?: boolean;
  readOnly?: boolean;
  saving?: boolean;
  dirty?: boolean;
  /** Live multiplayer markdown — unused in Community. */
  collabMarkdown?: unknown;
  collabAwareness?: unknown;
  editingPeers?: Array<{ name: string; color: string }>;
  liveSync?: boolean;
  onTitleChange: (next: string) => void;
  onMarkdownChange: (next: string) => void;
  onBindChange: (ownerType: BindTargetOption['ownerType'], ownerId: string) => void;
  onSave: () => void;
  onDelete?: () => void;
  onClose: () => void;
  audit?: AuditExtras | null;
};

type InsertKind = 'table' | 'sequence' | 'endpoint' | 'channel' | 'ui';

type InsertCounts = { sequence: number; endpoint: number; channel: number; ui: number };

/**
 * One menu instead of four inline pickers. The count tells the author whether
 * a kind is worth opening before they open it, and a kind with nothing to
 * offer is disabled rather than hidden — absence is information too.
 */
const INSERT_MENU: {
  kind: InsertKind;
  icon: LucideIcon;
  labelKey: string;
  count: ((counts: InsertCounts) => number) | null;
}[] = [
  { kind: 'table', icon: Rows3, labelKey: 'documentation_table_insert', count: null },
  {
    kind: 'sequence',
    icon: GitBranch,
    labelKey: 'documentation_insert_sequence',
    count: (c) => c.sequence,
  },
  {
    kind: 'endpoint',
    icon: Route,
    labelKey: 'documentation_insert_endpoint',
    count: (c) => c.endpoint,
  },
  { kind: 'channel', icon: Radio, labelKey: 'documentation_insert_channel', count: (c) => c.channel },
  { kind: 'ui', icon: Frame, labelKey: 'documentation_insert_ui', count: (c) => c.ui },
];

function EditorSelectPositioner({ children }: { children: ReactNode }) {
  return (
    <Portal>
      <Select.Positioner zIndex={POPPER_LAYER_Z}>
        {children}
      </Select.Positioner>
    </Portal>
  );
}

export default function DocumentationEditorPlugin({
  title,
  markdown,
  listItems = [],
  selectedListId = null,
  idle = false,
  loading = false,
  onSelectListItem,
  onCreateDoc,
  bindValue,
  bindTargets,
  sequenceOptions,
  endpointOptions,
  channelOptions = [],
  uiOptions = [],
  resolveSequence,
  resolveEndpoint,
  resolveChannel,
  resolveUi,
  onOpenSequence,
  onOpenEndpoint,
  onOpenChannel,
  onOpenUi,
  hidden = false,
  readOnly,
  saving,
  dirty,
  collabMarkdown,
  collabAwareness,
  editingPeers = [],
  liveSync = false,
  onTitleChange,
  onMarkdownChange,
  onBindChange,
  onSave,
  onDelete,
  onClose,
  audit,
}: Props) {
  const { t } = useTranslation();
  const glass = useGlassSurface();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [insertKind, setInsertKind] = useState<InsertKind | null>(null);
  const [listOpen, setListOpen] = useState(true);
  const [listQuery, setListQuery] = useState('');
  const [listSort, setListSort] = useState<DocListSortKey>(() => {
    try {
      return parseDocListSortKey(localStorage.getItem(DOC_LIST_SORT_STORAGE_KEY));
    } catch {
      return 'updated';
    }
  });
  const room = usePaneRoom();
  const [codeOpen, setCodeOpen] = useRubberOpen(!readOnly && room.secondary);
  const [previewOpen, setPreviewOpen] = useState(true);
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const syncOriginRef = useRef<'none' | 'code' | 'preview'>('none');
  const syncUnlockTimerRef = useRef(0);

  const handleListSortChange = (next: DocListSortKey) => {
    setListSort(next);
    try {
      localStorage.setItem(DOC_LIST_SORT_STORAGE_KEY, next);
    } catch {
      /* ignore quota / private mode */
    }
  };

  /* Switching documents throws away nothing: the editor saves as it goes. */
  const requestSelectListItem = (id: string) => {
    if (!onSelectListItem || id === selectedListId) return;
    onSelectListItem(id);
  };

  const lockScrollSync = useCallback((origin: 'code' | 'preview') => {
    syncOriginRef.current = origin;
    window.clearTimeout(syncUnlockTimerRef.current);
    syncUnlockTimerRef.current = window.setTimeout(() => {
      syncOriginRef.current = 'none';
    }, 80);
  }, []);

  const handleCodeScrollRatio = useCallback(
    (ratio: number) => {
      if (syncOriginRef.current === 'preview') return;
      const el = previewScrollRef.current;
      if (!el) return;
      lockScrollSync('code');
      const max = Math.max(0, el.scrollHeight - el.clientHeight);
      const next = ratio * max;
      if (Math.abs(el.scrollTop - next) < 1) return;
      el.scrollTop = next;
    },
    [lockScrollSync]
  );

  const handlePreviewScroll = useCallback(() => {
    if (syncOriginRef.current === 'code') return;
    const el = previewScrollRef.current;
    if (!el) return;
    lockScrollSync('preview');
    const max = Math.max(1, el.scrollHeight - el.clientHeight);
    editorRef.current?.setScrollRatio(el.scrollTop / max);
  }, [lockScrollSync]);

  useEffect(() => {
    return () => window.clearTimeout(syncUnlockTimerRef.current);
  }, []);

  const bindCollection = useMemo(
    () =>
      createListCollection({
        items: bindTargets.map((x) => ({
          label: `${x.group} / ${x.label}`,
          value: `${x.ownerType}:${x.ownerId}`,
        })),
      }),
    [bindTargets]
  );
  const grouped = useMemo(() => {
    const map = new Map<string, BindTargetOption[]>();
    for (const item of bindTargets) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return Array.from(map.entries());
  }, [bindTargets]);

  const counts = useMemo<InsertCounts>(
    () => ({
      sequence: sequenceOptions.length,
      endpoint: endpointOptions.length,
      channel: channelOptions.length,
      ui: uiOptions.length,
    }),
    [sequenceOptions.length, endpointOptions.length, channelOptions.length, uiOptions.length]
  );

  const pickerItems = useMemo<PickerItem[]>(() => {
    if (insertKind === 'sequence') {
      return sequenceOptions.map((s) => ({ id: s.id, label: s.name }));
    }
    if (insertKind === 'endpoint') {
      return endpointOptions.map((e) => ({
        id: e.id,
        badge: e.method || 'GET',
        label: e.endpoint || '/',
        hint: e.name !== e.endpoint ? e.name : e.containerName,
      }));
    }
    if (insertKind === 'channel') {
      return channelOptions.map((c) => ({
        id: c.id,
        badge: c.protocol,
        label: c.name,
        hint: [c.surface, c.containerName].filter(Boolean).join(' · '),
      }));
    }
    if (insertKind === 'ui') {
      return uiOptions.map((u) => ({
        id: u.id,
        badge: u.designSystem,
        label: u.name,
        hint: u.containerName,
      }));
    }
    return [];
  }, [insertKind, sequenceOptions, endpointOptions, channelOptions, uiOptions]);

  const requestClose = () => {
    if (dirty) {
      setCloseConfirmOpen(true);
      return;
    }
    onClose();
  };

  const confirmClose = () => {
    setCloseConfirmOpen(false);
    onClose();
  };

  const insertAtCursor = (snippet: string) => {
    editorRef.current?.insertAtCursor(snippet);
  };

  /* Tokens already carry their own surrounding blank lines, so several picked
     at once stack into separate blocks without extra glue. */
  const handleInsertPicked = (ids: string[]) => {
    const format =
      insertKind === 'sequence'
        ? formatSequenceRefToken
        : insertKind === 'endpoint'
          ? formatEndpointRefToken
          : insertKind === 'ui'
            ? formatUiRefToken
            : formatChannelRefToken;
    insertAtCursor(ids.map(format).join(''));
  };

  const handleInsertTable = (rows: number, cols: number) => {
    insertAtCursor(formatMarkdownTableToken(rows, cols));
  };

  return (
    <Box
      position="fixed"
      top="0"
      left="0"
      right="0"
      bottom={APP_FOOTER_OFFSET}
      zIndex={WORKSPACE_EDITOR_Z}
      bg="transparent"
      display={hidden ? 'none' : 'flex'}
      flexDirection="column"
      pt={WORKSPACE_CONTENT_TOP}
      pointerEvents="none"
      className="nokey"
      aria-hidden={hidden || undefined}
    >
      <HStack
        px={SIDE_PANEL_INSET}
        py="10px"
        gap="12px"
        align="center"
        flexShrink={0}
        pointerEvents="auto"
        position="relative"
        zIndex={2}
        {...glass.floatBar}
        mx={SIDE_PANEL_INSET}
        mt={SIDE_PANEL_INSET}
      >
        {idle ? (
          <Text fontSize="sm" fontWeight="600" flexShrink={0}>
            {t('documentation_panel_list')}
          </Text>
        ) : (
        <>
        <HStack gap="8px" align="center" flexShrink={0}>
          <Text fontSize="xs" color="fg.muted" whiteSpace="nowrap" fontWeight="600">
            {t('documentation_name_label')}
          </Text>
          <Input
            size="sm"
            h="32px"
            minH="32px"
            value={title}
            disabled={readOnly}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder={t('documentation_title_placeholder')}
            w="220px"
            maxW="260px"
          />
        </HStack>
        <HStack gap="8px" align="center" flexShrink={0} minW={0}>
          <Text fontSize="xs" color="fg.muted" whiteSpace="nowrap" fontWeight="600">
            {t('documentation_attach_label')}
          </Text>
          <Select.Root
            collection={bindCollection}
            value={bindValue ? [bindValue] : []}
            disabled={readOnly}
            onValueChange={(d) => {
              const next = d.value[0] || '';
              const [ownerType, ownerId] = next.split(':');
              if (
                (ownerType === 'system' ||
                  ownerType === 'container' ||
                  ownerType === 'component' ||
                  ownerType === 'code') &&
                ownerId
              ) {
                onBindChange(ownerType, ownerId);
              }
            }}
            size="sm"
            width="340px"
            positioning={{ sameWidth: true, strategy: 'fixed' }}
          >
            <Select.HiddenSelect />
            <Select.Control>
              <Select.Trigger bg="bg.dialog" borderColor="border.input" h="32px" minH="32px">
                <Select.ValueText placeholder={t('documentation_attach_placeholder')} />
              </Select.Trigger>
              <Select.IndicatorGroup>
                <Select.Indicator />
              </Select.IndicatorGroup>
            </Select.Control>
            <EditorSelectPositioner>
              <Select.Content
                maxH="280px"
                overflowY="auto"
                bg="bg.dialog"
                color="fg.default"
                borderWidth="1px"
                borderColor="border.default"
                boxShadow="md"
              >
                {grouped.map(([group, items]) => (
                  <Box key={group}>
                    <Text fontSize="xs" px="10px" py="6px" color="fg.muted">
                      {group}
                    </Text>
                    {items.map((x) => (
                      <Select.Item
                        key={`${x.ownerType}:${x.ownerId}`}
                        item={{ label: x.label, value: `${x.ownerType}:${x.ownerId}` }}
                        _highlighted={{ bg: 'bg.list.hover', color: 'fg.default' }}
                      >
                        <Select.ItemText color="fg.default">{x.label}</Select.ItemText>
                        <Select.ItemIndicator />
                      </Select.Item>
                    ))}
                  </Box>
                ))}
              </Select.Content>
            </EditorSelectPositioner>
          </Select.Root>
        </HStack>
        </>
        )}
        <HStack ml="auto" gap="8px" align="center">
          {onCreateDoc && !readOnly ? (
            <Button
              size="sm"
              variant="ghost"
              borderRadius="full"
              onClick={onCreateDoc}
              data-testid="documentation-list-new"
            >
              <Plus size={TOOLBAR_ICON_SIZE} />
              {t('documentation_add')}
            </Button>
          ) : null}
          {!idle && audit ? <AuditMetaText audit={audit} compact /> : null}
          {liveSync && !idle ? (
            <Text fontSize="xs" color="fg.muted" whiteSpace="nowrap">
              {t('documentation_live_sync')}
            </Text>
          ) : null}
          {editingPeers.length > 0 ? (
            <HStack gap="4px">
              {editingPeers.slice(0, 5).map((peer) => (
                <Box
                  key={`${peer.name}-${peer.color}`}
                  title={peer.name}
                  w="18px"
                  h="18px"
                  borderRadius="full"
                  bg={peer.color}
                  color="white"
                  fontSize="9px"
                  fontWeight="700"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  {peer.name.slice(0, 1).toUpperCase()}
                </Box>
              ))}
            </HStack>
          ) : null}
          {!readOnly && !idle ? (
            <ToolbarIconButton
              colorPalette="brand"
              color="brand.emphasis"
              onClick={onSave}
              disabled={!bindValue || !dirty}
              loading={saving}
              aria-label={
                !bindValue
                  ? t('documentation_save_need_attach')
                  : liveSync
                    ? t('documentation_save_binding')
                    : t('save')
              }
              title={
                !bindValue
                  ? t('documentation_save_need_attach')
                  : liveSync
                    ? t('documentation_save_binding')
                    : t('save')
              }
            >
              <Save size={TOOLBAR_ICON_SIZE} />
            </ToolbarIconButton>
          ) : null}
          {onDelete && !readOnly && !idle ? (
            <ToolbarIconButton
              colorPalette="red"
              color="red.400"
              onClick={() => setDeleteOpen(true)}
              aria-label={t('delete')}
              title={t('delete')}
            >
              <Trash2 size={TOOLBAR_ICON_SIZE} />
            </ToolbarIconButton>
          ) : null}
          <ToolbarIconButton onClick={requestClose} aria-label={t('close')} title={t('close')}>
            <X size={TOOLBAR_ICON_SIZE} />
          </ToolbarIconButton>
        </HStack>
      </HStack>

      <HStack
        align="stretch"
        flex="1"
        minH={0}
        gap={SIDE_PANEL_INSET}
        px={SIDE_PANEL_INSET}
        mt={SIDE_PANEL_INSET}
        pb={SIDE_PANEL_INSET}
        pointerEvents="none"
      >
        {/* The project's documentation, browsed exactly like its sequence
            diagrams — same panel, same collapse rail. */}
        {!listOpen ? (
          <Box flexShrink={0} h="full" pointerEvents="auto">
            <PanelCollapseRail
              side="left"
              label={t('documentation_panel_list')}
              title={t('documentation_show_list')}
              onExpand={() => setListOpen(true)}
            />
          </Box>
        ) : (
          <SidePanelShell
            embedded
            overlay={false}
            width="300px"
            title={<DocumentationListTitle count={listItems.length} />}
            headerActions={
              <DocumentationListSort sort={listSort} onSortChange={handleListSortChange} />
            }
            collapseDirection="left"
            closeLabel={t('documentation_hide_list')}
            onClose={() => setListOpen(false)}
          >
            <DocumentationListPanel
              items={listItems}
              selectedId={selectedListId}
              query={listQuery}
              sort={listSort}
              onQueryChange={setListQuery}
              onSortChange={handleListSortChange}
              onSelect={requestSelectListItem}
            />
          </SidePanelShell>
        )}

        {idle ? (
          <Box
            flex="1"
            minW={0}
            minH={0}
            h="full"
            display="flex"
            pointerEvents="auto"
            p="24px"
            {...glass.editorPanel}
          >
            <Box maxW="520px" color="fg.muted" pt="24px">
              <BookOpen size={28} />
              <Heading as="h2" size="md" mt="12px" mb="8px" color="fg.default">
                {t('documentation_panel_list')}
              </Heading>
              <Text fontSize="sm" lineHeight="1.7">
                {t('documentation_intro')}
              </Text>
            </Box>
          </Box>
        ) : (
          <>
        {!readOnly && codeOpen ? (
          <SidePanelShell
            embedded
            overlay={false}
            width="full"
            minWidth="360px"
            title={t('documentation_panel_code')}
            collapseDirection="right"
            closeLabel={t('documentation_hide_code')}
            onClose={() => setCodeOpen(false)}
          >
            <Box
              px="8px"
              py="6px"
              borderBottomWidth="1px"
              borderColor="border.glass"
              flexShrink={0}
            >
              <Flex gap="8px" align="center" flexWrap="wrap">
                <Menu.Root>
                  <Menu.Trigger asChild>
                    <Button size="xs" variant="outline" data-testid="docs-insert-menu">
                      <Plus size={12} />
                      {t('documentation_insert')}
                    </Button>
                  </Menu.Trigger>
                  <Portal>
                    <Menu.Positioner zIndex={WORKSPACE_EDITOR_OVERLAY_Z}>
                      <GlassMenuContent minW="260px">
                        {INSERT_MENU.map(({ kind, icon: Icon, labelKey, count }) => {
                          const available = count === null ? null : count(counts);
                          return (
                            <Menu.Item
                              key={kind}
                              value={kind}
                              cursor="pointer"
                              disabled={available === 0}
                              onClick={() => setInsertKind(kind)}
                            >
                              <HStack gap="8px" w="100%">
                                <Icon size={14} />
                                <Text fontSize="sm">{t(labelKey)}</Text>
                                {available !== null ? (
                                  <Text fontSize="xs" color="fg.muted" ml="auto">
                                    {available}
                                  </Text>
                                ) : null}
                              </HStack>
                            </Menu.Item>
                          );
                        })}
                      </GlassMenuContent>
                    </Menu.Positioner>
                  </Portal>
                </Menu.Root>
              </Flex>
            </Box>
            <Box flex="1" minH={0}>
              {loading ? (
                <LoadingSkeleton variant="code" label={t('documentation_loading')} />
              ) : (
              <CollaborativeMarkdownEditor
                ref={editorRef}
                key={collabMarkdown ? 'docs-collab' : 'docs-local'}
                yText={collabMarkdown}
                awareness={collabAwareness ?? null}
                value={markdown}
                readOnly={readOnly}
                onMarkdownChange={onMarkdownChange}
                onScrollRatio={handleCodeScrollRatio}
              />
              )}
            </Box>
          </SidePanelShell>
        ) : null}

        {previewOpen || readOnly ? (
          <Box flex="1" minW="360px" minH={0} h="full" display="flex">
            <SidePanelShell
              embedded
              overlay={false}
              width="full"
              minWidth="360px"
              closable={!readOnly}
              collapseDirection="right"
              closeLabel={t('documentation_hide_preview')}
              title={t('documentation_panel_preview')}
              onClose={() => setPreviewOpen(false)}
            >
              <Box
                ref={previewScrollRef}
                flex="1"
                minH={0}
                overflowY="auto"
                onScroll={handlePreviewScroll}
                css={glass.scrollbar}
              >
                {loading ? (
                  <LoadingSkeleton variant="text" label={t('documentation_loading')} />
                ) : (
                <Box p="16px">
                  <DocumentationPreview
                    markdown={markdown}
                    resolveSequence={resolveSequence}
                    resolveEndpoint={resolveEndpoint}
                    resolveChannel={resolveChannel}
                    resolveUi={resolveUi}
                    onOpenSequence={onOpenSequence}
                    onOpenEndpoint={onOpenEndpoint}
                    onOpenChannel={onOpenChannel}
                    onOpenUi={onOpenUi}
                    readOnly={readOnly}
                    onMarkdownChange={readOnly ? undefined : onMarkdownChange}
                  />
                </Box>
                )}
              </Box>
            </SidePanelShell>
          </Box>
        ) : null}

        {!readOnly && (!previewOpen || !codeOpen) ? (
          <Box ml="auto" flexShrink={0} h="full" pointerEvents="auto">
            <PanelCollapseStack side="right">
              {!previewOpen ? (
                <PanelCollapseRail
                  stacked
                  side="right"
                  label={t('documentation_panel_preview')}
                  title={t('documentation_show_preview')}
                  onExpand={() => setPreviewOpen(true)}
                />
              ) : null}
              {!codeOpen ? (
                <PanelCollapseRail
                  stacked
                  side="right"
                  label={t('documentation_panel_code')}
                  title={t('documentation_show_code')}
                  onExpand={() => setCodeOpen(true)}
                />
              ) : null}
            </PanelCollapseStack>
          </Box>
        ) : null}
          </>
        )}
      </HStack>

      <InsertTableDialog
        open={insertKind === 'table'}
        onInsert={handleInsertTable}
        onClose={() => setInsertKind(null)}
      />

      <InsertPickerDialog
        open={insertKind !== null && insertKind !== 'table'}
        title={insertKind && insertKind !== 'table' ? t(`documentation_insert_${insertKind}`) : ''}
        items={pickerItems}
        emptyLabel={
          insertKind === 'sequence'
            ? t('documentation_no_sequences')
            : insertKind === 'endpoint'
              ? t('documentation_no_endpoints')
              : insertKind === 'ui'
                ? t('documentation_no_ui')
                : t('documentation_no_channels')
        }
        onInsert={handleInsertPicked}
        onClose={() => setInsertKind(null)}
      />

      <ConfirmDialog
        open={deleteOpen}
        title={t('confirm_delete')}
        content="Delete attached documentation? This cannot be undone."
        confirmText={t('delete')}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          setDeleteOpen(false);
          onDelete?.();
        }}
      />

      <ConfirmDialog
        open={closeConfirmOpen}
        title={
          bindValue
            ? t('documentation_unsaved_title')
            : t('documentation_unattached_title')
        }
        content={
          bindValue
            ? t('documentation_unsaved_confirm', {
                name: title || t('documentation'),
              })
            : t('documentation_unattached_confirm', {
                name: title || t('documentation'),
              })
        }
        confirmText={t('documentation_discard_close')}
        cancelText={t('cancel')}
        onCancel={() => setCloseConfirmOpen(false)}
        onConfirm={confirmClose}
      />
    </Box>
  );
}
