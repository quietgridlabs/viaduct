import type { CodeBlock, ComponentBlock, ContainerBlock, FlatC4Model, SystemBlock } from '@archivisio/c4-modelizer-sdk';
import { useFlatC4Store } from '@archivisio/c4-modelizer-sdk';
import {
  fetchProjectDocs,
  useCreateProjectDocForProject,
  useDeleteProjectDocForProject,
  useUpdateProjectDocForProject,
} from '@features/docs';
import {
  deleteProjectDocFromYDoc,
  ensureProjectDocInYDoc,
  setProjectDocOwnerInYDoc,
  type TextLike,
} from '@/community/stubs';
import type { InlineDocumentation, SequenceDiagramExtras, StoredSequenceDiagram } from '@/types/c4Extensions';
import RouteFallback from '@components/RouteFallback';
import { useAuth } from '@contexts/AuthContext';
import { personRefFromUser } from '@utils/audit';
import { tryOpenSequenceEditor } from '@plugins/sequence-editor/uiState';
import { requestDiagramFocus } from '@/navigation/diagramFocusBus';
import { leaveCatalogOrFlows } from '@/navigation/leaveCatalogOrFlows';
import { ensureNavTrailRoot, pushNavTrail, resetNavTrailToDiagram } from '@/navigation/navTrail';
import { Suspense, lazy, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  getDocsCollabApi,
  getDocsEditingPeersSnapshot,
  subscribeDocsCollab,
} from './collabBridge';
import { auditFromInline, mergeInlineAudit, personFromDocApi } from './docAudit';
/* `import type`, not `import { type … }`: the latter still emits a runtime
   import of the module, which would keep Monaco on the static graph and make
   the lazy boundary below do nothing. */
import type { BindTargetOption } from './DocumentationEditorPlugin';
import type { ResolvedSequenceRef } from './DocumentationPreview';
import type { ResolvedChannelRef } from './channelRefs';
import {
  collectChannelIndex,
  collectChannelOptionsForOwner,
} from './channelRefs';
import { collectUiIndex, collectUiOptionsForOwner } from './uiRefs';
import type { ResolvedEndpointRef } from './endpointRefs';
import {
  collectEndpointIndex,
  collectEndpointOptionsForOwner,
} from './endpointRefs';
import {
  getInlineDocumentationById,
  listInlineDocumentation,
  newLocalDocId,
  resolveDocsEntity,
} from './localDocs';
import { DOC_LIST_DRAFT_ID, type DocListItem } from './docsList';
import { removeEntityDocumentation, upsertEntityDocumentation } from './entityDocs';
import { trackProductEvent } from '@/metrics';
import {
  closeDocumentationEditor,
  getDocumentationEditorSession,
  openDocumentationEditor,
  patchDocumentationEditorSession,
  setDocumentationEditorHidden,
  subscribeDocumentationEditor,
} from './uiState';

/*
 * The editing surface is loaded when a document is opened, not when the plugin
 * registers. It carries Monaco — 4.4 MB raw, 1.1 MB over the wire — and this
 * plugin is set up during editor boot, so a static import made every visit to
 * the canvas download a text editor nobody had asked for yet. The overlay
 * renders nothing until `session` exists (see below), so there is no surface
 * to keep warm in the meantime.
 */
const DocumentationEditorPlugin = lazy(() => import('./DocumentationEditorPlugin'));

type OwnerType = 'system' | 'container' | 'component' | 'code';
type SequenceOwnerType = 'container' | 'component';

