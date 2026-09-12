import { ENTRY_HASH } from '@/community/stubs';
import ElementLinksSidebar from '@/features/links/ElementLinksSidebar';
import { mergeDeclaredTags, useDeclaredTags } from '@/features/tags/declaredTags';
import {
  useFlatC4Store,
  useFlatEdges,
  useFlatModelActions,
  useFlatNavigation,
  useFlatStore,
} from '@archivisio/c4-modelizer-sdk';
import { isGuestUser, loginPagePath } from '@shared/api';
import { forgetEndpointOperation } from '@utils/serviceContract';
import { useProjectsQuery } from '@features/projects';
import { useSnapshotsQuery } from '@features/versions';
import EdgeActionMenu from '@components/EdgeActionMenu';
import NodeActionMenu from '@components/NodeActionMenu';
import { openServiceContract } from '@components/service-contract/UiState';
import ChannelContractOverlay from '@components/channel-contract/ChannelContractOverlay';
import ServiceContractOverlay from '@components/service-contract/ServiceContractOverlay';
import ErrorNotification from '@components/ErrorNotification';
import ToastNotification from '@components/ToastNotification';
import AppFooter from '@components/AppFooter';
import OnboardingWelcomeDialog, {
  hasSeenOnboarding,
  markOnboardingSeen,
} from '@components/OnboardingWelcomeDialog';
import OnboardingTipsTour, {
  hasSeenTipsTour,
} from '@components/OnboardingTipsTour';
import { buildStarterModel } from '@/data/templates/starterModel';
import SearchNodeBar from '@components/SearchNodeBar';
import {
  closeProjectsOverlay,
  getProjectsOverlay,
  openProjectsOverlay,
  subscribeProjectsOverlay,
} from '@/state/projectsOverlay';
import { useAuth } from '@contexts/AuthContext';
import { useConnectionTrace } from '@contexts/ConnectionTraceContext';
import { useDialogs } from '@contexts/DialogContext';
import { useFileOperations } from '@hooks/useFileOperations';
import { useYjsProject, type PresenceUser } from '@hooks/useYjsProject';
import type { PresenceView } from '@/community/presenceView';
import { presenceViewEqual } from '@/community/presenceView';
import type { ConnectionExtras, EdgePathType } from '@/types/c4Extensions';
import { collectModelGroups, collectModelTags, normalizeEdgePathType } from '@/types/c4Extensions';
import {
  createEmptyDiagramSource,
  openSequenceEditor,
  setSequenceEditorCanEdit,
} from '@plugins/sequence-editor';
import {
  openDocumentationEditor,
  setDocumentationContext,
} from '@plugins/docs-editor';
import { closeFloatingSidePanels } from '@/navigation/closeFloatingSidePanels';
import { leaveWorkspaceOverlays } from '@/navigation/leaveWorkspaceOverlays';
import { isDuckHopActive, subscribeDuckHop } from '@/state/duckHopGame';
import {
  getArchToolsPanel,
  subscribeArchToolsPanel,
} from '@plugins/arch-tools/uiState';
import {
  getDocumentationSidebar,
  subscribeDocumentationSidebar,
} from '@plugins/docs-editor/uiState';
import {
  getSequenceDiagramsSidebar,
  subscribeSequenceEditor,
} from '@plugins/sequence-editor/uiState';
import {
  closeDataFlowManager,
  getDataFlowPlayback,
  getDataFlowManager,
  getDataFlowSidebar,
  openDataFlowManager,
  openDataFlowPlayback,
  subscribeDataFlowPlayback,
} from '@plugins/data-flows/uiState';
import {
  closeCatalogOverlay,
  getCatalogOverlay,
  openCatalogOverlay,
  subscribeCatalogOverlay,
} from '@plugins/service-catalog/uiState';
import {
  closeBranchesOverlay,
  getBranchesOverlay,
  subscribeBranchesOverlay,
  closeChangeSetsOverlay,
  getChangeSetsOverlay,
  openChangeSetsOverlay,
  subscribeChangeSetsOverlay,
  closeCompareOverlay,
  getCompareOverlay,
  openCompareOverlay,
  subscribeCompareOverlay,
} from '@/community/stubs';
import {
  closeDomainsOverlay,
  getDomainsOverlay,
  subscribeDomainsOverlay,
} from '@features/domains';
import { subscribeWorkspaceNotice } from '@/state/workspaceNotice';
import {
  buildTraceFromContainerEdge,
  enrichConnectionInfo,
  findContainerConnection,
  findStoredConnection,
  relatedIdsForContainer,
} from '@utils/connectionTrace';
import {
  getModelDataFlows,
  highlightForSteps,
  initialOrBranchStepId,
  playbackHighlightSteps,
  preferredProjectForStage,
  stageAtStepIndex,
  viewForStage,
} from '@utils/dataFlows';
import { isBrokerTechnology } from '@utils/brokerTech';
import { isDatabaseSchemaView } from '@utils/databaseTech';
import {
  diagramFocusMatchesView,
  renderableViewLevel,
  resolveDiagramFocus,
} from '@utils/serviceCatalog';
import {
  subscribeDiagramFocus,
  takePendingDiagramFocus,
} from '@/navigation/diagramFocusBus';
import { ensureNavTrailRoot } from '@/navigation/navTrail';
import { useGlassSurface } from '@theme/glassSurfaces';
import { trackProductEvent } from '@/metrics';
import { Box, HStack, Text } from '@chakra-ui/react';
import QuackSpinner from '@components/QuackSpinner';
import ToolbarSlot from '@slots/ToolbarSlot';
import {
  attachToProject,
  threadBelongsToView,
  useThreads,
  type ThreadNodeData,
} from '@features/threads';
import EditorCanvasGraph from '@/pages/editor/EditorCanvasGraph';
import VersionRail from '@components/VersionRail';
import TagsRail from '@components/TagsRail';
import {
  EditorConfirmDialogs,
  EditorEditDialogs,
  EditorOverlays,
  EditorWorkspaceBanners,
  EditorWorkspaceLoadError,
  EditorWorkspaceLoading,
} from '@widgets/editor-workspace/components';
import { useEditorProject } from '@widgets/editor-workspace/hooks/useEditorProject';
import { ReactFlowProvider, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';

type EditorWorkspaceProps = {
  projectMode?: boolean;
  initialOverlay?: 'flows' | 'catalog' | 'change-sets' | null;
};

function EditorWorkspace({ projectMode = false, initialOverlay = null }: EditorWorkspaceProps) {
  const { t } = useTranslation();
  const glass = useGlassSurface();
  const { projectId, versionId } = useParams();
  /* Viewing a pinned snapshot: no live sync, no writing, and the banner says so. */
  const viewingVersion = Boolean(projectMode && projectId && versionId);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading, offline, logout } = useAuth();
  const signedIn = Boolean(user && !isGuestUser(user));
  const projectListQuery = useProjectsQuery(signedIn);
  /* Versions — and the change sets that stand on them — belong to people with
     an account. A share-link guest is here to read the diagram, not to pin
     history, compare revisions or hand work to an agent. */
  const versionsAvailable = Boolean(projectMode && projectId && user && !isGuestUser(user));
  const snapshotsQuery = useSnapshotsQuery(projectId, versionsAvailable);
  const compareVersions = useMemo(
    () =>
      (snapshotsQuery.data?.snapshots ?? [])
        .filter((s) => s.pinned === 1)
        .map((s) => ({ id: s.id, label: s.name || s.id.slice(0, 8) })),
    [snapshotsQuery.data]
  );
  const catalogFocusRef = useRef<string | null>(null);
  const applyingCatalogFocusRef = useRef(false);
  const applyingPlaybackRef = useRef(false);
  const previousPlaybackRef = useRef<ReturnType<typeof getDataFlowPlayback> | null>(null);
  const pendingRestoreViewRef = useRef<{
    viewLevel: 'system' | 'container' | 'component' | 'code';
    activeSystemId?: string;
    activeContainerId?: string;
    activeComponentId?: string;
  } | null>(null);
  /* The manager is opened from three places — the folder in the pill, the
     redirect after signing in, and this component when an account has nothing
     to open — so the flag lives outside all of them. */
  const projectsOpen = useSyncExternalStore(
    subscribeProjectsOverlay,
    getProjectsOverlay,
    getProjectsOverlay
  );
  const setProjectsOpen = (next: boolean) => {
    if (!next) {
      closeProjectsOverlay();
      return;
    }
    openProjectsOverlay();
    leaveWorkspaceOverlays({ keepProjects: true });
  };
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [tipsTourOpen, setTipsTourOpen] = useState(false);
  const [pendingProjectsOpen, setPendingProjectsOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const threadsProjectId = projectMode && projectId ? projectId : null;
  const threads = useThreads(threadsProjectId);

  useEffect(() => {
    if (searchParams.get('projects') !== '1') return;
    const next = new URLSearchParams(searchParams);
    next.delete('projects');
    setSearchParams(next, { replace: true });
    if (hasSeenOnboarding()) {
      setProjectsOpen(true);
    } else {
      // After OAuth we land on ?projects=1 — hold the drawer until onboarding is resolved.
      setPendingProjectsOpen(true);
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    ensureNavTrailRoot();
  }, []);


  useEffect(() => {
    if (!initialOverlay) return;
    if (initialOverlay === 'flows') {
      openDataFlowManager();
      closeCatalogOverlay();
      closeChangeSetsOverlay();
      closeDomainsOverlay();
      return;
    }
    if (initialOverlay === 'catalog') {
      openCatalogOverlay();
      closeDataFlowManager();
      closeChangeSetsOverlay();
      closeDomainsOverlay();
      return;
    }
    if (initialOverlay === 'change-sets') {
      openChangeSetsOverlay();
      closeCatalogOverlay();
      closeDataFlowManager();
      closeDomainsOverlay();
    }
  }, [initialOverlay]);

  /* Someone without an account can still type the change-sets URL. Wait for
     the answer — `user` is null while auth is in flight, and closing on that
     would shut the surface on the very people allowed to see it. */
  useEffect(() => {
    if (authLoading || versionsAvailable) return;
    closeChangeSetsOverlay();
    closeBranchesOverlay();
    closeCompareOverlay();
  }, [authLoading, versionsAvailable]);

  /* Deep-link restore: ?compare=1&cleft=&cright=&csubject=&cstep=&carm= */
  useEffect(() => {
    if (!versionsAvailable || !projectId) return;
    if (searchParams.get('compare') !== '1') return;
    if (getCompareOverlay()) return;
    const left = searchParams.get('cleft') || undefined;
    const right = searchParams.get('cright') || undefined;
    const subject = (searchParams.get('csubject') || 'project') as
      | 'project'
      | `element:${string}`
      | `flow:${string}`;
    const stepRaw = searchParams.get('cstep');
    const armRaw = searchParams.get('carm');
    const arm =
      armRaw === 'before' || armRaw === 'after' || armRaw === 'both' ? armRaw : undefined;
    openCompareOverlay({
      left,
      right,
      subject,
      step: stepRaw != null ? Number(stepRaw) : undefined,
      arm,
      ready: true,
    });
  }, [versionsAvailable, projectId, searchParams]);

  useEffect(() => {
    if (authLoading) return;
    if (hasSeenOnboarding()) {
      if (pendingProjectsOpen && user) {
        setProjectsOpen(true);
        setPendingProjectsOpen(false);
      }
      return;
    }

    // Guest first visit — local editor welcome (no login required).
    if (!user || isGuestUser(user)) {
      if (!projectMode) {
        if (!user) setOnboardingOpen(true);
      }
      return;
    }

    if (projectListQuery.isError) {
      if (pendingProjectsOpen) {
        setProjectsOpen(true);
        setPendingProjectsOpen(false);
      }
      return;
    }

    if (!projectListQuery.isSuccess || !projectListQuery.data) return;

    const mine = projectListQuery.data.filter((p) => p.mine !== false && p.access === 'owner');
    if (mine.length === 0) {
      setProjectsOpen(false);
      setOnboardingOpen(true);
    } else {
      markOnboardingSeen();
      if (pendingProjectsOpen) {
        setProjectsOpen(true);
        setPendingProjectsOpen(false);
      }
    }
  }, [
    user,
    authLoading,
    pendingProjectsOpen,
    projectMode,
    projectListQuery.isError,
    projectListQuery.isSuccess,
    projectListQuery.data,
  ]);

  // Guest tips tour — after welcome dialog, once per browser.
  useEffect(() => {
    if (authLoading || user || projectMode) return;
    if (onboardingOpen) return;
    if (!hasSeenOnboarding()) return;
    if (hasSeenTipsTour()) return;
    const timer = window.setTimeout(() => setTipsTourOpen(true), 320);
    return () => window.clearTimeout(timer);
  }, [authLoading, user, projectMode, onboardingOpen]);

  const {
    dialogOpen,
    isEditingContainer,
    connectionDialogOpen,
    editingConnection,
    notificationError,
    editingElement,
    setNotificationError,
    closeEditDialog,
    closeConnectionDialog,
    openEditDialog,
    openConnectionDialog,
  } = useDialogs();

  const { trace, startTrace, clearTrace } = useConnectionTrace();
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [focusRequestTick, setFocusRequestTick] = useState(0);
  const [edgeMenu, setEdgeMenu] = useState<{
    anchor: { top: number; left: number };
    sourceId: string;
    targetId: string;
    edgeId: string;
  } | null>(null);
  const [nodeMenu, setNodeMenu] = useState<{
    anchor: { top: number; left: number };
    nodeId: string;
  } | null>(null);
  const [pendingDeleteEdge, setPendingDeleteEdge] = useState<{
    sourceId: string;
    targetId: string;
    edgeId: string;
  } | null>(null);
  const [pendingDeleteNodeId, setPendingDeleteNodeId] = useState<string | null>(null);
  const [fkDialog, setFkDialog] = useState<{
    sourceId: string;
    targetId: string;
    edgeId: string;
  } | null>(null);

  const closeCanvasMenus = useCallback(() => {
    setEdgeMenu(null);
    setNodeMenu(null);
  }, []);

  const { navigateToComponent, navigateToView } = useFlatNavigation();
  const { getBlockById } = useFlatStore();
  const { model, resetStore, handleNodeDelete } = useFlatModelActions();
  const setModel = useFlatC4Store((s) => s.setModel);
  const updateSystem = useFlatC4Store((s) => s.updateSystem);
  const updateContainer = useFlatC4Store((s) => s.updateContainer);
  const updateComponent = useFlatC4Store((s) => s.updateComponent);
  const updateCode = useFlatC4Store((s) => s.updateCodeElement);
  const updateConnection = useFlatC4Store((s) => s.updateConnection);

  const {
    signInRequired,
    projectName,
    projectInitialLoading,
    projectRestoring,
    loadError,
    projectStale,
    versionMeta,
    access,
    canWrite,
    trunkProtected,
    collabEnabled,
    versionNamePattern,
    handleRenameProject,
    handleManualSave,
  } = useEditorProject({
    projectMode,
    projectId,
    versionId,
    user,
    authLoading,
    viewingVersion,
    model,
    setModel,
    setNotificationError,
  });

  useEffect(() => {
    const id = searchParams.get('focus');
    const flowId = searchParams.get('flow');
    if (!id && !flowId) return;

    if (flowId) {
      /* The live model, not a `getState()` snapshot: a continuation jump
         lands on a project whose data may still be arriving — still loading,
         or cached from an earlier visit and about to be replaced — and the
         flow only becomes findable once it settles. Nothing below strips the
         query param, the one chance this effect gets to act on it, until
         either the flow turns up or this project's own load has genuinely
         finished without it (see the render-time reset in useEditorProject
         for why `projectInitialLoading` is trustworthy on the very first
         render for a new project, not just from the next one on). */
      const flows = getModelDataFlows(model);
      const flow = flows.find((item) => item.id === flowId);
      if (!flow && projectMode && projectInitialLoading) return;
      const stepId = searchParams.get('step');
      const found = stepId ? flow?.steps.findIndex((s) => s.id === stepId) ?? 0 : 0;
      const stepIndex = found < 0 ? 0 : found;
      openDataFlowPlayback({
        flowId,
        stepIndex,
        stepCount: flow?.steps.length ?? 0,
        homeProjectId: projectId,
        flowSnapshot: flow,
        branchStepId: flow
          ? initialOrBranchStepId(flow.steps, stepIndex, stepId)
          : null,
      });
    }
    if (id) {
      catalogFocusRef.current = id;
      applyingCatalogFocusRef.current = true;
      setFocusNodeId(null);
      setFocusRequestTick((n) => n + 1);
    }
    const next = new URLSearchParams(searchParams);
    next.delete('focus');
    next.delete('flow');
    next.delete('step');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, projectMode, projectInitialLoading, projectId, model]);

  /* How deep people actually go. Watching the level itself rather than the
     controls that change it catches every route in: breadcrumb, drill-down,
     back button, a flow jumping to another level. */
  const lastLevel = useRef(model.viewLevel);
  useEffect(() => {
    if (model.viewLevel === lastLevel.current) return;
    lastLevel.current = model.viewLevel;
    trackProductEvent('editor.level_changed', { to: model.viewLevel });
  }, [model.viewLevel]);

  /* One per project opened. The id stays out of it — the metric is that a
     model was opened at all, not which one. */
  useEffect(() => {
    if (!projectMode || !projectId || projectInitialLoading || loadError) return;
    trackProductEvent('project.opened');
  }, [projectMode, projectId, projectInitialLoading, loadError]);

  useEffect(() => {
    const st = location.state as {
      restoreView?: {
        viewLevel?: 'system' | 'container' | 'component' | 'code';
        activeSystemId?: string;
        activeContainerId?: string;
        activeComponentId?: string;
      };
      focusElementId?: string;
    } | null;
    if (!st?.restoreView?.viewLevel && !st?.focusElementId) return;
    if (st.restoreView?.viewLevel) {
      pendingRestoreViewRef.current = {
        viewLevel: st.restoreView.viewLevel,
        activeSystemId: st.restoreView.activeSystemId,
        activeContainerId: st.restoreView.activeContainerId,
        activeComponentId: st.restoreView.activeComponentId,
      };
    }
    if (st.focusElementId) {
      catalogFocusRef.current = st.focusElementId;
      applyingCatalogFocusRef.current = true;
      setFocusRequestTick((n) => n + 1);
    }
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    const pending = pendingRestoreViewRef.current;
    if (!pending) return;
    if (projectMode && projectInitialLoading) return;
    pendingRestoreViewRef.current = null;
    startTransition(() => {
      /* Opening a domain or a project names a level but no element, so the ids
         a deeper level needs may not be there. Asking for one anyway drew an
         empty board that only a reload cleared. */
      navigateToView(
        renderableViewLevel(pending),
        pending.activeSystemId,
        pending.activeContainerId,
        pending.activeComponentId
      );
    });
  }, [projectMode, projectInitialLoading, navigateToView]);
  /* The model's tags plus the ones named in the rail and not yet used: a tag
     you just invented is not on any element, so without this the panel where
     you would put it on one could not offer it. */
  const declaredTags = useDeclaredTags();
  const modelTagCatalog = useMemo(
    () => mergeDeclaredTags(collectModelTags(model), declaredTags),
    [model, declaredTags]
  );
  const modelGroupCatalog = useMemo(() => collectModelGroups(model), [model]);

  const [followFocus, setFollowFocus] = useState<{
    x: number;
    y: number;
    requestId: number;
    viewKey: string;
  } | null>(null);

  /* A protected project reads like a view-only one at the canvas, which is
     exactly what it is: the way to change it is a branch. */
  const viewOnly = access === 'view' || viewingVersion || trunkProtected;
  const duckHopActive = useSyncExternalStore(subscribeDuckHop, isDuckHopActive);
  const canvasLocked = viewOnly || duckHopActive;

  const canImport = !projectMode || access === 'owner';
  /* The floating notices all hang off the top edge; stack them instead of
     letting the guest bar sit on top of the reconnecting one. */
  const guestBarVisible = false;
  const reconnecting = projectStale || (offline && projectMode);
  const noticeTop = guestBarVisible ? 118 : 64;
  const FLOAT_NOTICE_STEP = 48;

  const { synced, peers, setLocalCursor, setLocalDragging, setEditingLock, getEditingLock, awareness, pushLocalModel } = useYjsProject({
    projectId: projectId || '',
    user,
    enabled: collabEnabled && Boolean(user),
    canWrite,
  });

  const floatNotices: {
    key: string;
    testId?: string;
    message: string;
    spinnerSize: 'xs' | 'sm';
  }[] = [];
  if (reconnecting) {
    floatNotices.push({
      key: 'reconnecting',
      testId: 'project-reconnecting',
      message: t('project_reconnecting'),
      spinnerSize: 'xs',
    });
  }
  if (projectRestoring) {
    floatNotices.push({
      key: 'restoring',
      testId: 'project-restoring',
      message: t('project_restoring_state'),
      spinnerSize: 'xs',
    });
  }
  if (collabEnabled && !synced) {
    floatNotices.push({
      key: 'collab-sync',
      message: 'Connecting to live sync…',
      spinnerSize: 'sm',
    });
  }

  const threadNodes = useMemo(() => {
    if (!projectMode || !projectId) return [];
    const view = {
      viewLevel: model.viewLevel,
      activeSystemId: model.activeSystemId,
      activeContainerId: model.activeContainerId,
      activeComponentId: model.activeComponentId,
    };
    return threads
      .filter((thread) => threadBelongsToView(thread, view))
      .map((thread): import('@xyflow/react').Node => ({
      id: thread.id,
      type: 'thread',
      position: { x: thread.x, y: thread.y },
      draggable: !canvasLocked,
      selectable: !canvasLocked,
      data: {
        thread,
        projectId,
        currentUser: user ?? null,
        peers: [],
        canEdit: !canvasLocked,
      } satisfies ThreadNodeData,
    }));
  }, [
    threads,
    projectId,
    projectMode,
    user,
    canvasLocked,
    model.viewLevel,
    model.activeSystemId,
    model.activeContainerId,
    model.activeComponentId,
  ]);

  const showNotice = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  const closeToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  useEffect(() => subscribeWorkspaceNotice(showNotice), [showNotice]);

  const archToolsPanelOpen = useSyncExternalStore(
    subscribeArchToolsPanel,
    getArchToolsPanel,
    () => null
  );
  const documentationSidebarOpen = useSyncExternalStore(
    subscribeDocumentationSidebar,
    getDocumentationSidebar,
    () => null
  );
  const sequenceSidebarOpen = useSyncExternalStore(
    subscribeSequenceEditor,
    getSequenceDiagramsSidebar,
    () => null
  );
  const dataFlowPlayback = useSyncExternalStore(
    subscribeDataFlowPlayback,
    getDataFlowPlayback,
    () => null
  );
  const dataFlowManager = useSyncExternalStore(
    subscribeDataFlowPlayback,
    getDataFlowManager,
    () => null
  );
  const catalogOverlay = useSyncExternalStore(
    subscribeCatalogOverlay,
    getCatalogOverlay,
    () => null
  );
  const changeSetsOverlay = useSyncExternalStore(
    subscribeChangeSetsOverlay,
    getChangeSetsOverlay,
    () => null
  );
  const branchesOverlay = useSyncExternalStore(
    subscribeBranchesOverlay,
    getBranchesOverlay,
    () => null
  );
  const compareOverlay = useSyncExternalStore(
    subscribeCompareOverlay,
    getCompareOverlay,
    () => null
  );
  const domainsOverlay = useSyncExternalStore(
    subscribeDomainsOverlay,
    getDomainsOverlay,
    () => null
  );
  const dataFlowSidebarOpen = useSyncExternalStore(
    subscribeDataFlowPlayback,
    getDataFlowSidebar,
    () => null
  );

  useEffect(() => {
    if (!dataFlowPlayback) {
      const previous = previousPlaybackRef.current;
      previousPlaybackRef.current = null;
      if (previous?.returnView) {
        startTransition(() => {
          navigateToView(
            previous.returnView!.viewLevel,
            previous.returnView!.activeSystemId,
            previous.returnView!.activeContainerId,
            previous.returnView!.activeComponentId
          );
        });
      }
      return;
    }
    previousPlaybackRef.current = dataFlowPlayback;
  }, [dataFlowPlayback, navigateToView]);
  const rightListPanelOpen = Boolean(
    archToolsPanelOpen ||
      documentationSidebarOpen ||
      sequenceSidebarOpen ||
      dataFlowSidebarOpen
  );

  useEffect(() => {
    if (!rightListPanelOpen) return;
    if (dialogOpen) closeEditDialog();
    if (connectionDialogOpen) closeConnectionDialog();
    if (fkDialog) setFkDialog(null);
  }, [rightListPanelOpen, dialogOpen, connectionDialogOpen, fkDialog, closeEditDialog, closeConnectionDialog]);

  useEffect(() => {
    if (!duckHopActive) return;
    closeCanvasMenus();
    if (dialogOpen) closeEditDialog();
    if (connectionDialogOpen) closeConnectionDialog();
    if (fkDialog) setFkDialog(null);
    if (pendingDeleteNodeId) setPendingDeleteNodeId(null);
  }, [
    duckHopActive,
    closeCanvasMenus,
    dialogOpen,
    closeEditDialog,
    connectionDialogOpen,
    closeConnectionDialog,
    fkDialog,
    pendingDeleteNodeId,
  ]);

  const tryOpenEditDialog = useCallback(
    (id: string, isContainer = false) => {
      /* Duck hop takes the canvas over; view access does not. Someone with
         read access clicking a card wants to read it, and the panel is where
         a card is read — it opens sealed rather than not at all. */
      if (duckHopActive) return;
      if (collabEnabled && !viewOnly) {
        const lock = getEditingLock(id);
        if (lock) {
          showNotice(`This element is being edited by "${lock.name}"`);
        } else {
          setEditingLock(id);
        }
      }
      setFkDialog(null);
      openEditDialog(id, isContainer);
    },
    [duckHopActive, viewOnly, collabEnabled, getEditingLock, setEditingLock, openEditDialog, showNotice]
  );

  const finishEditDialog = useCallback(() => {
    if (collabEnabled) setEditingLock(null);
    closeEditDialog();
  }, [collabEnabled, setEditingLock, closeEditDialog]);

  useEffect(() => {
    if (!collabEnabled) return;
    if (!dialogOpen) setEditingLock(null);
  }, [dialogOpen, collabEnabled, setEditingLock]);

  const onEditSystem = useCallback(
    (id: string) => tryOpenEditDialog(id, false),
    [tryOpenEditDialog]
  );
  const onEditContainer = useCallback(
    (id: string) => tryOpenEditDialog(id, true),
    [tryOpenEditDialog]
  );
  const onEditComponent = useCallback(
    (id: string) => tryOpenEditDialog(id, false),
    [tryOpenEditDialog]
  );
  const onEditCode = useCallback(
    (id: string) => tryOpenEditDialog(id, false),
    [tryOpenEditDialog]
  );

  const schemaMode = isDatabaseSchemaView(model);

  const edgeActions = useMemo(
    () => ({
      onConnectionDialog: () => {},
      getTechnologyColor: () => '#1f75cb',
    }),
    []
  );
  const { handleConnectionSave, handleConnectionDelete } = useFlatEdges(edgeActions);

  useEffect(() => {
    const pending = takePendingDiagramFocus();
    if (pending) {
      catalogFocusRef.current = pending.id;
      applyingCatalogFocusRef.current = true;
      setFocusRequestTick((n) => n + 1);
    }
    return subscribeDiagramFocus((request) => {
      catalogFocusRef.current = request.id;
      applyingCatalogFocusRef.current = true;
      takePendingDiagramFocus();
      setFocusNodeId(null);
      setFocusRequestTick((n) => n + 1);
    });
  }, []);

  useEffect(() => {
    if (applyingCatalogFocusRef.current || applyingPlaybackRef.current || dataFlowPlayback) return;
    setFocusNodeId(null);
  }, [
    model.viewLevel,
    model.activeSystemId,
    model.activeContainerId,
    model.activeComponentId,
    dataFlowPlayback,
  ]);

  useEffect(() => {
    if (projectMode && projectInitialLoading) return;
    const id = catalogFocusRef.current;
    if (!id) return;
    const target = resolveDiagramFocus(model, id);
    if (!target) {
      catalogFocusRef.current = null;
      applyingCatalogFocusRef.current = false;
      return;
    }
    closeCatalogOverlay();
    if (!diagramFocusMatchesView(model, target)) {
      startTransition(() => {
        navigateToView(
          target.viewLevel,
          target.activeSystemId,
          target.activeContainerId,
          target.activeComponentId
        );
      });
      return;
    }
    const timer = window.setTimeout(() => {
      setFocusNodeId(id);
      catalogFocusRef.current = null;
      applyingCatalogFocusRef.current = false;
    }, 80);
    return () => window.clearTimeout(timer);
  }, [
    projectMode,
    projectInitialLoading,
    model,
    navigateToView,
    focusRequestTick,
  ]);

  useEffect(() => {
    if (!dataFlowPlayback) {
      applyingPlaybackRef.current = false;
      return;
    }
    if (projectMode && projectInitialLoading) return;
    const flow =
      dataFlowPlayback.flowSnapshot ||
      getModelDataFlows(model).find((item) => item.id === dataFlowPlayback.flowId);
    const stage = flow ? stageAtStepIndex(flow.steps, dataFlowPlayback.stepIndex)?.stage : null;
    if (!stage) return;

    const homeId = dataFlowPlayback.homeProjectId || projectId;
    const focusSteps = playbackHighlightSteps(stage, dataFlowPlayback.branchStepId);
    const preferred = preferredProjectForStage(model, focusSteps, homeId, projectId);
    if (preferred && projectId && preferred !== projectId) {
      navigate(`/projects/${preferred}`, {
        replace: false,
      });
      return;
    }

    const target = viewForStage(model, focusSteps);
    applyingPlaybackRef.current = true;
    if (!diagramFocusMatchesView(model, target)) {
      startTransition(() => {
        navigateToView(
          target.viewLevel,
          target.activeSystemId,
          target.activeContainerId,
          target.activeComponentId
        );
      });
      return;
    }
    const highlight = highlightForSteps(model, focusSteps);
    const firstId = highlight.nodeIds.values().next().value as string | undefined;
    const timer = window.setTimeout(() => {
      if (firstId) setFocusNodeId(firstId);
      applyingPlaybackRef.current = false;
    }, 80);
    return () => window.clearTimeout(timer);
  }, [
    dataFlowPlayback,
    projectMode,
    projectInitialLoading,
    model,
    navigateToView,
    projectId,
    navigate,
  ]);

  const handleHighlightChainFromMenu = useCallback(() => {
    if (!nodeMenu) return;
    setFocusNodeId(nodeMenu.nodeId);
    setNodeMenu(null);
  }, [nodeMenu]);

  /* Clicking the empty board is how you put the current thing down. It closed
     the element panel but not the connection one, which left the connection
     open over a canvas that had already moved on. */
  const handleClearFocusHighlight = useCallback(() => {
    if (dataFlowPlayback) return;
    setFocusNodeId(null);
    if (dialogOpen) closeEditDialog();
    if (connectionDialogOpen) closeConnectionDialog();
  }, [
    dataFlowPlayback,
    dialogOpen,
    closeEditDialog,
    connectionDialogOpen,
    closeConnectionDialog,
  ]);

  const nodeMenuIsClone = Boolean(
    nodeMenu && getBlockById(nodeMenu.nodeId)?.original
  );

  const relatedComponentOptions = useMemo(() => {
    if (!editingConnection || model.viewLevel !== 'container') return [];
    const source = model.containers.find((c) => c.id === editingConnection.sourceId);
    const target = model.containers.find((c) => c.id === editingConnection.targetId);
    if (!source || !target) return [];
    const names = new Map([
      [source.id, source.name],
      [target.id, target.name],
    ]);
    return model.components
      .filter((c) => c.containerId === source.id || c.containerId === target.id)
      .map((c) => ({
        ...c,
        containerName: names.get(c.containerId) || c.containerId,
      }))
      .sort((a, b) => {
        const byContainer = a.containerName.localeCompare(b.containerName);
        return byContainer !== 0 ? byContainer : a.name.localeCompare(b.name);
      });
  }, [editingConnection, model.viewLevel, model.containers, model.components]);

  const connectionChannelBinding = useMemo(() => {
    if (!editingConnection || model.viewLevel !== 'container') return null;
    const source = model.containers.find((c) => c.id === editingConnection.sourceId);
    const target = model.containers.find((c) => c.id === editingConnection.targetId);
    if (!source || !target) return null;
    const sourceIsBroker = isBrokerTechnology(source.technology);
    const targetIsBroker = isBrokerTechnology(target.technology);
    if (!sourceIsBroker && !targetIsBroker) return null;
    return { sourceIsBroker, targetIsBroker };
  }, [editingConnection, model.viewLevel, model.containers]);

  const openEdgeConnectionDialog = useCallback(
    (sourceId: string, targetId: string, edgeId: string) => {
      openConnectionDialog(
        enrichConnectionInfo(model, {
          id: edgeId,
          sourceId,
          targetId,
        })
      );
    },
    [model, openConnectionDialog]
  );

  const handleCanvasEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      if (duckHopActive) return;
      closeCanvasMenus();
      setEdgeMenu({
        anchor: { top: event.clientY, left: event.clientX },
        sourceId: edge.source,
        targetId: edge.target,
        edgeId: edge.id,
      });
    },
    [duckHopActive, closeCanvasMenus]
  );

  const handleCanvasNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (duckHopActive) return;
      closeCanvasMenus();
      setNodeMenu({
        anchor: { top: event.clientY, left: event.clientX },
        nodeId: node.id,
      });
    },
    [duckHopActive, closeCanvasMenus]
  );

  const editNodeFromMenu = useCallback(() => {
    if (!nodeMenu) return;
    const id = nodeMenu.nodeId;
    if (getBlockById(id)?.original) return;
    if (model.viewLevel === 'system') onEditSystem(id);
    else if (model.viewLevel === 'container') onEditContainer(id);
    else if (model.viewLevel === 'component') onEditComponent(id);
    else onEditCode(id);
  }, [nodeMenu, model.viewLevel, onEditSystem, onEditContainer, onEditComponent, onEditCode, getBlockById]);

  const compareNodeFromMenu = useCallback(
    (snapshotId: string) => {
      if (!nodeMenu || !projectId || !versionsAvailable) return;
      openCompareOverlay({
        left: `${projectId}@${snapshotId}`,
        right: versionId ? `${projectId}@${versionId}` : `${projectId}@current`,
        subject: `element:${nodeMenu.nodeId}`,
      });
      setNodeMenu(null);
    },
    [nodeMenu, projectId, versionId, versionsAvailable]
  );

  const deleteNodeFromMenu = useCallback(() => {
    if (!nodeMenu || canvasLocked) return;
    setPendingDeleteNodeId(nodeMenu.nodeId);
  }, [nodeMenu, canvasLocked]);

  const addSequenceFromMenu = useCallback(() => {
    if (!nodeMenu || canvasLocked) return;
    const level = model.viewLevel;
    if (level !== 'container' && level !== 'component') return;
    const block = getBlockById(nodeMenu.nodeId);
    if (block?.original) return;
    const name = block?.name || 'Untitled';
    const diagramName = `${name} sequence`;
    leaveWorkspaceOverlays({ resetTrail: true });
    openSequenceEditor({
      ownerType: level,
      ownerId: nodeMenu.nodeId,
      diagramName,
      plantUmlSource: createEmptyDiagramSource(diagramName),
    });
    setNodeMenu(null);
  }, [nodeMenu, canvasLocked, model.viewLevel, getBlockById]);

  /* Contracts hang off a container, so this is a container-level action: open
     the contract viewer already pointed at the file picker. */
  const importOpenApiFromMenu = useCallback(() => {
    if (!nodeMenu || canvasLocked) return;
    const block = getBlockById(nodeMenu.nodeId);
    if (!block || block.original) return;
    leaveWorkspaceOverlays({ resetTrail: true });
    openServiceContract({
      containerId: nodeMenu.nodeId,
      containerName: block.name || nodeMenu.nodeId,
      autoImport: true,
    });
    setNodeMenu(null);
  }, [nodeMenu, canvasLocked, getBlockById]);

  const addDocumentationFromMenu = useCallback(() => {
    if (!nodeMenu || canvasLocked) return;
    const level = model.viewLevel;
    const ownerType =
      level === 'system' || level === 'container' || level === 'component' || level === 'code'
        ? level
        : null;
    if (!ownerType) return;
    const block = getBlockById(nodeMenu.nodeId);
    if (block?.original) return;
    leaveWorkspaceOverlays({ resetTrail: true });
    // Always create a new doc — never reopen the first attached one.
    openDocumentationEditor({
      projectId: projectMode && projectId ? projectId : 'local',
      ownerType,
      ownerId: nodeMenu.nodeId,
      ownerName: block?.name || nodeMenu.nodeId,
      canEdit: projectMode ? !viewOnly : true,
    });
    setNodeMenu(null);
  }, [nodeMenu, canvasLocked, projectMode, projectId, model.viewLevel, getBlockById, viewOnly]);

  const exportElementFromMenu = useCallback(
    async (mode: 'element' | 'subtree' = 'element') => {
      if (!nodeMenu) return;
      const level = model.viewLevel;
      const ownerType =
        level === 'system' || level === 'container' || level === 'component' || level === 'code'
          ? level
          : null;
      if (!ownerType) return;
      const ownerId = nodeMenu.nodeId;
      setNodeMenu(null);
      try {
        const { exportElementArchive } = await import('@utils/exportElement');
        await exportElementArchive({
          model,
          ownerType,
          ownerId,
          projectId: projectMode && projectId ? projectId : null,
          mode,
        });
      } catch {
        showNotice(t('export_element_failed'));
      }
    },
    [nodeMenu, model, projectMode, projectId, showNotice, t]
  );

  /* Deletions started from a dialog rather than from the canvas — the canvas
     path counts itself in FlowCanvas, where the multi-select delete lives. */
  const deleteElementTracked = useCallback(
    (id: string) => {
      trackProductEvent('editor.element_deleted', { level: model.viewLevel });
      /* Same as on the canvas: an endpoint leaves the stored contract with
         its element, or it stays there with no way to reach it. */
      forgetEndpointOperation(
        model,
        model.components.find((c) => c.id === id) as {
          containerId?: string;
          endpoint?: string;
          method?: string;
        } | undefined,
        updateContainer
      );
      handleNodeDelete(id);
    },
    [handleNodeDelete, model, updateContainer]
  );

  const confirmDeleteNode = useCallback(() => {
    if (!pendingDeleteNodeId) return;
    deleteElementTracked(pendingDeleteNodeId);
    setPendingDeleteNodeId(null);
  }, [pendingDeleteNodeId, deleteElementTracked]);

  const pendingDeleteNodeName = pendingDeleteNodeId
    ? getBlockById(pendingDeleteNodeId)?.name || pendingDeleteNodeId
    : '';

  const editEdgeFromMenu = useCallback(() => {
    if (!edgeMenu) return;
    if (schemaMode) {
      closeFloatingSidePanels();
      closeEditDialog();
      setFkDialog({
        sourceId: edgeMenu.sourceId,
        targetId: edgeMenu.targetId,
        edgeId: edgeMenu.edgeId,
      });
      return;
    }
    openEdgeConnectionDialog(edgeMenu.sourceId, edgeMenu.targetId, edgeMenu.edgeId);
  }, [edgeMenu, schemaMode, openEdgeConnectionDialog, closeEditDialog]);

  const deleteEdgeFromMenu = useCallback(() => {
    if (!edgeMenu) return;
    setPendingDeleteEdge({
      sourceId: edgeMenu.sourceId,
      targetId: edgeMenu.targetId,
      edgeId: edgeMenu.edgeId,
    });
  }, [edgeMenu]);

  const confirmDeleteEdge = useCallback(() => {
    if (!pendingDeleteEdge) return;
    handleConnectionDelete(
      enrichConnectionInfo(model, {
        id: pendingDeleteEdge.edgeId,
        sourceId: pendingDeleteEdge.sourceId,
        targetId: pendingDeleteEdge.targetId,
      })
    );
    setPendingDeleteEdge(null);
  }, [pendingDeleteEdge, handleConnectionDelete, model]);

  const exploreContainerConnection = useCallback(
    (focusContainerId: string) => {
      if (!edgeMenu) return;
      const stored = findContainerConnection(model, edgeMenu.sourceId, edgeMenu.targetId);
      if (!relatedIdsForContainer(model, focusContainerId, stored).length) {
        showNotice('No related components in this container');
        return;
      }
      const next = buildTraceFromContainerEdge(
        model,
        edgeMenu.sourceId,
        edgeMenu.targetId,
        stored,
        focusContainerId
      );
      if (!next) {
        showNotice('Cannot explore this connection');
        return;
      }
      // Navigate first so a leftover container-level clearTrace effect cannot wipe the new session.
      setFocusNodeId(null);
      navigateToComponent(next.systemId, focusContainerId);
      startTrace(next);
      if (!next.highlightedIds.length) {
        showNotice('No components found for this connection yet');
      }
    },
    [edgeMenu, model, startTrace, navigateToComponent, showNotice]
  );

  const exploreMenuContainers = useMemo(() => {
    if (!edgeMenu) return [];
    const stored = findContainerConnection(model, edgeMenu.sourceId, edgeMenu.targetId);
    const source = model.containers.find((c) => c.id === edgeMenu.sourceId);
    const target = model.containers.find((c) => c.id === edgeMenu.targetId);
    const opts: { id: string; name: string; enabled: boolean }[] = [];
    if (source) {
      opts.push({
        id: source.id,
        name: source.name,
        enabled: relatedIdsForContainer(model, source.id, stored).length > 0,
      });
    }
    if (target && target.id !== source?.id) {
      opts.push({
        id: target.id,
        name: target.name,
        enabled: relatedIdsForContainer(model, target.id, stored).length > 0,
      });
    }
    return opts;
  }, [edgeMenu, model]);

  const edgeMenuPathType = useMemo(
    () =>
      normalizeEdgePathType(
        edgeMenu
          ? findStoredConnection(model, edgeMenu.sourceId, edgeMenu.targetId)?.pathType
          : undefined
      ),
    [edgeMenu, model]
  );

  const setEdgePathTypeFromMenu = useCallback(
    (pathType: EdgePathType) => {
      if (!edgeMenu) return;
      updateConnection(model.viewLevel, edgeMenu.sourceId, edgeMenu.targetId, {
        pathType,
      } as never);
    },
    [edgeMenu, model.viewLevel, updateConnection]
  );

  const saveConnectionWithRelated = useCallback(
    (connectionInfo: Parameters<typeof handleConnectionSave>[0] & ConnectionExtras) => {
      handleConnectionSave(connectionInfo);
      updateConnection(model.viewLevel, connectionInfo.sourceId, connectionInfo.targetId, {
        pathType: normalizeEdgePathType(connectionInfo.pathType),
        bidirectional: Boolean(connectionInfo.bidirectional),
        ...(model.viewLevel === 'container'
          ? {
              relatedComponentIds: connectionInfo.relatedComponentIds || [],
              channelRole: connectionInfo.channelRole,
            }
          : {}),
      } as never);
      // Refresh highlights only while actively exploring that edge — not on a plain container-level save.
      const exploringThisEdge =
        Boolean(trace) &&
        model.viewLevel === 'component' &&
        model.activeContainerId === trace?.focusContainerId &&
        trace?.sourceId === connectionInfo.sourceId &&
        trace?.targetId === connectionInfo.targetId;
      if (exploringThisEdge && trace) {
        const refreshed = buildTraceFromContainerEdge(
          useFlatC4Store.getState().model,
          connectionInfo.sourceId,
          connectionInfo.targetId,
          {
            targetId: connectionInfo.targetId,
            label: connectionInfo.label,
            technology: connectionInfo.technology,
            description: connectionInfo.description,
            relatedComponentIds: connectionInfo.relatedComponentIds,
          } as never,
          trace.focusContainerId
        );
        if (refreshed) startTrace(refreshed);
      }
    },
    [
      handleConnectionSave,
      model.viewLevel,
      model.activeContainerId,
      updateConnection,
      trace,
      startTrace,
    ]
  );

  useEffect(() => {
    if (!trace) return;
    // Explore is only meaningful on the focus container's component canvas.
    if (model.viewLevel !== 'component') {
      clearTrace();
      return;
    }
    if (
      model.activeContainerId &&
      model.activeContainerId !== trace.focusContainerId
    ) {
      clearTrace();
    }
  }, [
    trace,
    model.viewLevel,
    model.activeContainerId,
    clearTrace,
  ]);

  /* Published here rather than next to the query, because access is only known
     once the project has loaded — and the toolbar button lives in a plugin
     portal that cannot read it any other way. */
  useEffect(() => {
    attachToProject(threadsProjectId, canWrite);
  }, [threadsProjectId, canWrite]);

  useEffect(() => {
    if (projectMode && projectId) {
      /*
       * Documentation and sequence diagrams are model content, so they follow
       * the canvas rather than the role: a protected project takes no direct
       * edits at all, and a version being read is a past state. `canWrite`
       * answers a different question — may this person edit *anything here* —
       * and is still what pinning, branching and merging ask.
       */
      setDocumentationContext({ mode: 'cloud', projectId, canEdit: !viewOnly });
      setSequenceEditorCanEdit(!viewOnly);
      return () => {
        setDocumentationContext(null);
        setSequenceEditorCanEdit(true);
      };
    }
    // Guest / local editor — docs live inline on the model, no /api.
    setDocumentationContext({ mode: 'local', projectId: null, canEdit: true });
    setSequenceEditorCanEdit(true);
    return () => {
      setDocumentationContext(null);
      setSequenceEditorCanEdit(true);
    };
  }, [projectMode, projectId, viewOnly]);

  const { handleExport, handleFileInputChange } = useFileOperations();

  /* Dropping the canvas after logout is AuthProvider's job now — it clears the
     persisted flat store before navigating away so the next account does not
     inherit this session's project. */

  const handleFollowPeer = useCallback(
    (peer: PresenceUser) => {
      const state = awareness?.getStates().get(peer.clientId);
      const view = ((state?.view as PresenceView | undefined) || peer.view) as PresenceView;
      const cursor = state?.cursor as { x: number; y: number } | null | undefined;

      if (!view?.viewLevel) return;

      const local = {
        viewLevel: useFlatC4Store.getState().model.viewLevel,
        activeSystemId: useFlatC4Store.getState().model.activeSystemId,
        activeContainerId: useFlatC4Store.getState().model.activeContainerId,
        activeComponentId: useFlatC4Store.getState().model.activeComponentId,
      };

      const targetViewKey = [
        view.viewLevel,
        view.activeSystemId || '',
        view.activeContainerId || '',
        view.activeComponentId || '',
      ].join(':');

      if (!presenceViewEqual(local, view)) {
        startTransition(() => {
          navigateToView(
            view.viewLevel as import('@archivisio/c4-modelizer-sdk').ViewLevel,
            view.activeSystemId,
            view.activeContainerId,
            view.activeComponentId
          );
        });
      }

      if (cursor && typeof cursor.x === 'number' && typeof cursor.y === 'number') {
        setFollowFocus({
          x: cursor.x,
          y: cursor.y,
          requestId: Date.now(),
          viewKey: targetViewKey,
        });
      } else {
        setFollowFocus(null);
      }
    },
    [awareness, navigateToView]
  );

  const clearFollowFocus = useCallback(() => {
    setFollowFocus(null);
  }, []);

  const handleManualSaveRef = handleManualSave;

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!canImport) return;
      const file = e.target.files?.[0];
      if (!file) return;
      setImportLoading(true);
      handleFileInputChange(e, (err) => {
        setImportLoading(false);
        setNotificationError(err);
        if (!err && projectMode && canWrite) {
          setTimeout(() => {
            void handleManualSaveRef();
          }, 0);
        }
      });
      e.target.value = '';
    },
    [canImport, handleFileInputChange, projectMode, canWrite, handleManualSaveRef, setNotificationError]
  );

  const handleLogin = useCallback(() => {
    const returnTo =
      projectMode && projectId
        ? `/projects/${projectId}`
        : `${window.location.pathname}${window.location.search}`;
    navigate(loginPagePath(returnTo === '/' ? null : returnTo));
  }, [projectMode, projectId, navigate]);

  const handleLogoutClick = useCallback(() => {
    setLogoutConfirmOpen(true);
  }, []);

  const canvasHighlightEdge = useMemo(() => {
    if (connectionDialogOpen && editingConnection) {
      return {
        id: editingConnection.id,
        source: editingConnection.sourceId,
        target: editingConnection.targetId,
      };
    }
    if (fkDialog) {
      return {
        id: fkDialog.edgeId,
        source: fkDialog.sourceId,
        target: fkDialog.targetId,
      };
    }
    return null;
  }, [connectionDialogOpen, editingConnection, fkDialog]);

  if (projectMode && (authLoading || projectInitialLoading)) {
    return <EditorWorkspaceLoading />;
  }

  /*
   * No session on a project URL: go to the sign-in screen, do not describe it.
   *
   * A session that ends while the tab is open is already redirected from
   * `AuthContext`, but only when the app knew there was a user to lose. Open
   * the same URL again after the cookie has gone and there is no user to lose,
   * so that never fired and this landed on an interstitial announcing that
   * signing in was required and offering a button to go and do it.
   *
   * The whole location goes along, hash included: the editor keeps the level
   * and the element in the fragment, so without it a person is returned to the
   * project but not to the card they were on.
   */
  if (projectMode && signInRequired) {
    /* The entry fragment, not the live one: measured, the editor has already
       rewritten `#/system/<id>/container` down to `#/system` by the time this
       runs, because the level it rebuilds from is a model that never loaded. */
    const here = `${location.pathname}${location.search}${ENTRY_HASH}`;
    return <Navigate to={loginPagePath(here)} replace />;
  }

  if (projectMode && loadError) {
    return (
      <>
        <EditorWorkspaceLoadError
          loadError={loadError}
          user={user}
          projectId={projectId}
          onOpenProjects={() => setProjectsOpen(true)}
        />
      </>
    );
  }

  return (
    <ReactFlowProvider>
      <Box
        h="100%"
        display="flex"
        flexDirection="column"
        overflow="hidden"
        position="relative"
        bg="bg.canvas"
        color="fg.default"
      >
        <EditorWorkspaceBanners
          viewingVersion={viewingVersion}
          versionMeta={versionMeta}
          projectMode={projectMode}
          user={user}
          viewOnly={viewOnly}
          onBackToLive={() => navigate(`/projects/${projectId}`)}
          onSignIn={() => {
            const returnTo = projectId ? `/projects/${projectId}` : undefined;
            navigate(loginPagePath(returnTo));
          }}
        />
        <OnboardingWelcomeDialog
          open={onboardingOpen}
          mode={user ? 'cloud' : 'local'}
          onLocalTemplate={() => setModel(buildStarterModel())}
          onLocalBlank={() => resetStore()}
          onClose={() => setOnboardingOpen(false)}
          onSkip={() => {
            if (pendingProjectsOpen) {
              setProjectsOpen(true);
              setPendingProjectsOpen(false);
            }
          }}
        />
        <OnboardingTipsTour open={tipsTourOpen} onClose={() => setTipsTourOpen(false)} />
        <EditorConfirmDialogs
          logoutConfirmOpen={logoutConfirmOpen}
          logoutLoading={logoutLoading}
          onLogoutCancel={() => {
            if (logoutLoading) return;
            setLogoutConfirmOpen(false);
          }}
          onLogoutConfirm={() => {
            if (logoutLoading) return;
            setLogoutLoading(true);
            void logout()
              .then(() => {
                setLogoutConfirmOpen(false);
              })
              .finally(() => setLogoutLoading(false));
          }}
          pendingDeleteEdge={pendingDeleteEdge}
          onDeleteEdgeCancel={() => setPendingDeleteEdge(null)}
          onDeleteEdgeConfirm={confirmDeleteEdge}
          pendingDeleteNodeId={pendingDeleteNodeId}
          pendingDeleteNodeName={pendingDeleteNodeName}
          onDeleteNodeCancel={() => setPendingDeleteNodeId(null)}
          onDeleteNodeConfirm={confirmDeleteNode}
        />

        <Box flex="1" minH={0} position="relative" overflow="hidden" display="flex" flexDirection="column">
          <ToolbarSlot
            onExport={handleExport}
            onExportError={setNotificationError}
            onImport={handleImport}
            user={user}
            projectName={projectName}
            projectMode={projectMode}
            importLoading={importLoading}
            onLogin={handleLogin}
            onLogout={handleLogoutClick}
            onRenameProject={projectMode && canWrite ? handleRenameProject : undefined}
            viewOnly={viewOnly}
            readOnly={canvasLocked}
            canImport={canImport}
            peers={peers}
            onFollowPeer={collabEnabled ? handleFollowPeer : undefined}
          />
          {floatNotices.map((notice, index) => (
            <HStack
              key={notice.key}
              position="absolute"
              top={`${noticeTop + index * FLOAT_NOTICE_STEP}px`}
              left="50%"
              transform="translateX(-50%)"
              zIndex={1300}
              gap="8px"
              px="12px"
              py="8px"
              fontSize="sm"
              color="fg.muted"
              {...glass.floatBar}
              data-testid={notice.testId}
            >
              <QuackSpinner size={notice.spinnerSize} />
              <Text>{notice.message}</Text>
            </HStack>
          ))}
          <EditorCanvasGraph
            bottomLeft={
              <HStack gap="8px" align="flex-end">
              {versionsAvailable && projectId ? (
                <VersionRail
                  projectId={projectId}
                  trunkProtected={trunkProtected}
                  versionNamePattern={versionNamePattern}
                  /* Not while viewing a version: pinning captures the *live*
                     model, so the button would name something other than what
                     is on screen. */
                  canWrite={!versionId && (access === 'owner' || access === 'edit')}
                  activeVersionId={versionId ?? null}
                  onOpenVersion={(snapshotId: string) =>
                    navigate(`/projects/${projectId}/versions/${snapshotId}`)
                  }
                />
              ) : null}
              {/* Right of the version pill, as the tag catalogue is about the
                  model on screen rather than about which revision it is. */}
              <TagsRail canWrite={!canvasLocked} />
              </HStack>
            }
            threadProjectId={threadsProjectId}
            viewOnly={viewOnly}
            collabEnabled={collabEnabled}
            awareness={collabEnabled ? awareness : null}
            setLocalCursor={setLocalCursor}
            setLocalDragging={setLocalDragging}
            pushLocalModel={pushLocalModel}
            followFocus={followFocus}
            onFollowFocusApplied={clearFollowFocus}
            focusNodeId={focusNodeId}
            highlightNodeId={dialogOpen ? editingElement?.id ?? null : null}
            highlightEdge={canvasHighlightEdge}
            onPaneClick={dataFlowPlayback ? undefined : handleClearFocusHighlight}
            onNodeContextMenu={duckHopActive ? undefined : handleCanvasNodeContextMenu}
            onEdgeContextMenu={duckHopActive ? undefined : handleCanvasEdgeContextMenu}
            onClipboardNotice={showNotice}
            onEditComponent={onEditComponent}
            onEditSystem={onEditSystem}
            onEditContainer={onEditContainer}
            onEditCode={onEditCode}
            onSchemaFk={setFkDialog}
            extraNodes={threadNodes}
            onThreadDeleteDenied={() => showNotice('Only the thread creator can delete it')}
          />
          <EditorOverlays
            projectsOpen={projectsOpen}
            onCloseProjects={() => setProjectsOpen(false)}
            projectMode={projectMode}
            projectId={projectId}
            canWrite={canWrite}
            viewOnly={viewOnly}
            versionsAvailable={versionsAvailable}
            catalogOverlay={catalogOverlay}
            canAdminister={access === 'owner' || access === 'edit'}
            branchesOverlay={branchesOverlay}
            compareOverlay={compareOverlay}
            changeSetsOverlay={changeSetsOverlay}
            domainsOverlay={domainsOverlay}
            dataFlowManager={dataFlowManager}
          />
        <AppFooter variant="bar" />
        </Box>

        <EditorEditDialogs
          model={model}
          user={user}
          projectId={projectId}
          dialogOpen={dialogOpen}
          isEditingContainer={isEditingContainer}
          connectionDialogOpen={connectionDialogOpen}
          editingConnection={editingConnection}
          editingElement={editingElement}
          fkDialog={fkDialog}
          modelTagCatalog={modelTagCatalog}
          modelGroupCatalog={modelGroupCatalog}
          relatedComponentOptions={relatedComponentOptions}
          connectionChannelBinding={connectionChannelBinding}
          onCloseEdit={finishEditDialog}
          readOnly={viewOnly}
          onCloseConnection={closeConnectionDialog}
          onCloseFk={() => setFkDialog(null)}
          onUpdateSystem={updateSystem}
          onUpdateContainer={updateContainer}
          onUpdateComponent={updateComponent}
          onUpdateCode={updateCode}
          onUpdateConnection={updateConnection}
          onSaveConnection={saveConnectionWithRelated}
        />

        <SearchNodeBar />
        <ErrorNotification message={notificationError} />
        <ToastNotification message={toastMessage} onClose={closeToast} autoHideDuration={8000} />

        <EdgeActionMenu
          open={Boolean(edgeMenu)}
          anchorPosition={edgeMenu?.anchor ?? null}
          onClose={() => setEdgeMenu(null)}
          onEdit={editEdgeFromMenu}
          canEdit={!canvasLocked}
          onExplore={exploreContainerConnection}
          exploreContainers={exploreMenuContainers}
          onDelete={deleteEdgeFromMenu}
          showExplore={model.viewLevel === 'container'}
          canDelete={!canvasLocked}
          pathType={edgeMenuPathType}
          onPathTypeChange={canvasLocked ? undefined : setEdgePathTypeFromMenu}
        />
        <NodeActionMenu
          open={Boolean(nodeMenu)}
          anchorPosition={nodeMenu?.anchor ?? null}
          onClose={() => setNodeMenu(null)}
          onEdit={editNodeFromMenu}
          canEdit={!canvasLocked && !nodeMenuIsClone}
          compareVersions={compareVersions}
          onCompareWithVersion={
            versionsAvailable && compareVersions.length > 0 ? compareNodeFromMenu : undefined
          }
          onHighlightChain={handleHighlightChainFromMenu}
          onClearHighlight={handleClearFocusHighlight}
          showClearHighlight={Boolean(focusNodeId) && !dataFlowPlayback}
          onAddSequence={addSequenceFromMenu}
          showAddSequence={
            !canvasLocked &&
            (model.viewLevel === 'container' || model.viewLevel === 'component')
          }
          onAddDocumentation={addDocumentationFromMenu}
          showAddDocumentation={!canvasLocked}
          onImportOpenApi={importOpenApiFromMenu}
          showImportOpenApi={!canvasLocked && model.viewLevel === 'container'}
          canAdd={!nodeMenuIsClone}
          onExportElement={() => void exportElementFromMenu('element')}
          onExportElementSubtree={() => void exportElementFromMenu('subtree')}
          showExportSubtree={
            model.viewLevel === 'system' ||
            model.viewLevel === 'container' ||
            model.viewLevel === 'component'
          }
          onDelete={deleteNodeFromMenu}
          canDelete={!canvasLocked}
        />

        {/* Opened from the contract badge on a container — see
            components/service-contract/uiState. */}
        <ServiceContractOverlay />
        <ChannelContractOverlay />
        {/* Opened from the link mark on a card — features/links/uiState. */}
        <ElementLinksSidebar />
      </Box>
    </ReactFlowProvider>
  );
}

export default EditorWorkspace;
export type { EditorWorkspaceProps };
