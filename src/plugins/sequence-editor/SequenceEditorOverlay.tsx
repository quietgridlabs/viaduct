import { useFlatActiveElements, useFlatC4Store } from '@archivisio/c4-modelizer-sdk';
import type { ComponentBlock, ContainerBlock } from '@archivisio/c4-modelizer-sdk';
import RouteFallback from '@components/RouteFallback';
import { useAuth } from '@contexts/AuthContext';
import { useColorMode } from '@contexts/ColorModeContext';
import { personRefFromUser } from '@utils/audit';
import { Suspense, lazy, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { SequenceDiagramExtras } from '../../types/c4Extensions';
import {
  buildC4Catalog,
  buildProjectC4Catalog,
  catalogContainerGroup,
} from './host/c4Catalog';
import { createEmptyDiagramSource, createStoredDiagram } from './host/diagramHelpers';
/*
 * Same reasoning as the documentation overlay: this plugin registers during
 * editor boot but renders nothing until a diagram is opened, and it carries
 * Monaco behind PlantUmlMonacoEditor. Loading it on demand keeps the editor's
 * first paint clear of a text editor the visitor may never open.
 */
const SequenceEditorPlugin = lazy(() => import('./SequenceEditorPlugin'));
import {
  closeSequenceEditor,
  getSequenceDiagramLock,
  getSequenceEditorSession,
  openSequenceEditor,
  patchSequenceEditorSession,
  subscribeSequenceEditor,
  tryOpenSequenceEditor,
} from './uiState';
import {
  getSequenceLocksSnapshot,
  subscribeSequenceLocks,
} from './collabBridge';
import { listProjectSequences } from '@plugins/data-flows/attachments';
import {
  SEQUENCE_LIST_DRAFT_ID,
  type SequenceListItem,
} from './sequenceList';
import {
  ensureNavTrailRoot,
  getNavTrailSnapshot,
  popNavTrail,
  pushNavTrail,
} from '@/navigation/navTrail';
import { leaveCatalogOrFlows } from '@/navigation/leaveCatalogOrFlows';
import { isCloneBlock, resolveOriginalId } from '@utils/cloneSource';
import {
  getDocumentationEditorSession,
  setDocumentationEditorHidden,
} from '@plugins/docs-editor/uiState';

type EntityWithDiagrams = (ContainerBlock | ComponentBlock) & SequenceDiagramExtras;

export type BindTargetOption = {
  ownerType: 'container' | 'component';
  ownerId: string;
  label: string;
  group: string;
};

export default function SequenceEditorOverlay() {
  const session = useSyncExternalStore(
    subscribeSequenceEditor,
    getSequenceEditorSession,
    () => null
  );
  const { mode } = useColorMode();
  const { user } = useAuth();
  const model = useFlatC4Store((s) => s.model);
  const updateContainer = useFlatC4Store((s) => s.updateContainer);
  const updateComponent = useFlatC4Store((s) => s.updateComponent);
  const { activeSystem, activeContainer } = useFlatActiveElements();
  const [bindError, setBindError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!session) return;
    leaveCatalogOrFlows(location.pathname, navigate);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reopen only on editor identity
  }, [session?.editorKey, location.pathname, navigate]);

  /* The open diagram gets its own crumb after the C4 levels, exactly as an
     open document does — otherwise the pill loses its last step here. */
  useEffect(() => {
    if (!session || session.idle) return;
    ensureNavTrailRoot();
    pushNavTrail({
      kind: 'sequence',
      label: session.diagramName || 'Sequence',
      id: `seq_${session.diagramId || session.editorKey}`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- trail follows diagram identity fields
  }, [session?.editorKey, session?.diagramId, session?.idle, session?.diagramName]);

  const bindTargets = useMemo((): BindTargetOption[] => {
    const opts: BindTargetOption[] = [];
    /* Clone cards are views of another block; a diagram attached to one lands
       nowhere the reader can reach it, so they are not offered as targets. */
    const containers = (
      activeSystem
        ? model.containers.filter((c) => c.systemId === activeSystem.id)
        : model.containers
    ).filter((c) => !isCloneBlock(c));
    const ordered = [
      ...containers.filter((c) => catalogContainerGroup(c.technology) === 'Containers'),
      ...containers.filter((c) => catalogContainerGroup(c.technology) === 'Databases'),
    ];
    for (const c of ordered) {
      opts.push({
        ownerType: 'container',
        ownerId: c.id,
        label: c.name,
        group: catalogContainerGroup(c.technology),
      });
      for (const comp of model.components
        .filter((x) => x.containerId === c.id && !isCloneBlock(x))
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))) {
        opts.push({
          ownerType: 'component',
          ownerId: comp.id,
          label: comp.name,
          group: c.name,
        });
      }
    }
    return opts;
  }, [model, activeSystem]);

  const catalog = useMemo(() => {
    if (!session) return [];
    if (session.ownerType && session.ownerId) {
      return buildC4Catalog({
        model,
        ownerType: session.ownerType,
        ownerId: session.ownerId,
      });
    }
    return buildProjectC4Catalog(model, {
      systemId: activeSystem?.id,
      containerId: activeContainer?.id,
    });
  }, [session, model, activeSystem, activeContainer]);

  const onBindChange = useCallback(
    (ownerType: 'container' | 'component', ownerId: string) => {
      if (!session) return;
      setBindError(null);
      const entity =
        ownerType === 'container'
          ? model.containers.find((c) => c.id === ownerId)
          : model.components.find((c) => c.id === ownerId);
      if (!entity) return;

      // Keep current draft; persist only on Save.
      patchSequenceEditorSession({
        ownerType,
        ownerId,
      });
    },
    [session, model]
  );

  const onSave = useCallback(
    async (payload: { source: string }) => {
      if (!session?.ownerType || !session.ownerId) {
        throw new Error('Select where to attach this diagram before saving');
      }
      const now = new Date().toISOString();
      const name = session.diagramName || 'Untitled sequence';
      const diagramId = session.diagramId;
      const author = personRefFromUser(user);

      // If attach target changed, detach the diagram from any previous owner first.
      if (diagramId) {
        for (const c of model.containers) {
          if (session.ownerType === 'container' && c.id === session.ownerId) continue;
          const list = (c as EntityWithDiagrams).sequenceDiagrams;
          if (!list?.some((d) => d.id === diagramId)) continue;
          updateContainer(c.id, {
            sequenceDiagrams: list.filter((d) => d.id !== diagramId),
          } as Partial<ContainerBlock>);
        }
        for (const c of model.components) {
          if (session.ownerType === 'component' && c.id === session.ownerId) continue;
          const list = (c as EntityWithDiagrams).sequenceDiagrams;
          if (!list?.some((d) => d.id === diagramId)) continue;
          updateComponent(c.id, {
            sequenceDiagrams: list.filter((d) => d.id !== diagramId),
          } as Partial<ComponentBlock>);
        }
      }

      const writeToEntity = (
        diagrams: NonNullable<EntityWithDiagrams['sequenceDiagrams']>,
        persist: (next: NonNullable<EntityWithDiagrams['sequenceDiagrams']>) => void
      ) => {
        const idx = diagramId ? diagrams.findIndex((d) => d.id === diagramId) : -1;
        if (idx >= 0) {
          const prev = diagrams[idx]!;
          diagrams[idx] = {
            ...prev,
            name,
            plantUmlSource: payload.source,
            updatedAt: now,
            ...(author ? { updatedBy: author } : {}),
            createdBy: prev.createdBy || author || undefined,
            createdAt: prev.createdAt || now,
          };
          patchSequenceEditorSession({
            diagramId: diagrams[idx]!.id,
            plantUmlSource: payload.source,
            diagramName: name,
            createdAt: diagrams[idx]!.createdAt,
            updatedAt: diagrams[idx]!.updatedAt,
            createdBy: diagrams[idx]!.createdBy,
            updatedBy: diagrams[idx]!.updatedBy,
          });
        } else if (diagramId) {
          // Re-attach existing id after move
          const moved = {
            id: diagramId,
            name,
            plantUmlSource: payload.source,
            modelVersion: 1 as const,
            createdAt: session.createdAt || now,
            updatedAt: now,
            createdBy: session.createdBy || author || undefined,
            ...(author ? { updatedBy: author } : {}),
          };
          diagrams.push(moved);
          patchSequenceEditorSession({
            diagramId,
            diagramName: name,
            plantUmlSource: payload.source,
            createdAt: moved.createdAt,
            updatedAt: moved.updatedAt,
            createdBy: moved.createdBy,
            updatedBy: moved.updatedBy,
          });
        } else {
          const created = createStoredDiagram(name, payload.source, author);
          diagrams.push(created);
          patchSequenceEditorSession({
            diagramId: created.id,
            diagramName: created.name,
            plantUmlSource: created.plantUmlSource,
            createdAt: created.createdAt,
            updatedAt: created.updatedAt,
            createdBy: created.createdBy,
            updatedBy: created.updatedBy,
          });
        }
        persist(diagrams);
      };

      /* Sessions opened before clones were excluded may still point at one.
         Write to the original — that is where every reader looks. */
      const ownerId = resolveOriginalId(model, session.ownerId!);

      if (session.ownerType === 'container') {
        const entity = model.containers.find((c) => c.id === ownerId) as
          | EntityWithDiagrams
          | undefined;
        if (!entity) throw new Error('Container not found');
        writeToEntity([...(entity.sequenceDiagrams ?? [])], (diagrams) => {
          updateContainer(ownerId, {
            sequenceDiagrams: diagrams,
          } as Partial<ContainerBlock>);
        });
        return;
      }

      const entity = model.components.find((c) => c.id === ownerId) as
        | EntityWithDiagrams
        | undefined;
      if (!entity) throw new Error('Component not found');
      writeToEntity([...(entity.sequenceDiagrams ?? [])], (diagrams) => {
        updateComponent(ownerId, {
          sequenceDiagrams: diagrams,
        } as Partial<ComponentBlock>);
      });
    },
    [session, model, updateContainer, updateComponent, user]
  );

  const onDelete = useCallback(async () => {
    if (!session) return;

    const deletedId = session.diagramId;
    const before = listProjectSequences(model);
    const deletedIndex = deletedId ? before.findIndex((d) => d.id === deletedId) : -1;
    const remaining = deletedId ? before.filter((d) => d.id !== deletedId) : before;

    if (session.ownerType && session.ownerId && session.diagramId) {
      /* Same resolution as on save: the diagram lives on the original. */
      const ownerId = resolveOriginalId(model, session.ownerId);
      if (session.ownerType === 'container') {
        const entity = model.containers.find((c) => c.id === ownerId) as
          | EntityWithDiagrams
          | undefined;
        if (entity) {
          const diagrams = (entity.sequenceDiagrams ?? []).filter(
            (d) => d.id !== session.diagramId
          );
          updateContainer(ownerId, {
            sequenceDiagrams: diagrams,
          } as Partial<ContainerBlock>);
        }
      } else {
        const entity = model.components.find((c) => c.id === ownerId) as
          | EntityWithDiagrams
          | undefined;
        if (entity) {
          const diagrams = (entity.sequenceDiagrams ?? []).filter(
            (d) => d.id !== session.diagramId
          );
          updateComponent(ownerId, {
            sequenceDiagrams: diagrams,
          } as Partial<ComponentBlock>);
        }
      }
    }

    /* Stay in the sequence manager: open the next list neighbour, or idle empty. */
    const nextItem =
      (deletedIndex >= 0 ? remaining[deletedIndex] : undefined) ??
      remaining[Math.max(0, deletedIndex - 1)] ??
      remaining[0];

    if (nextItem) {
      tryOpenSequenceEditor({
        ownerType: nextItem.ownerType,
        ownerId: nextItem.ownerId,
        diagramId: nextItem.id,
        diagramName: nextItem.name,
        plantUmlSource: nextItem.plantUmlSource,
        readOnly: session.readOnly,
        createdAt: nextItem.createdAt,
        updatedAt: nextItem.updatedAt,
        idle: false,
      });
      return;
    }

    openSequenceEditor({
      idle: true,
      diagramName: '',
      plantUmlSource: '',
      readOnly: session.readOnly,
    });
  }, [session, model, updateContainer, updateComponent]);

  const handleClose = useCallback(() => {
    closeSequenceEditor();
    const trail = getNavTrailSnapshot();
    const last = trail[trail.length - 1];
    if (last?.kind === 'sequence') {
      popNavTrail();
    }
    const docs = getDocumentationEditorSession();
    if (docs?.hidden) setDocumentationEditorHidden(false);
  }, []);

  useSyncExternalStore(
    subscribeSequenceLocks,
    getSequenceLocksSnapshot,
    getSequenceLocksSnapshot
  );
  const { t } = useTranslation();

  const listItems = useMemo((): SequenceListItem[] => {
    if (!session) return [];
    const persisted = listProjectSequences(model);
    if (session.idle || session.diagramId) return persisted;
    const draft: SequenceListItem = {
      id: SEQUENCE_LIST_DRAFT_ID,
      name: session.diagramName || 'Untitled sequence',
      plantUmlSource: session.plantUmlSource,
      ownerType: session.ownerType || 'container',
      ownerId: session.ownerId || '',
      ownerName: session.ownerId
        ? session.ownerType === 'container'
          ? model.containers.find((c) => c.id === session.ownerId)?.name || ''
          : model.components.find((c) => c.id === session.ownerId)?.name || ''
        : '',
      label: session.diagramName || 'Untitled sequence',
      isDraft: true,
    };
    return [draft, ...persisted];
  }, [session, model]);

  const selectedListId = session?.idle
    ? null
    : (session?.diagramId ?? SEQUENCE_LIST_DRAFT_ID);

  const onSelectListItem = useCallback(
    (id: string) => {
      if (!session || id === selectedListId) return;
      if (id === SEQUENCE_LIST_DRAFT_ID) return;
      const item = listItems.find((d) => d.id === id);
      if (!item || item.isDraft) return;
      tryOpenSequenceEditor({
        ownerType: item.ownerType,
        ownerId: item.ownerId,
        diagramId: item.id,
        diagramName: item.name,
        plantUmlSource: item.plantUmlSource,
        readOnly: session.readOnly,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        idle: false,
      });
    },
    [session, selectedListId, listItems]
  );

  const onCreateDiagram = useCallback(() => {
    const name = 'Untitled sequence';
    openSequenceEditor({
      idle: false,
      diagramName: name,
      plantUmlSource: createEmptyDiagramSource(name),
      readOnly: session?.readOnly,
    });
  }, [session?.readOnly]);

  const isListItemLocked = useCallback(
    (item: SequenceListItem) => {
      if (item.isDraft || !item.ownerId) return false;
      if (session?.readOnly) return false;
      return Boolean(getSequenceDiagramLock(item.ownerType, item.ownerId, item.id));
    },
    [session?.readOnly]
  );

  const listItemLockLabel = useCallback(
    (item: SequenceListItem) => {
      if (item.isDraft || !item.ownerId) return null;
      const lock = getSequenceDiagramLock(item.ownerType, item.ownerId, item.id);
      return lock ? t('sequence_editing_by', { name: lock.name }) : null;
    },
    [t]
  );

  if (!session) return null;

  const bindValue =
    session.ownerType && session.ownerId
      ? `${session.ownerType}:${session.ownerId}`
      : '';

  return (
    <Suspense fallback={<RouteFallback />}>
      <SequenceEditorPlugin
        key={session.editorKey}
        initialSource={session.plantUmlSource}
        readOnly={session.readOnly}
        theme={mode === 'dark' ? 'dark' : 'light'}
        catalog={catalog}
        title={session.diagramName}
        bindValue={bindValue}
        persisted={Boolean(session.diagramId)}
        bindTargets={bindTargets}
        bindError={bindError}
        audit={{
          createdBy: session.createdBy,
          updatedBy: session.updatedBy,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        }}
        listItems={listItems}
        selectedListId={selectedListId}
        idle={Boolean(session.idle)}
        onSelectListItem={onSelectListItem}
        onCreateDiagram={session.readOnly ? undefined : onCreateDiagram}
        isListItemLocked={isListItemLocked}
        listItemLockLabel={listItemLockLabel}
        onBindChange={onBindChange}
        onDiagramNameChange={(name) => patchSequenceEditorSession({ diagramName: name })}
        onSave={onSave}
        onDelete={onDelete}
        onClose={handleClose}
      />
    </Suspense>
  );
}