function applyDocToModel(
  model: FlatC4Model,
  ownerType: OwnerType,
  ownerId: string,
  doc: InlineDocumentation | undefined,
  removeDocId: string | undefined,
  updateSystem: (id: string, patch: Partial<SystemBlock>) => void,
  updateContainer: (id: string, patch: Partial<ContainerBlock>) => void,
  updateComponent: (id: string, patch: Partial<ComponentBlock>) => void,
  updateCode: (id: string, patch: Partial<CodeBlock>) => void
) {
  const resolved = resolveDocsEntity(model, ownerType, ownerId);
  const entity = resolved?.entity ?? null;
  const writeType = resolved?.ownerType ?? ownerType;
  const writeId = resolved?.entity.id ?? ownerId;
  const patch = doc
    ? upsertEntityDocumentation(entity, doc)
    : removeDocId
      ? removeEntityDocumentation(entity, removeDocId)
      : null;
  if (!patch) return;
  if (writeType === 'system') updateSystem(writeId, patch as Partial<SystemBlock>);
  else if (writeType === 'container') updateContainer(writeId, patch as Partial<ContainerBlock>);
  else if (writeType === 'component') updateComponent(writeId, patch as Partial<ComponentBlock>);
  else updateCode(writeId, patch as Partial<CodeBlock>);
}

function parseOwnerKey(key: string): { ownerType: OwnerType; ownerId: string } | null {
  const [ownerType, ownerId] = key.split(':');
  if (
    (ownerType === 'system' ||
      ownerType === 'container' ||
      ownerType === 'component' ||
      ownerType === 'code') &&
    ownerId
  ) {
    return { ownerType, ownerId };
  }
  return null;
}

function collectSequenceIndex(model: {
  containers: ContainerBlock[];
  components: ComponentBlock[];
}): Map<string, ResolvedSequenceRef> {
  const map = new Map<string, ResolvedSequenceRef>();
  const push = (
    ownerType: SequenceOwnerType,
    ownerId: string,
    diagrams: StoredSequenceDiagram[] | undefined
  ) => {
    for (const d of diagrams ?? []) {
      map.set(d.id, {
        id: d.id,
        name: d.name,
        plantUmlSource: d.plantUmlSource,
        ownerType,
        ownerId,
      });
    }
  };
  for (const c of model.containers) {
    push('container', c.id, (c as ContainerBlock & SequenceDiagramExtras).sequenceDiagrams);
  }
  for (const c of model.components) {
    push('component', c.id, (c as ComponentBlock & SequenceDiagramExtras).sequenceDiagrams);
  }
  return map;
}

function setYTextValue(text: TextLike, next: string) {
  const current = text.toString();
  if (current === next) return;
  text.delete(0, current.length);
  if (next) text.insert(0, next);
}

