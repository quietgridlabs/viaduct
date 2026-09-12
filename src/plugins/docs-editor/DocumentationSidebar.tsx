import SidePanelShell, {
  PanelEmptyState,
  PanelListItem,
} from '@components/common/SidePanelShell';
import { Button } from '@chakra-ui/react';
import { useFlatC4Store } from '@archivisio/c4-modelizer-sdk';
import { Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { listInlineDocumentation } from './localDocs';
import { listEntityDocumentations } from './entityDocs';
import { auditFromInline } from './docAudit';
import { leaveWorkspaceOverlays } from '@/navigation/leaveWorkspaceOverlays';
import {
  closeDocumentationSidebar,
  getDocumentationContext,
  getDocumentationSidebar,
  openDocumentationEditor,
  subscribeDocumentationEditor,
  subscribeDocumentationSidebar,
} from './uiState';
import type { InlineDocumentation } from '@/types/c4Extensions';

type ListedDoc = {
  id: string;
  title: string;
  markdown: string;
  updatedLabel: string;
  ownerType: 'system' | 'container' | 'component' | 'code';
  ownerId: string;
  ownerName: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: { name: string; username: string };
  updatedBy?: { name: string; username: string };
};

export default function DocumentationSidebar() {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const sidebar = useSyncExternalStore(
    subscribeDocumentationSidebar,
    getDocumentationSidebar,
    () => null
  );
  const canEdit = useSyncExternalStore(
    subscribeDocumentationEditor,
    () => getDocumentationContext()?.canEdit !== false,
    () => true
  );
  const model = useFlatC4Store((s) => s.model);

  // Same source as the badge counter — never a separate API snapshot that can go stale.
  // Clone cards may project docs that aren't reachable via a local store lookup yet
  // (wrong ownerType, remote original) — fall back to what the badge already counted.
  const docs: ListedDoc[] = useMemo(() => {
    if (!sidebar) return [];
    const fromModel = listInlineDocumentation(model, sidebar.ownerType, sidebar.ownerId);
    const source: Array<
      InlineDocumentation & {
        ownerType: ListedDoc['ownerType'];
        ownerId: string;
        ownerName: string;
      }
    > = fromModel.length
      ? fromModel
      : listEntityDocumentations({ documentations: sidebar.documentations }).map((d) => ({
          ...d,
          ownerType: sidebar.ownerType,
          ownerId: sidebar.ownerId,
          ownerName: sidebar.ownerName,
        }));
    return source.map((d) => {
      const audit = auditFromInline(d);
      return {
        id: d.id,
        title: d.title,
        markdown: d.markdown,
        updatedLabel: d.updatedAt ? new Date(d.updatedAt).toLocaleString() : '',
        ownerType: d.ownerType,
        ownerId: d.ownerId,
        ownerName: d.ownerName,
        ...audit,
      };
    });
  }, [sidebar, model]);

  useEffect(() => {
    if (!sidebar) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (panelRef.current?.contains(target)) return;
      if (target.closest('[data-docs-sidebar-trigger]')) return;
      closeDocumentationSidebar();
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDocumentationSidebar();
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [sidebar]);

  if (!sidebar) return null;

  const openDoc = (doc: ListedDoc) => {
    const ctx = getDocumentationContext();
    if (!ctx) return;
    leaveWorkspaceOverlays({ resetTrail: true });
    openDocumentationEditor({
      projectId: ctx.mode === 'cloud' && ctx.projectId ? ctx.projectId : 'local',
      ownerType: doc.ownerType,
      ownerId: doc.ownerId,
      ownerName: doc.ownerName || sidebar.ownerName,
      docId: doc.id,
      title: doc.title,
      markdown: doc.markdown,
      canEdit: ctx.canEdit,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      createdBy: doc.createdBy,
      updatedBy: doc.updatedBy,
    });
    closeDocumentationSidebar();
  };

  const createNewDoc = () => {
    const ctx = getDocumentationContext();
    if (!ctx?.canEdit) return;
    leaveWorkspaceOverlays({ resetTrail: true });
    openDocumentationEditor({
      projectId: ctx.mode === 'cloud' && ctx.projectId ? ctx.projectId : 'local',
      ownerType: sidebar.ownerType,
      ownerId: sidebar.ownerId,
      ownerName: sidebar.ownerName,
      canEdit: true,
    });
    closeDocumentationSidebar();
  };

  return (
    <SidePanelShell
      panelRef={panelRef}
      data-panel="documentation"
      width="300px"
      title={t('documentation')}
      subtitle={sidebar.ownerName}
      onClose={closeDocumentationSidebar}
        footer={
          canEdit ? (
            <Button
              size="sm"
              width="full"
              variant="outline"
              onClick={createNewDoc}
              data-testid="docs-sidebar-new"
            >
              <Plus size={14} />
              {t('documentation_new')}
            </Button>
          ) : undefined
        }
      >
        {docs.length === 0 ? (
          <PanelEmptyState>{t('documentation_empty')}</PanelEmptyState>
        ) : (
          docs.map((doc) => (
            <PanelListItem
              key={doc.id}
              onClick={() => openDoc(doc)}
              title={doc.title}
              subtitle={doc.updatedLabel || undefined}
            />
          ))
        )}
      </SidePanelShell>
  );
}
