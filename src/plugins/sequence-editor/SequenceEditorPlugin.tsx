import {
  Box,
  Button,
  Heading,
  HStack,
  Input,
  Text,
} from '@chakra-ui/react';
import AuditMetaText from '@components/common/AuditMetaText';
import ConfirmDialog from '@components/common/ConfirmDialog';
import PanelCollapseRail, { PanelCollapseStack } from '@components/common/PanelCollapseRail';
import SearchableSelect from '@components/common/SearchableSelect';
import SidePanelShell from '@components/common/SidePanelShell';
import { ToolbarIconButton, TOOLBAR_ICON_SIZE } from '@components/common/ToolbarIconButton';
import type { AuditExtras } from '@/types/c4Extensions';
import { usePaneRoom, useRubberOpen } from '@hooks/useRubberPane';
import { useGlassSurface } from '@theme/glassSurfaces';
import {
  APP_FOOTER_OFFSET,
  SIDE_PANEL_INSET,
  WORKSPACE_CONTENT_TOP,
  WORKSPACE_EDITOR_Z,
} from '@theme/sidePanelLayout';
import { GitBranch, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useColorMode } from '@contexts/ColorModeContext';
import { exportSequenceDiagram } from '@utils/imageExport';
import { useTranslation } from 'react-i18next';
import type { SequenceModel } from './domain/sequence-model';
import PlantUmlMonacoEditor from './editor/PlantUmlMonacoEditor';
import type { C4CatalogParticipant } from './host/c4Catalog';
import SequenceCanvas from './react-flow/SequenceCanvas';
import SequenceDiagramsListPanel, {
  SequenceListSort,
  SequenceListTitle,
} from './SequenceDiagramsListPanel';
import {
  parseSequenceListSortKey,
  type SequenceListItem,
  type SequenceListSortKey,
} from './sequenceList';
import { useSequenceEditorStore } from './state/sequence-editor-store';
import DiagnosticsPanel from './ui/DiagnosticsPanel';
import PropertiesPanel from './ui/PropertiesPanel';
import SequenceToolbar from './ui/Toolbar';
import { updateSequenceEditorSource } from './uiState';
import { trackProductEvent } from '@/metrics';

const SEQUENCE_LIST_SORT_STORAGE_KEY = 'c4-sequence-list-sort';

export type BindTargetOption = {
  ownerType: 'container' | 'component';
  ownerId: string;
  label: string;
  group: string;
};

export type SequenceEditorPluginProps = {
  initialSource?: string;
  initialModel?: SequenceModel;
  readOnly?: boolean;
  theme?: 'light' | 'dark' | 'system';
  catalog?: C4CatalogParticipant[];
  title?: string;
  bindValue?: string;
  /** False until the diagram exists on the C4 owner (has diagramId). */
  persisted?: boolean;
  bindTargets?: BindTargetOption[];
  bindError?: string | null;
  audit?: AuditExtras | null;
  /** Project-wide diagrams for the left list panel. */
  listItems?: SequenceListItem[];
  selectedListId?: string | null;
  /** Manager open with no diagram selected. */
  idle?: boolean;
  onSelectListItem?: (id: string) => void;
  onCreateDiagram?: () => void;
  isListItemLocked?: (item: SequenceListItem) => boolean;
  listItemLockLabel?: (item: SequenceListItem) => string | null;
  onBindChange?: (ownerType: 'container' | 'component', ownerId: string) => void;
  onDiagramNameChange?: (name: string) => void;
  onChange?: (payload: {
    source: string;
    model: SequenceModel;
    isValid: boolean;
  }) => void;
  onSave?: (payload: { source: string; model: SequenceModel }) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  onClose?: () => void;
};