export default function DocumentationEditorOverlay() {
  const session = useSyncExternalStore(
    subscribeDocumentationEditor,
    getDocumentationEditorSession,
    () => null
  );
  const docsPeers = useSyncExternalStore(
    subscribeDocsCollab,
    getDocsEditingPeersSnapshot,
    () => []
  );
  const { user } = useAuth();
  const model = useFlatC4Store((s) => s.model);
  const updateSystem = useFlatC4Store((s) => s.updateSystem);
  const updateContainer = useFlatC4Store((s) => s.updateContainer);
  const updateComponent = useFlatC4Store((s) => s.updateComponent);
  const updateCode = useFlatC4Store((s) => s.updateCodeElement);
  const [savedSnapshot, setSavedSnapshot] = useState({ title: '', markdown: '', ownerKey: '', docId: '' });
  const [saving, setSaving] = useState(false);
  /* Cloud docs arrive over the network — the panes say so instead of showing
     an empty editor that fills in a moment later. */
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [collabMarkdown, setCollabMarkdown] = useState<TextLike | null>(null);
  const [collabTitle, setCollabTitle] = useState<TextLike | null>(null);

  const queryClient = useQueryClient();
  const createProjectDoc = useCreateProjectDocForProject();
  const updateProjectDoc = useUpdateProjectDocForProject();
  const deleteProjectDoc = useDeleteProjectDocForProject();

  const docsCollab = getDocsCollabApi();
  const liveSync = Boolean(docsCollab.enabled && session?.docId && collabMarkdown);

  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (!session || session.hidden) return;
    leaveCatalogOrFlows(location.pathname, navigate);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reopen only on editor identity / hide
  }, [session?.editorKey, session?.hidden, location.pathname, navigate]);

  /* The manager itself is not a place you navigate to — only an open page is.
     A crumb for it would sit in the pill saying nothing. */
  useEffect(() => {
    if (!session || session.hidden || session.idle) return;
    ensureNavTrailRoot();
    pushNavTrail({
      kind: 'documentation',
      label: session.title || 'Documentation',
      id: `docs_${session.editorKey}`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- trail follows editor identity
  }, [session?.editorKey]);

  const bindTargets = useMemo((): BindTargetOption[] => {
    const targets: BindTargetOption[] = [];
    for (const s of model.systems) {
      targets.push({ ownerType: 'system', ownerId: s.id, label: s.name, group: 'Systems' });
    }
    for (const c of model.containers) {
      targets.push({ ownerType: 'container', ownerId: c.id, label: c.name, group: 'Containers' });
    }
    for (const c of model.components) {
      const container = model.containers.find((x) => x.id === c.containerId);
      targets.push({
        ownerType: 'component',
        ownerId: c.id,
        label: c.name,
        group: `Components / ${container?.name || c.containerId}`,
      });
    }
    for (const c of model.codeElements) {
      const component = model.components.find((x) => x.id === c.componentId);
      targets.push({
        ownerType: 'code',
        ownerId: c.id,
        label: c.name,
        group: `Code / ${component?.name || c.componentId}`,
      });
    }
    return targets.sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));
  }, [model]);

  const sequenceIndex = useMemo(() => collectSequenceIndex(model), [model]);
  const endpointIndex = useMemo(() => collectEndpointIndex(model), [model]);
  const channelIndex = useMemo(() => collectChannelIndex(model), [model]);
  const uiIndex = useMemo(() => collectUiIndex(model), [model]);

  const boundEntity = useMemo(() => {
    if (!session) return null;
    if (session.ownerType === 'system') {
      return model.systems.find((x) => x.id === session.ownerId) as
        | (SystemBlock & SequenceDiagramExtras)
        | undefined;
    }
    if (session.ownerType === 'container') {
      return model.containers.find((x) => x.id === session.ownerId) as
        | (ContainerBlock & SequenceDiagramExtras)
        | undefined;
    }
    if (session.ownerType === 'component') {
      return model.components.find((x) => x.id === session.ownerId) as
        | (ComponentBlock & SequenceDiagramExtras)
        | undefined;
    }
    return model.codeElements.find((x) => x.id === session.ownerId) as
      | (CodeBlock & SequenceDiagramExtras)
      | undefined;
  }, [session, model]);

  const sequenceOptions = useMemo(() => {
    const list = boundEntity?.sequenceDiagrams ?? [];
    return list.map((d) => ({ id: d.id, name: d.name, plantUmlSource: d.plantUmlSource }));
  }, [boundEntity]);

  const endpointOptions = useMemo(() => {
    if (!session) return [];
    return collectEndpointOptionsForOwner(model, session.ownerType, session.ownerId);
  }, [session, model]);

  const channelOptions = useMemo(() => {
    if (!session) return [];
    return collectChannelOptionsForOwner(model, session.ownerType, session.ownerId);
  }, [session, model]);

  const uiOptions = useMemo(() => {
    if (!session) return [];
    return collectUiOptionsForOwner(model, session.ownerType, session.ownerId);
  }, [session, model]);

  const resolveSequence = useCallback(
    (id: string) => sequenceIndex.get(id) ?? null,
    [sequenceIndex]
  );

  const resolveEndpoint = useCallback(
    (id: string) => endpointIndex.get(id) ?? null,
    [endpointIndex]
  );

  const resolveChannel = useCallback(
    (id: string) => channelIndex.get(id) ?? null,
    [channelIndex]
  );

  const resolveUi = useCallback((id: string) => uiIndex.get(id) ?? null, [uiIndex]);

  const editingPeers = useMemo(() => {
    if (!session?.docId) return [];
    return docsPeers
      .filter((p) => p.docId === session.docId)
      .map((p) => ({ name: p.name, color: p.color }));
  }, [session?.docId, docsPeers]);

  useEffect(() => {
    if (!session) return;
    /* Spelled exactly as `bindValue` below: a session with no owner yet has an
       empty key, not "system:". They used to disagree, which made an untouched
       editor look unsaved the moment it opened. */
    const ownerKey = session.ownerId ? `${session.ownerType}:${session.ownerId}` : '';
    setSavedSnapshot({
      title: session.title,
      markdown: session.markdown,
      ownerKey,
      docId: session.docId || '',
    });
  }, [session?.editorKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const attachCollab = useCallback(
    (docId: string, seed: { title: string; markdown: string; ownerType: OwnerType; ownerId: string }) => {
      const ydoc = docsCollab.getYDoc();
      if (!docsCollab.enabled || !ydoc) {
        setCollabMarkdown(null);
        setCollabTitle(null);
        docsCollab.setEditingDoc(null);
        return;
      }
      const texts = ensureProjectDocInYDoc(ydoc, docId, seed);
      setCollabMarkdown(texts.markdown);
      setCollabTitle(texts.title);
      const canEdit = getDocumentationEditorSession()?.canEdit ?? false;
      docsCollab.setEditingDoc(canEdit ? docId : null);
      patchDocumentationEditorSession({
        title: texts.title.toString() || seed.title,
        markdown: texts.markdown.toString(),
      });
    },
    [docsCollab]
  );

  const loadBoundDoc = useCallback(async () => {
    if (!session) return;
    if (!session.ownerId) {
      setCollabMarkdown(null);
      setCollabTitle(null);
      docsCollab.setEditingDoc(null);
      return;
    }

    const isLocal = session.projectId === 'local';

    if (isLocal) {
      let inline = session.docId
        ? getInlineDocumentationById(model, session.ownerType, session.ownerId, session.docId)
        : null;
      if (!inline && session.canEdit) {
        const author = personRefFromUser(user);
        inline = mergeInlineAudit(
          null,
          {
            id: session.docId || newLocalDocId(),
            title: session.title || `${session.ownerName} documentation`,
            markdown: session.markdown || '',
          },
          author
        );
        applyDocToModel(
          model,
          session.ownerType,
          session.ownerId,
          inline,
          undefined,
          updateSystem,
          updateContainer,
          updateComponent,
          updateCode
        );
      }
      const title = inline?.title || `${session.ownerName} documentation`;
      const markdown = inline?.markdown || '';
      const docId = inline?.id;
      const audit = auditFromInline(inline);
      patchDocumentationEditorSession({
        docId,
        title,
        markdown,
        ...audit,
      });
      setSavedSnapshot({
        title,
        markdown,
        ownerKey: `${session.ownerType}:${session.ownerId}`,
        docId: docId || '',
      });
      setCollabMarkdown(null);
      setCollabTitle(null);
      docsCollab.setEditingDoc(null);
      return;
    }

    const docs = await fetchProjectDocs(queryClient, session.projectId, {
      ownerType: session.ownerType,
      ownerId: session.ownerId,
    });
    let doc = session.docId ? docs.find((d) => d.id === session.docId) : undefined;
    // New doc for this owner (Add): always create — never reuse docs[0].
    if (!doc && session.canEdit && !session.docId) {
      doc = await createProjectDoc.mutateAsync({
        projectId: session.projectId,
        payload: {
          ownerType: session.ownerType,
          ownerId: session.ownerId,
          title: session.title || `${session.ownerName} documentation`,
          markdown: session.markdown || '',
        },
      });
    }
    const title = doc?.title || `${session.ownerName} documentation`;
    const markdown = doc?.markdown || '';
    const audit = personFromDocApi(doc);
    patchDocumentationEditorSession({
      docId: doc?.id,
      title,
      markdown,
      ...audit,
    });
    setSavedSnapshot({
      title,
      markdown,
      ownerKey: `${session.ownerType}:${session.ownerId}`,
      docId: doc?.id || '',
    });
    if (doc?.id) {
      applyDocToModel(
        model,
        session.ownerType,
        session.ownerId,
        {
          id: doc.id,
          title,
          markdown,
          createdAt: audit.createdAt,
          updatedAt: audit.updatedAt,
          createdBy: audit.createdBy,
          updatedBy: audit.updatedBy,
        },
        undefined,
        updateSystem,
        updateContainer,
        updateComponent,
        updateCode
      );
      attachCollab(doc.id, {
        title,
        markdown,
        ownerType: session.ownerType,
        ownerId: session.ownerId,
      });
    } else {
      setCollabMarkdown(null);
      setCollabTitle(null);
      docsCollab.setEditingDoc(null);
    }
  }, [
    session,
    model,
    user,
    updateSystem,
    updateContainer,
    updateComponent,
    updateCode,
    attachCollab,
    docsCollab,
    queryClient,
    createProjectDoc,
  ]);

  useEffect(() => {
    if (!session) {
      setCollabMarkdown(null);
      setCollabTitle(null);
      docsCollab.setEditingDoc(null);
      return;
    }
    setLoadingDoc(true);
    void loadBoundDoc().finally(() => setLoadingDoc(false));
    return () => {
      docsCollab.setEditingDoc(null);
    };
    // Load once per editor instance. Attach changes stay draft until Save (!liveSync).
  }, [session?.editorKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!collabTitle) return;
    const onTitle = () => {
      patchDocumentationEditorSession({ title: collabTitle.toString() });
    };
    collabTitle.observe(onTitle);
    onTitle();
    return () => collabTitle.unobserve(onTitle);
  }, [collabTitle]);

  useEffect(() => {
    if (!collabMarkdown) return;
    const onMarkdown = () => {
      patchDocumentationEditorSession({ markdown: collabMarkdown.toString() });
    };
    collabMarkdown.observe(onMarkdown);
    onMarkdown();
    return () => collabMarkdown.unobserve(onMarkdown);
  }, [collabMarkdown]);

  /**
   * Every documentation page in the project, with the open one in its place —
   * the same list the sequence editor shows for diagrams. An unsaved page has
   * no id yet, so it rides along as a draft pinned to the top.
   */
  const listItems = useMemo((): DocListItem[] => {
    if (!session) return [];
    const stored = listInlineDocumentation(model);
    if (session.idle || session.docId) return stored;
    return [
      {
        id: DOC_LIST_DRAFT_ID,
        title: session.title,
        markdown: session.markdown,
        ownerType: session.ownerType,
        ownerId: session.ownerId,
        ownerName: session.ownerName,
        isDraft: true,
      },
      ...stored,
    ];
  }, [session, model]);

  const selectedListId = session?.idle ? null : (session?.docId ?? DOC_LIST_DRAFT_ID);

  /* A blank page appears when someone asks for one, not when they open the
     manager — same rule the sequence editor follows. */
  const onCreateDoc = useCallback(() => {
    if (!session) return;
    openDocumentationEditor({
      projectId: session.projectId,
      ownerType: 'system',
      ownerId: '',
      ownerName: '',
      title: '',
      markdown: '',
      canEdit: session.canEdit,
    });
  }, [session]);

  const onSelectListItem = useCallback(
    (id: string) => {
      if (!session || id === selectedListId || id === DOC_LIST_DRAFT_ID) return;
      const item = listItems.find((doc) => doc.id === id);
      if (!item || item.isDraft) return;
      openDocumentationEditor({
        projectId: session.projectId,
        ownerType: item.ownerType,
        ownerId: item.ownerId,
        ownerName: item.ownerName,
        docId: item.id,
        title: item.title,
        markdown: item.markdown,
        canEdit: session.canEdit,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        createdBy: item.createdBy,
        updatedBy: item.updatedBy,
      });
    },
    [session, selectedListId, listItems]
  );

  if (!session) return null;

  const bindValue = session.ownerId ? `${session.ownerType}:${session.ownerId}` : '';
  /* The manager has no document open, so there is nothing to lose by closing. */
  const dirty = session.idle
    ? false
    : liveSync
    ? bindValue !== savedSnapshot.ownerKey || (session.docId || '') !== savedSnapshot.docId
    : session.title !== savedSnapshot.title ||
      session.markdown !== savedSnapshot.markdown ||
      bindValue !== savedSnapshot.ownerKey ||
      (session.docId || '') !== savedSnapshot.docId;

  const onSave = async () => {
    if (!session.ownerId) return;
    setSaving(true);
    try {
      const title = collabTitle?.toString() || session.title;
      const markdown = collabMarkdown?.toString() || session.markdown;
      const isLocal = session.projectId === 'local';
      const prevOwner = parseOwnerKey(savedSnapshot.ownerKey);
      const nextOwnerKey = `${session.ownerType}:${session.ownerId}`;

      if (isLocal) {
        const docId = session.docId || newLocalDocId();
        const prev = getInlineDocumentationById(model, session.ownerType, session.ownerId, docId);
        const author = personRefFromUser(user);
        const inline = mergeInlineAudit(prev, { id: docId, title, markdown }, author);
        if (prevOwner && savedSnapshot.ownerKey !== nextOwnerKey && savedSnapshot.docId) {
          applyDocToModel(
            model,
            prevOwner.ownerType,
            prevOwner.ownerId,
            undefined,
            savedSnapshot.docId,
            updateSystem,
            updateContainer,
            updateComponent,
            updateCode
          );
        }
        applyDocToModel(
          model,
          session.ownerType,
          session.ownerId,
          inline,
          undefined,
          updateSystem,
          updateContainer,
          updateComponent,
          updateCode
        );
        patchDocumentationEditorSession({
          docId,
          title,
          markdown,
          ...auditFromInline(inline),
        });
        setSavedSnapshot({
          title,
          markdown,
          ownerKey: nextOwnerKey,
          docId,
        });
        /* A local project never reaches the API, so this is the only place
           its save can be counted. */
        trackProductEvent('docs.saved', { owner: session.ownerType });
        return;
      }

      const payload = {
        ownerType: session.ownerType,
        ownerId: session.ownerId,
        title,
        markdown,
      };
      const doc = session.docId
        ? await updateProjectDoc.mutateAsync({
            projectId: session.projectId,
            docId: session.docId,
            payload,
          })
        : await createProjectDoc.mutateAsync({ projectId: session.projectId, payload });
      const audit = personFromDocApi(doc);
      if (prevOwner && savedSnapshot.ownerKey !== nextOwnerKey && savedSnapshot.docId) {
        applyDocToModel(
          model,
          prevOwner.ownerType,
          prevOwner.ownerId,
          undefined,
          savedSnapshot.docId,
          updateSystem,
          updateContainer,
          updateComponent,
          updateCode
        );
      }
      const ydoc = docsCollab.getYDoc();
      if (ydoc && doc.id) {
        ensureProjectDocInYDoc(ydoc, doc.id, {
          title,
          markdown,
          ownerType: session.ownerType,
          ownerId: session.ownerId,
        });
        setProjectDocOwnerInYDoc(ydoc, doc.id, session.ownerType, session.ownerId);
        attachCollab(doc.id, {
          title,
          markdown,
          ownerType: session.ownerType,
          ownerId: session.ownerId,
        });
      }
      patchDocumentationEditorSession({
        docId: doc.id,
        title,
        markdown,
        ...audit,
      });
      applyDocToModel(
        model,
        session.ownerType,
        session.ownerId,
        {
          id: doc.id,
          title,
          markdown,
          createdAt: audit.createdAt,
          updatedAt: audit.updatedAt,
          createdBy: audit.createdBy,
          updatedBy: audit.updatedBy,
        },
        undefined,
        updateSystem,
        updateContainer,
        updateComponent,
        updateCode
      );
      setSavedSnapshot({
        title,
        markdown,
        ownerKey: nextOwnerKey,
        docId: doc.id,
      });
      /* No metric here: this path just wrote through the API, and the server
         counts it there — where collaborative and MCP writes are counted too. */
    } catch (err) {
      /* Counted, then rethrown: whoever called this still owns the error. */
      trackProductEvent('health.save_failed', { area: 'docs' });
      throw err;
    } finally {
      setSaving(false);
    }
  };

  /*
   * Back to the manager's own empty state, not out of the manager.
   *
   * Deleting one page is a thing you do *inside* the list, usually while
   * tidying several — closing the whole overlay threw away the place the
   * person was working and made them find their way back for the next one.
   */
  const returnToManagerRoot = () => {
    docsCollab.setEditingDoc(null);
    patchDocumentationEditorSession({
      idle: true,
      docId: undefined,
      ownerType: 'system',
      ownerId: '',
      ownerName: '',
      title: '',
      markdown: '',
      /* A fresh key so the editor below unmounts with the page it was
         holding rather than re-rendering around a document that is gone. */
      renewEditorKey: true,
    });
  };

  const onDelete = async () => {
    if (!session.docId) {
      /* Nothing saved yet — the draft is discarded by leaving it. */
      returnToManagerRoot();
      return;
    }
    const isLocal = session.projectId === 'local';
    if (isLocal) {
      applyDocToModel(
        model,
        session.ownerType,
        session.ownerId,
        undefined,
        session.docId,
        updateSystem,
        updateContainer,
        updateComponent,
        updateCode
      );
    } else {
      await deleteProjectDoc.mutateAsync({ projectId: session.projectId, docId: session.docId });
      const ydoc = docsCollab.getYDoc();
      if (ydoc) deleteProjectDocFromYDoc(ydoc, session.docId);
      applyDocToModel(
        model,
        session.ownerType,
        session.ownerId,
        undefined,
        session.docId,
        updateSystem,
        updateContainer,
        updateComponent,
        updateCode
      );
    }
    returnToManagerRoot();
  };

  return (
    <Suspense fallback={<RouteFallback />}>
      <DocumentationEditorPlugin
        key={session.editorKey}
        title={session.title}
        markdown={session.markdown}
        listItems={listItems}
        selectedListId={selectedListId}
        idle={Boolean(session.idle)}
        loading={loadingDoc}
        onSelectListItem={onSelectListItem}
        onCreateDoc={session.canEdit ? onCreateDoc : undefined}
        bindValue={bindValue}
        bindTargets={bindTargets}
        sequenceOptions={sequenceOptions}
        endpointOptions={endpointOptions}
        channelOptions={channelOptions}
        uiOptions={uiOptions}
        resolveSequence={resolveSequence}
        resolveEndpoint={resolveEndpoint}
        resolveChannel={resolveChannel}
        resolveUi={resolveUi}
        hidden={Boolean(session.hidden)}
        onOpenSequence={(ref) => {
          const entity =
            ref.ownerType === 'container'
              ? model.containers.find((c) => c.id === ref.ownerId)
              : model.components.find((c) => c.id === ref.ownerId);
          const diagrams = (entity as SequenceDiagramExtras | undefined)?.sequenceDiagrams;
          const stored = diagrams?.find((d: StoredSequenceDiagram) => d.id === ref.id);
          const opened = tryOpenSequenceEditor({
            ownerType: ref.ownerType,
            ownerId: ref.ownerId,
            diagramId: ref.id,
            diagramName: ref.name,
            plantUmlSource: ref.plantUmlSource,
            readOnly: !session.canEdit,
            createdAt: stored?.createdAt,
            updatedAt: stored?.updatedAt,
            createdBy: stored?.createdBy,
            updatedBy: stored?.updatedBy,
          });
          if (opened.ok) {
            /* Same stacking rule as jumping to an endpoint: keep the docs
               session mounted, but get it out of the way so the sequence
               editor is not trapped under the documentation glass. */
            setDocumentationEditorHidden(true);
            pushNavTrail({
              kind: 'sequence',
              label: ref.name || 'Sequence',
              id: `seq_${ref.id}`,
            });
          }
        }}
        onOpenEndpoint={(ref: ResolvedEndpointRef) => {
          const label = `${ref.method || 'GET'} ${ref.endpoint || ref.name}`;
          setDocumentationEditorHidden(true);
          pushNavTrail({
            kind: 'element',
            label,
            focusId: ref.id,
            id: `el_${ref.id}`,
          });
          requestDiagramFocus(ref.id);
        }}
        onOpenChannel={(ref: ResolvedChannelRef) => {
          setDocumentationEditorHidden(true);
          pushNavTrail({
            kind: 'element',
            label: ref.name,
            focusId: ref.id,
            id: `el_${ref.id}`,
          });
          requestDiagramFocus(ref.id);
        }}
        onOpenUi={(ref) => {
          setDocumentationEditorHidden(true);
          pushNavTrail({
            kind: 'element',
            label: ref.name,
            focusId: ref.id,
            id: `el_${ref.id}`,
          });
          requestDiagramFocus(ref.id);
        }}
        collabMarkdown={collabMarkdown}
        collabAwareness={docsCollab.getAwareness()}
        editingPeers={editingPeers}
        liveSync={liveSync}
        readOnly={!session.canEdit}
        saving={saving}
        dirty={dirty}
        audit={{
          createdBy: session.createdBy,
          updatedBy: session.updatedBy,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        }}
        onTitleChange={(next) => {
          if (collabTitle) setYTextValue(collabTitle, next);
          const titleChanged = next !== session.title;
          const author =
            titleChanged && session.canEdit ? personRefFromUser(user) : null;
          const now = new Date().toISOString();
          patchDocumentationEditorSession({
            title: next,
            ...(author
              ? {
                  updatedBy: author,
                  updatedAt: now,
                  createdBy: session.createdBy || author,
                  createdAt: session.createdAt || now,
                }
              : {}),
          });
        }}
        onMarkdownChange={(next) => {
          if (collabMarkdown) setYTextValue(collabMarkdown, next);
          const markdownChanged = next !== session.markdown;
          const author =
            markdownChanged && session.canEdit ? personRefFromUser(user) : null;
          const now = new Date().toISOString();
          patchDocumentationEditorSession({
            markdown: next,
            ...(author
              ? {
                  updatedBy: author,
                  updatedAt: now,
                  createdBy: session.createdBy || author,
                  createdAt: session.createdAt || now,
                }
              : {}),
          });
        }}
        onBindChange={(ownerType, ownerId) => {
          const target = bindTargets.find((x) => x.ownerType === ownerType && x.ownerId === ownerId);
          // Draft-only until Save (and until Save attachment in live sync).
          patchDocumentationEditorSession({
            ownerType,
            ownerId,
            ownerName: target?.label || ownerId,
          });
        }}
        onSave={() => void onSave()}
        onDelete={session.canEdit ? () => void onDelete() : undefined}
        onClose={() => {
          docsCollab.setEditingDoc(null);
          closeDocumentationEditor();
          resetNavTrailToDiagram();
        }}
      />
    </Suspense>
  );
}
