import { useFlatC4Store } from '@archivisio/c4-modelizer-sdk';
import SidePanelShell, {
  PanelEmptyState,
  PanelListItem,
} from '@components/common/SidePanelShell';
import { Button } from '@chakra-ui/react';
import { Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import type { StoredSequenceDiagram } from '@/types/c4Extensions';
import { listEntitySequences } from './localSequences';
import { createEmptyDiagramSource } from './host/diagramHelpers';
import { leaveWorkspaceOverlays } from '@/navigation/leaveWorkspaceOverlays';
import {
  getSequenceLocksSnapshot,
  subscribeSequenceLocks,
} from './collabBridge';
import {
  closeSequenceDiagramsSidebar,
  getSequenceDiagramLock,
  getSequenceDiagramsSidebar,
  getSequenceEditorCanEdit,
  openSequenceEditor,
  subscribeSequenceEditor,
  tryOpenSequenceEditor,
} from './uiState';

function formatSequenceUpdatedAt(value?: string): string | undefined {
  if (!value) return undefined;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : new Date(ms).toLocaleString();
}

export default function SequenceDiagramsSidebar() {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const sidebar = useSyncExternalStore(
    subscribeSequenceEditor,
    getSequenceDiagramsSidebar,
    () => null
  );
  useSyncExternalStore(
    subscribeSequenceLocks,
    getSequenceLocksSnapshot,
    getSequenceLocksSnapshot
  );
  const canEdit = useSyncExternalStore(
    subscribeSequenceEditor,
    getSequenceEditorCanEdit,
    getSequenceEditorCanEdit
  );
  const model = useFlatC4Store((s) => s.model);

  const diagrams = useMemo((): StoredSequenceDiagram[] => {
    if (!sidebar) return [];
    return listEntitySequences(model, sidebar.ownerType, sidebar.ownerId);
  }, [sidebar, model]);

  /* Capture phase — same as docs list. React Flow stops bubbling pane events,
     so bubble-phase outside-click never saw canvas clicks. */
  useEffect(() => {
    if (!sidebar) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (panelRef.current?.contains(target)) return;
      if (target.closest('[data-sequence-sidebar-trigger]')) return;
      closeSequenceDiagramsSidebar();
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSequenceDiagramsSidebar();
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [sidebar]);

  if (!sidebar) return null;

  const openDiagram = (d: StoredSequenceDiagram) => {
    leaveWorkspaceOverlays({ resetTrail: true });
    const result = tryOpenSequenceEditor({
      ownerType: sidebar.ownerType,
      ownerId: sidebar.ownerId,
      diagramId: d.id,
      diagramName: d.name,
      plantUmlSource: d.plantUmlSource,
      readOnly: !canEdit,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      createdBy: d.createdBy,
      updatedBy: d.updatedBy,
    });
    if (!result.ok) {
      return;
    }
  };

  const createNewDiagram = () => {
    if (!canEdit) return;
    leaveWorkspaceOverlays({ resetTrail: true });
    const diagramName = `${sidebar.ownerName} sequence`;
    openSequenceEditor({
      ownerType: sidebar.ownerType,
      ownerId: sidebar.ownerId,
      diagramName,
      plantUmlSource: createEmptyDiagramSource(diagramName),
    });
    closeSequenceDiagramsSidebar();
  };

  return (
      <SidePanelShell
        panelRef={panelRef}
        data-panel="sequence-diagrams"
        width="300px"
        title={t('sequence_diagrams')}
        subtitle={sidebar.ownerName}
        onClose={closeSequenceDiagramsSidebar}
        footer={
          canEdit ? (
            <Button
              size="sm"
              width="full"
              variant="outline"
              onClick={createNewDiagram}
              data-testid="sequence-sidebar-new"
            >
              <Plus size={14} />
              {t('sequence_add_diagram')}
            </Button>
          ) : undefined
        }
      >
        {diagrams.length === 0 ? (
          <PanelEmptyState>{t('sequence_diagrams_empty')}</PanelEmptyState>
        ) : (
          diagrams.map((d) => {
            const lock = getSequenceDiagramLock(
              sidebar.ownerType,
              sidebar.ownerId,
              d.id
            );
            const lockedForEdit = canEdit && Boolean(lock);
            return (
              <PanelListItem
                key={d.id}
                disabled={lockedForEdit}
                onClick={() => openDiagram(d)}
                title={d.name}
                subtitle={
                  lock
                    ? t('sequence_editing_by', { name: lock.name })
                    : formatSequenceUpdatedAt(d.updatedAt)
                }
              />
            );
          })
        )}
      </SidePanelShell>
  );
}