export function SequenceEditorPlugin({
  initialSource,
  initialModel,
  readOnly = false,
  theme = 'light',
  catalog = [],
  title,
  bindValue = '',
  persisted = false,
  bindTargets = [],
  bindError = null,
  audit,
  listItems = [],
  selectedListId = null,
  idle = false,
  onSelectListItem,
  onCreateDiagram,
  isListItemLocked,
  listItemLockLabel,
  onBindChange,
  onDiagramNameChange,
  onChange,
  onSave,
  onDelete,
  onClose,
}: SequenceEditorPluginProps) {
  const { t } = useTranslation();
  const glass = useGlassSurface();
  const init = useSequenceEditorStore((s) => s.init);
  const setAllowedParticipantIds = useSequenceEditorStore((s) => s.setAllowedParticipantIds);
  const source = useSequenceEditorStore((s) => s.source);
  const model = useSequenceEditorStore((s) => s.model);
  const diagnostics = useSequenceEditorStore((s) => s.diagnostics);
  const revision = useSequenceEditorStore((s) => s.revision);
  const updateOrigin = useSequenceEditorStore((s) => s.updateOrigin);
  const setSourceFromEditor = useSequenceEditorStore((s) => s.setSourceFromEditor);
  const { mode } = useColorMode();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [navConfirmOpen, setNavConfirmOpen] = useState(false);
  const [pendingListId, setPendingListId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(true);
  const [listQuery, setListQuery] = useState('');
  const [listSort, setListSort] = useState<SequenceListSortKey>(() => {
    try {
      return parseSequenceListSortKey(localStorage.getItem(SEQUENCE_LIST_SORT_STORAGE_KEY));
    } catch {
      return 'updated';
    }
  });
  const room = usePaneRoom();
  const [codeOpen, setCodeOpen] = useRubberOpen(!readOnly && room.secondary);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [propsOpen, setPropsOpen] = useState(false);
  const selection = useSequenceEditorStore((s) => s.selection);
  const [savedSnapshot, setSavedSnapshot] = useState(() => ({
    source: initialSource ?? '',
    bindValue: bindValue,
    title: title ?? '',
  }));

  // Left-click selection → open properties for editing (editors only).
  useEffect(() => {
    if (readOnly) return;
    if (selection) setPropsOpen(true);
  }, [selection, readOnly]);

  // Hydrate once per editor instance — Overlay remounts via `key={session.editorKey}`.
  useEffect(() => {
    init({
      source: initialSource,
      model: initialModel,
      strictParticipants: false,
      allowedParticipantIds: undefined,
      readOnly,
    });
    setSavedSnapshot({
      source: useSequenceEditorStore.getState().source,
      bindValue,
      title: title ?? '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remount via Overlay key
  }, []);

  useEffect(() => {
    setAllowedParticipantIds(null);
  }, [setAllowedParticipantIds]);

  useEffect(() => {
    onChange?.({
      source,
      model,
      isValid: !diagnostics.some((d) => d.severity === 'error'),
    });
    updateSequenceEditorSource(source);
  }, [source, model, diagnostics, onChange]);

  const participantIds = useMemo(() => model.participants.map((p) => p.id), [model.participants]);
  const editorTheme = theme === 'system' ? 'light' : theme;

  const bindOptions = useMemo(
    () =>
      bindTargets.map((x) => ({
        value: `${x.ownerType}:${x.ownerId}`,
        label: x.label,
        group: x.group,
      })),
    [bindTargets]
  );

  // Unsaved draft (no diagramId yet) stays dirty for Save after attach —
  // otherwise savedSnapshot already includes the new bind and Save greys out.
  // Idle manager has no draft — never dirty. Navigation/close only care about
  // real edits vs the hydrated snapshot (init re-serializes PlantUML).
  const contentDirty =
    !idle &&
    (source !== savedSnapshot.source ||
      bindValue !== savedSnapshot.bindValue ||
      (title ?? '') !== savedSnapshot.title);
  const dirty = (!persisted && !idle) || contentDirty;

  /* SVG/PNG are drawn by the backend from the parsed model — the PlantUML
     parser stays here, the rendering does not. */
  const [imageExporting, setImageExporting] = useState<'svg' | 'png' | null>(null);
  const exportImage = async (format: 'svg' | 'png') => {
    setImageExporting(format);
    try {
      await exportSequenceDiagram({
        model: useSequenceEditorStore.getState().model,
        name: title || 'sequence',
        theme: mode,
        format,
      });
      trackProductEvent('export.image', { format, scope: 'sequence' });
    } catch (err) {
      trackProductEvent('health.export_failed', { format });
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setImageExporting(null);
    }
  };

  const exportPuml = () => {
    const blob = new Blob([source], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(title || 'sequence').replace(/\s+/g, '_')}.puml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSave = async () => {
    if (!onSave || !dirty || !bindValue) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave({ source, model });
      setSavedSnapshot({
        source,
        bindValue,
        title: title ?? '',
      });
      trackProductEvent('sequence.saved');
    } catch (e) {
      trackProductEvent('health.save_failed', { area: 'sequence' });
      setSaveError(e instanceof Error ? e.message : t('sequence_save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const requestClose = () => {
    if (!onClose) return;
    if (contentDirty) {
      setCloseConfirmOpen(true);
      return;
    }
    onClose();
  };

  const confirmClose = () => {
    setCloseConfirmOpen(false);
    onClose?.();
  };

  const handleListSortChange = (next: SequenceListSortKey) => {
    setListSort(next);
    try {
      localStorage.setItem(SEQUENCE_LIST_SORT_STORAGE_KEY, next);
    } catch {
      /* ignore quota / private mode */
    }
  };

  const requestSelectListItem = (id: string) => {
    if (!onSelectListItem || id === selectedListId) return;
    if (contentDirty) {
      setPendingListId(id);
      setNavConfirmOpen(true);
      return;
    }
    onSelectListItem(id);
  };

  const confirmNav = () => {
    const id = pendingListId;
    setNavConfirmOpen(false);
    setPendingListId(null);
    if (id) onSelectListItem?.(id);
  };

  const requestCreateDiagram = () => {
    if (!onCreateDiagram) return;
    if (contentDirty) {
      setPendingListId('__create__');
      setNavConfirmOpen(true);
      return;
    }
    onCreateDiagram();
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
      display="flex"
      flexDirection="column"
      pt={WORKSPACE_CONTENT_TOP}
      pointerEvents="none"
      className="nokey"
    >
      <HStack
        px={SIDE_PANEL_INSET}
        py="10px"
        gap="12px"
        align="center"
        flexShrink={0}
        flexWrap="wrap"
        justify="space-between"
        pointerEvents="auto"
        position="relative"
        zIndex={2}
        {...glass.floatBar}
        mx={SIDE_PANEL_INSET}
        mt={SIDE_PANEL_INSET}
      >
        {idle ? (
          <HStack gap="8px" align="center" minW={0}>
            <GitBranch size={15} />
            <Text fontSize="sm" fontWeight="600" color="fg.default">
              {t('sequence_editor_title')}
            </Text>
          </HStack>
        ) : (
          <HStack gap="8px" align="center" flexWrap="wrap" minW={0}>
            <HStack gap="8px" align="center" flexShrink={0}>
              <Text fontSize="xs" color="fg.muted" whiteSpace="nowrap" fontWeight="600">
                {t('sequence_name_label')}
              </Text>
              <Input
                size="sm"
                w="200px"
                maxW="220px"
                minH="32px"
                h="32px"
                value={title || ''}
                disabled={readOnly}
                placeholder={t('sequence_diagram_name')}
                onChange={(e) => onDiagramNameChange?.(e.target.value)}
              />
            </HStack>
            <HStack gap="8px" align="center" flexShrink={0} minW={0}>
              <Text fontSize="xs" color="fg.muted" whiteSpace="nowrap" fontWeight="600">
                {t('sequence_attach_label')}
              </Text>
              <SearchableSelect
                size="sm"
                width="340px"
                options={bindOptions}
                value={bindValue}
                disabled={readOnly || !onBindChange}
                placeholder={t('sequence_bind_placeholder')}
                emptyText={t('sequence_bind_no_matches')}
                data-testid="sequence-attach"
                onChange={(next) => {
                  if (!next) return;
                  const [ownerType, ownerId] = next.split(':');
                  if (
                    (ownerType === 'container' || ownerType === 'component') &&
                    ownerId
                  ) {
                    onBindChange?.(ownerType, ownerId);
                  }
                }}
              />
            </HStack>
            {bindError ? (
              <Text fontSize="xs" color="red.400" maxW="200px">
                {bindError}
              </Text>
            ) : null}
          </HStack>
        )}

        <HStack gap="8px" align="center" flexShrink={0} ml="auto">
          {onCreateDiagram && !readOnly ? (
            <Button
              size="sm"
              variant="ghost"
              borderRadius="full"
              onClick={requestCreateDiagram}
              data-testid="sequence-list-new"
            >
              <Plus size={TOOLBAR_ICON_SIZE} />
              {t('sequence_add_diagram')}
            </Button>
          ) : null}
          {idle ? (
            onClose ? (
              <ToolbarIconButton
                aria-label={t('close')}
                title={t('close')}
                onClick={requestClose}
                data-testid="sequence-close"
              >
                <X size={TOOLBAR_ICON_SIZE} />
              </ToolbarIconButton>
            ) : null
          ) : (
            <>
              {audit ? <AuditMetaText audit={audit} compact /> : null}
              <SequenceToolbar
                readOnly={readOnly}
                onExport={exportPuml}
                onExportImage={exportImage}
                imageExporting={imageExporting}
                onSave={onSave ? handleSave : undefined}
                saving={saving}
                saveDisabled={!dirty || !bindValue}
                saveError={saveError}
                onRequestDelete={onDelete && !readOnly ? () => setDeleteOpen(true) : undefined}
                onClose={onClose ? requestClose : undefined}
              />
            </>
          )}
        </HStack>
      </HStack>

      <HStack
        flex="1"
        align="stretch"
        gap={SIDE_PANEL_INSET}
        minH={0}
        px={SIDE_PANEL_INSET}
        mt={SIDE_PANEL_INSET}
        pb={SIDE_PANEL_INSET}
        pointerEvents="none"
      >
        {!listOpen ? (
          <Box flexShrink={0} h="full" pointerEvents="auto">
            <PanelCollapseRail
              side="left"
              label={t('sequence_panel_list')}
              title={t('sequence_show_list')}
              onExpand={() => setListOpen(true)}
            />
          </Box>
        ) : (
          <SidePanelShell
            embedded
            overlay={false}
            width="300px"
            title={<SequenceListTitle count={listItems.length} />}
            headerActions={<SequenceListSort sort={listSort} onSortChange={handleListSortChange} />}
            collapseDirection="left"
            closeLabel={t('sequence_hide_list')}
            onClose={() => setListOpen(false)}
          >
            <SequenceDiagramsListPanel
              items={listItems}
              selectedId={selectedListId}
              query={listQuery}
              sort={listSort}
              onQueryChange={setListQuery}
              onSortChange={handleListSortChange}
              onSelect={requestSelectListItem}
              isLocked={isListItemLocked}
              lockLabel={listItemLockLabel}
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
              <GitBranch size={28} />
              <Heading as="h2" size="md" mt="12px" mb="8px" color="fg.default">
                {t('sequence_editor_title')}
              </Heading>
              <Text fontSize="sm" lineHeight="1.7">
                {t('sequence_intro')}
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
            title={t('sequence_panel_code')}
            collapseDirection="right"
            closeLabel={t('sequence_hide_code')}
            onClose={() => setCodeOpen(false)}
          >
            <Box flex="1" minH={0}>
              <PlantUmlMonacoEditor
                value={source}
                revision={revision}
                updateOrigin={updateOrigin}
                diagnostics={diagnostics}
                catalog={catalog}
                participantIds={participantIds}
                readOnly={readOnly}
                theme={editorTheme}
                onChange={setSourceFromEditor}
              />
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
              closeLabel={t('sequence_hide_preview')}
              title={t('sequence_panel_preview')}
              onClose={() => setPreviewOpen(false)}
            >
              <Box flex="1" minH={0} position="relative" display="flex" flexDirection="column">
                <Box flex="1" minH={0} position="relative">
                  <SequenceCanvas readOnly={readOnly} catalog={catalog} />
                </Box>
                {!readOnly ? <DiagnosticsPanel diagnostics={diagnostics} /> : null}
              </Box>
            </SidePanelShell>
          </Box>
        ) : null}

        {!readOnly && propsOpen ? (
          <SidePanelShell
            embedded
            overlay={false}
            width="300px"
            title={t('sequence_panel_properties')}
            collapseDirection="right"
            closeLabel={t('sequence_hide_properties')}
            onClose={() => setPropsOpen(false)}
          >
            <PropertiesPanel readOnly={readOnly} />
          </SidePanelShell>
        ) : null}

        {!readOnly && (!previewOpen || !codeOpen || !propsOpen) ? (
          <Box ml="auto" flexShrink={0} h="full" pointerEvents="auto">
            <PanelCollapseStack side="right">
              {!previewOpen ? (
                <PanelCollapseRail
                  stacked
                  side="right"
                  label={t('sequence_panel_preview')}
                  title={t('sequence_show_preview')}
                  onExpand={() => setPreviewOpen(true)}
                />
              ) : null}
              {!propsOpen ? (
                <PanelCollapseRail
                  stacked
                  side="right"
                  label={t('sequence_panel_properties')}
                  title={t('sequence_show_properties')}
                  onExpand={() => setPropsOpen(true)}
                />
              ) : null}
              {!codeOpen ? (
                <PanelCollapseRail
                  stacked
                  side="right"
                  label={t('sequence_panel_code')}
                  title={t('sequence_show_code')}
                  onExpand={() => setCodeOpen(true)}
                />
              ) : null}
            </PanelCollapseStack>
          </Box>
        ) : null}
          </>
        )}
      </HStack>

      <ConfirmDialog
        open={deleteOpen}
        title={t('confirm_delete')}
        content={t('sequence_delete_confirm', {
          name: title || t('sequence_editor_title'),
        })}
        confirmText={t('delete')}
        confirmLoading={deleting}
        onCancel={() => {
          if (!deleting) setDeleteOpen(false);
        }}
        onConfirm={handleConfirmDelete}
      />

      <ConfirmDialog
        open={closeConfirmOpen}
        title={
          bindValue
            ? t('sequence_unsaved_title')
            : t('sequence_unattached_title')
        }
        content={
          bindValue
            ? t('sequence_unsaved_confirm', {
                name: title || t('sequence_editor_title'),
              })
            : t('sequence_unattached_confirm', {
                name: title || t('sequence_editor_title'),
              })
        }
        confirmText={t('sequence_discard_close')}
        cancelText={t('cancel')}
        onCancel={() => setCloseConfirmOpen(false)}
        onConfirm={confirmClose}
      />

      <ConfirmDialog
        open={navConfirmOpen}
        title={
          bindValue
            ? t('sequence_unsaved_title')
            : t('sequence_unattached_title')
        }
        content={
          bindValue
            ? t('sequence_unsaved_switch_confirm', {
                name: title || t('sequence_editor_title'),
              })
            : t('sequence_unattached_switch_confirm', {
                name: title || t('sequence_editor_title'),
              })
        }
        confirmText={t('sequence_discard_switch')}
        cancelText={t('cancel')}
        onCancel={() => {
          setNavConfirmOpen(false);
          setPendingListId(null);
        }}
        onConfirm={() => {
          if (pendingListId === '__create__') {
            setNavConfirmOpen(false);
            setPendingListId(null);
            onCreateDiagram?.();
            return;
          }
          confirmNav();
        }}
      />
    </Box>
  );
}

export default SequenceEditorPlugin;
