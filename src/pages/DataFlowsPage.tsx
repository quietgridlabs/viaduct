import { loginPagePath } from '@shared/api';
import { useCatalogProject } from '@features/service-catalog';
import {
  useDeleteDataFlow,
  useUpsertDataFlow,
  useUpsertSequence,
} from '@features/data-flows';
import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import { useFlatC4Store } from '@archivisio/c4-modelizer-sdk';
import AppFooter from '@components/AppFooter';
import ConfirmDialog from '@components/common/ConfirmDialog';
import { DIALOG_PAD } from '@components/common/BaseEditDialog';
import { PanelFieldset, panelFlushFieldCss } from '@components/common/PanelForm';
import ThemedTextField from '@components/common/ThemedTextField';
import { ToolbarIconButton, TOOLBAR_ICON_SIZE } from '@components/common/ToolbarIconButton';
import { useAuth } from '@contexts/AuthContext';
import { openDataFlowPlayback } from '@plugins/data-flows/uiState';
import { openCompareOverlay } from '@/community/stubs';
import DataFlowAttachmentPanes, {
  DATA_FLOW_PANE_MIN_WIDTH,
} from '@plugins/data-flows/DataFlowAttachmentPanes';
import { applyMagicSequenceLocally } from '@plugins/data-flows/magicSequence';
import DataFlowsListPanel, {
  DataFlowsListSort,
  DataFlowsListTitle,
} from '@plugins/data-flows/DataFlowsListPanel';
import FlowStepPropertiesPanel from '@plugins/data-flows/FlowStepPropertiesPanel';
import FlowContinuationDialog from '@plugins/data-flows/FlowContinuationDialog';
import PanelCollapseRail from '@components/common/PanelCollapseRail';
import SidePanelShell from '@components/common/SidePanelShell';
import { MAGIC_FLOW_FG, MagicFlowIcon, MagicFlowTitle } from '@components/data-flow/MagicFlowMark';
import FlowStepGraph from '@components/data-flow/FlowStepGraph';
import {
  FLOW_STEP_RAIL_MAIN_X,
  flowRailGutter,
} from '@components/data-flow/FlowRailLayout';
import ToolbarSlot from '@slots/ToolbarSlot';
import { useGlassSurface } from '@theme/glassSurfaces';
import { MANAGER_BAR_MIN_H, SIDE_PANEL_INSET, WORKSPACE_CONTENT_TOP } from '@theme/sidePanelLayout';
import type { DataFlowStep, FlowBranchKind, StoredDataFlow } from '@/types/c4Extensions';
import { personRefFromUser, stampAuditCreate, stampAuditUpdate } from '@utils/audit';
import { buildModelIndex, validateFlow, type FlowStatus } from '@utils/flowValidation';
import FlowStatusIcon from '@components/data-flow/FlowStatusIcon';
import {
  addBranch,
  addStepToArm,
  dataFlowPlaybackPath,
  detachFromBranch,
  emptyDataFlow,
  emptyDataFlowStep,
  getModelDataFlows,
  groupFlowStages,
  initialOrBranchStepId,
  listFlowParticipantOptions,
  listStepChannelOptions,
  listStepConnectionOptions,
  listStepEndpointOptions,
  moveFlowStage,
  parseDataFlowSortKey,
  participantKey,
  persistDataFlow,
  removeFlowStep,
  sortDataFlows,
  swapStepDirection,
  withModelDataFlows,
  isDataFlowDraftDirty,
  type DataFlowSortKey,
} from '@utils/dataFlows';
import {
  flowMagicSequenceIsStale,
  resolveFlowSequenceOwner,
} from '@utils/flowToSequence';
import { leaveWorkspaceOverlays } from '@/navigation/leaveWorkspaceOverlays';
import { trackProductEvent } from '@/metrics';
import { ensureNavTrailRoot, pushNavTrail, resetNavTrailToDiagram } from '@/navigation/navTrail';
import {
  Box,
  Button,
  Heading,
  HStack,
  Text,
  VStack,
} from '@chakra-ui/react';
import QuackSpinner from '@components/QuackSpinner';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  GitCompareArrows,
  GitFork,
  Link2,
  Play,
  Plus,
  Save,
  Split,
  Trash2,
  Unlink,
  X
} from 'lucide-react';
import { startTransition, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

function flowsReturnPath(state: unknown): string | null {
  const candidates: unknown[] = [];
  if (state && typeof state === 'object') candidates.push((state as { from?: unknown }).from);
  try {
    candidates.push(sessionStorage.getItem('c4-flows-return'));
  } catch {
    /* ignore */
  }
  for (const from of candidates) {
    if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//')) continue;
    if (from === '/flows' || from.startsWith('/flows?') || from.startsWith('/flows#')) continue;
    return from;
  }
  return null;
}

function flowsReturnView(state: unknown):
  | { viewLevel: FlatC4Model['viewLevel']; activeSystemId?: string; activeContainerId?: string; activeComponentId?: string }
  | null {
  const candidates: unknown[] = [];
  if (state && typeof state === 'object') candidates.push((state as { returnView?: unknown }).returnView);
  try {
    const raw = sessionStorage.getItem('c4-flows-return-view');
    if (raw) candidates.push(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  for (const item of candidates) {
    if (!item || typeof item !== 'object') continue;
    const viewLevel = (item as { viewLevel?: unknown }).viewLevel;
    if (viewLevel !== 'system' && viewLevel !== 'container' && viewLevel !== 'component' && viewLevel !== 'code') {
      continue;
    }
    return {
      viewLevel,
      activeSystemId: (item as { activeSystemId?: string }).activeSystemId,
      activeContainerId: (item as { activeContainerId?: string }).activeContainerId,
      activeComponentId: (item as { activeComponentId?: string }).activeComponentId,
    };
  }
  return null;
}

function useMdUp() {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mql = window.matchMedia('(min-width: 48em)');
      mql.addEventListener('change', onStoreChange);
      return () => mql.removeEventListener('change', onStoreChange);
    },
    () => window.matchMedia('(min-width: 48em)').matches,
    () => true
  );
}

type PendingNav =
  | { type: 'close' }
  | { type: 'select'; id: string }
  | { type: 'create' }
  | { type: 'play'; flowId: string; stepId?: string };

function cloneFlow(flow: StoredDataFlow): StoredDataFlow {
  return structuredClone(flow);
}

type Props = {
  projectMode?: boolean;
  embedded?: boolean;
  onRequestClose?: () => void;
  initialFlowId?: string | null;
  initialStepId?: string | null;
  canWriteOverride?: boolean;
};

const SORT_STORAGE_KEY = 'c4-data-flow-list-sort';

function readStoredSort(): DataFlowSortKey {
  try {
    return parseDataFlowSortKey(localStorage.getItem(SORT_STORAGE_KEY));
  } catch {
    return 'updated';
  }
}

export default function DataFlowsPage({
  projectMode = false,
  embedded = false,
  onRequestClose,
  initialFlowId,
  initialStepId,
  canWriteOverride,
}: Props) {
  const { t } = useTranslation();
  const glass = useGlassSurface();
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading, logout } = useAuth();
  const model = useFlatC4Store((s) => s.model);
  const setModel = useFlatC4Store((s) => s.setModel);
  const isMdUp = useMdUp();

  const {
    projectName,
    access,
    canWrite: projectCanWrite,
    loading,
    loadError,
    handleRenameProject,
  } = useCatalogProject({
    projectMode,
    embedded,
    projectId,
    user,
    authLoading,
    setModel,
  });

  const upsertDataFlow = useUpsertDataFlow(projectId ?? '');
  const deleteDataFlow = useDeleteDataFlow(projectId ?? '');
  const upsertSequence = useUpsertSequence(projectId ?? '');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(true);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [continuationDialogOpen, setContinuationDialogOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<DataFlowSortKey>(readStoredSort);
  const [draft, setDraft] = useState<StoredDataFlow | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [magicSeqBusy, setMagicSeqBusy] = useState(false);
  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const [pendingNav, setPendingNav] = useState<PendingNav | null>(null);
  const appliedFlowQuery = useRef<string | null>(null);
  const pendingStepFromQuery = useRef<string | null>(null);
  const endpointOptionsCacheRef = useRef(new Map<string, ReturnType<typeof listStepEndpointOptions>>());
  const channelOptionsCacheRef = useRef(new Map<string, ReturnType<typeof listStepChannelOptions>>());
  const connectionOptionsCacheRef = useRef(new Map<string, ReturnType<typeof listStepConnectionOptions>>());

  const queryFlowId = embedded ? initialFlowId ?? null : searchParams.get('flow');
  const queryStepId = embedded ? initialStepId ?? null : searchParams.get('step');
  const returnTo = flowsReturnPath(location.state);
  const returnView = flowsReturnView(location.state);

  const flowsPath = projectMode && projectId ? `/projects/${projectId}/flows` : '/flows';
  const canWrite =
    typeof canWriteOverride === 'boolean'
      ? canWriteOverride
      : !projectMode || projectCanWrite;
  const flows = useMemo(() => getModelDataFlows(model), [model]);
  const savedSelected = flows.find((f) => f.id === selectedId) ?? null;
  const selected =
    draft && draft.id === selectedId ? draft : savedSelected;
  const dirty = Boolean(
    canWrite && draft && draft.id === selectedId && isDataFlowDraftDirty(draft, savedSelected)
  );
  const listFlows = useMemo(() => {
    if (!draft) return flows;
    if (flows.some((f) => f.id === draft.id)) {
      return flows.map((f) => (f.id === draft.id ? draft : f));
    }
    return [draft, ...flows];
  }, [flows, draft]);
  const sortedFlows = useMemo(() => sortDataFlows(listFlows, sort), [listFlows, sort]);
  const stepById = useMemo(() => {
    const map = new Map<string, DataFlowStep>();
    for (const step of selected?.steps ?? []) map.set(step.id, step);
    return map;
  }, [selected?.steps]);
  const selectedStep =
    (selectedStepId ? stepById.get(selectedStepId) ?? null : null) ??
    selected?.steps[0] ??
    null;
  const selectedStepRelationKey = selectedStep
    ? `${selectedStep.from.type}:${selectedStep.from.id}|${selectedStep.to.type}:${selectedStep.to.id}`
    : '';
  const optionsModel = model;

  useEffect(() => {
    endpointOptionsCacheRef.current.clear();
    channelOptionsCacheRef.current.clear();
    connectionOptionsCacheRef.current.clear();
  }, [optionsModel]);

  useEffect(() => {
    if (embedded) return;
    ensureNavTrailRoot();
    pushNavTrail({
      kind: 'flows',
      label: t('nav_trail_flows'),
      path: flowsPath,
      id: 'flows',
    });
  }, [embedded, flowsPath, t]);

  useEffect(() => {
    if (queryFlowId && queryFlowId !== appliedFlowQuery.current) {
      const exists = sortedFlows.some((f) => f.id === queryFlowId);
      if (!exists) {
        if (sortedFlows.length === 0) return;
        appliedFlowQuery.current = queryFlowId;
        if (!selectedId && sortedFlows[0]) setSelectedId(sortedFlows[0].id);
        return;
      }
      appliedFlowQuery.current = queryFlowId;
      pendingStepFromQuery.current = queryStepId;
      setSelectedId(queryFlowId);
      return;
    }
    if (!queryFlowId && !selectedId && sortedFlows[0]) setSelectedId(sortedFlows[0].id);
  }, [sortedFlows, selectedId, queryFlowId, queryStepId]);

  useEffect(() => {
    if (!selectedId) {
      setDraft(null);
      return;
    }
    setDraft((prev) => {
      if (prev?.id === selectedId) return prev;
      const saved = getModelDataFlows(useFlatC4Store.getState().model).find(
        (f) => f.id === selectedId
      );
      return saved ? cloneFlow(saved) : prev;
    });
  }, [selectedId]);

  useEffect(() => {
    if (!selected) return;
    const pending = pendingStepFromQuery.current;
    if (pending && selected.steps.some((s) => s.id === pending)) {
      pendingStepFromQuery.current = null;
      if (selectedStepId !== pending) setSelectedStepId(pending);
      return;
    }
    if (pending) pendingStepFromQuery.current = null;
    if (!selected.steps.some((s) => s.id === selectedStepId)) {
      setSelectedStepId(selected.steps[0]?.id ?? null);
    }
  }, [selected, selectedStepId]);

  const handleSortChange = useCallback((next: DataFlowSortKey) => {
    setSort(next);
    try {
      localStorage.setItem(SORT_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const closePage = useCallback(() => {
    if (embedded) {
      onRequestClose?.();
      return;
    }
    resetNavTrailToDiagram();
    navigate(returnTo || (projectMode && projectId ? `/projects/${projectId}` : '/'), {
      state: returnView ? { restoreView: returnView } : undefined,
    });
  }, [embedded, navigate, onRequestClose, projectMode, projectId, returnTo, returnView]);

  const commitModel = useCallback(
    (next: StoredDataFlow[]) => {
      const current = useFlatC4Store.getState().model;
      setModel(withModelDataFlows(current, next));
    },
    [setModel]
  );

  const persistFlowRemote = useCallback(
    async (flow: StoredDataFlow) => {
      if (!projectMode || !projectId || !canWrite) return;
      const payload = persistDataFlow(flow);
      await upsertDataFlow.mutateAsync({
        flowId: payload.id,
        name: payload.name,
        description: payload.description,
        steps: payload.steps,
        documentationIds: payload.documentationIds,
        sequenceIds: payload.sequenceIds,
        magicSequenceId: payload.magicSequenceId,
        magicSequenceSourceKey: payload.magicSequenceSourceKey,
      });
    },
    [canWrite, projectId, projectMode, upsertDataFlow]
  );

  const loadSavedFlow = useCallback((id: string) => {
    const saved = getModelDataFlows(useFlatC4Store.getState().model).find((f) => f.id === id);
    setSelectedId(id);
    setDraft(saved ? cloneFlow(saved) : null);
    setSaveError(null);
  }, []);

  const createFlow = useCallback(() => {
    if (!canWrite) return;
    setQuery('');
    const created: StoredDataFlow = {
      ...emptyDataFlow(t('data_flow_new')),
      ...stampAuditCreate(user),
    };
    setDraft(created);
    setSelectedId(created.id);
    setSelectedStepId(created.steps[0]?.id ?? null);
    setSaveError(null);
  }, [canWrite, t, user]);

  const startPlayback = useCallback(
    (flow: StoredDataFlow, stepId?: string) => {
      const stepIndex = Math.max(
        0,
        stepId ? flow.steps.findIndex((s) => s.id === stepId) : 0
      );
      leaveWorkspaceOverlays();
      const playbackReturnView = returnView ?? {
        viewLevel: model.viewLevel,
        activeSystemId: model.activeSystemId,
        activeContainerId: model.activeContainerId,
        activeComponentId: model.activeComponentId,
      };
      openDataFlowPlayback({
        flowId: flow.id,
        stepIndex,
        returnView: playbackReturnView,
        stepCount: flow.steps.length,
        homeProjectId: projectId,
        flowSnapshot: flow,
        branchStepId: initialOrBranchStepId(flow.steps, stepIndex, stepId),
      });
      if (!embedded) {
        navigate(dataFlowPlaybackPath(projectId, flow.id, flow.steps[stepIndex]?.id));
      }
    },
    [embedded, navigate, projectId, returnView, model]
  );

  const runPendingNav = useCallback(
    (action: PendingNav) => {
      if (action.type === 'close') {
        closePage();
        return;
      }
      if (action.type === 'select') {
        loadSavedFlow(action.id);
        return;
      }
      if (action.type === 'create') {
        createFlow();
        return;
      }
      const saved = getModelDataFlows(useFlatC4Store.getState().model).find(
        (f) => f.id === action.flowId
      );
      if (saved) startPlayback(saved, action.stepId);
    },
    [closePage, createFlow, loadSavedFlow, startPlayback]
  );

  const requestNav = useCallback(
    (action: PendingNav) => {
      if (dirty) {
        setPendingNav(action);
        setUnsavedOpen(true);
        return;
      }
      runPendingNav(action);
    },
    [dirty, runPendingNav]
  );

  const discardUnsaved = useCallback(() => {
    const action = pendingNav;
    setUnsavedOpen(false);
    setPendingNav(null);
    setDraft(null);
    setSaveError(null);
    if (!action) return;
    runPendingNav(action);
  }, [pendingNav, runPendingNav]);

  const saveDraft = useCallback(async () => {
    if (!draft || !canWrite) return false;
    setSaving(true);
    setSaveError(null);
    const exists = flows.some((f) => f.id === draft.id);
    const nextFlow: StoredDataFlow = {
      ...draft,
      ...(exists ? stampAuditUpdate(draft, user) : stampAuditCreate(user)),
    };
    const nextList = exists
      ? flows.map((f) => (f.id === nextFlow.id ? nextFlow : f))
      : [...flows, nextFlow];
    try {
      await persistFlowRemote(nextFlow);
      commitModel(nextList);
      setDraft(cloneFlow(nextFlow));
      /* Counted when the flow first lands, not when the empty draft opens —
         a journey nobody finished writing is not a journey. */
      if (!exists) {
        trackProductEvent('flow.created', { steps: nextFlow.steps.length });
      }
      return true;
    } catch {
      trackProductEvent('health.save_failed', { area: 'flow' });
      setSaveError(t('data_flow_save_failed'));
      return false;
    } finally {
      setSaving(false);
    }
  }, [canWrite, commitModel, draft, flows, persistFlowRemote, t, user]);

  const patchSelected = useCallback((patch: Partial<StoredDataFlow>) => {
    if (!canWrite) return;
    setDraft((prev) => {
      const base = prev ?? savedSelected;
      if (!base) return prev;
      return { ...base, ...patch };
    });
  }, [canWrite, savedSelected]);

  const makeMagicSequence = useCallback(async () => {
    if (!selected || !canWrite || magicSeqBusy) return;
    setMagicSeqBusy(true);
    setSaveError(null);
    try {
      const currentModel = useFlatC4Store.getState().model;
      const applied = applyMagicSequenceLocally(currentModel, selected, user);
      if ('error' in applied) {
        setSaveError(
          applied.error === 'invalid_first_service'
            ? t('data_flow_magic_sequence_invalid_service')
            : t('data_flow_magic_sequence_failed')
        );
        return;
      }

      if (projectMode && projectId) {
        await upsertSequence.mutateAsync({
          ownerType: applied.plan.owner.ownerType,
          ownerId: applied.plan.owner.ownerId,
          name: applied.plan.diagramName,
          plantUmlSource: applied.plan.plantUmlSource,
          diagramId: applied.plan.diagramId,
        });
        await persistFlowRemote(applied.flow);
      }

      const savedFlows = getModelDataFlows(applied.model);
      const exists = savedFlows.some((f) => f.id === applied.flow.id);
      const nextList = exists
        ? savedFlows.map((f) => (f.id === applied.flow.id ? applied.flow : f))
        : [...savedFlows, applied.flow];
      setModel(withModelDataFlows(applied.model, nextList));
      setDraft(cloneFlow(applied.flow));
    } catch {
      setSaveError(t('data_flow_magic_sequence_failed'));
    } finally {
      setMagicSeqBusy(false);
    }
  }, [
    canWrite,
    magicSeqBusy,
    persistFlowRemote,
    projectId,
    projectMode,
    selected,
    setModel,
    t,
    upsertSequence,
    user,
  ]);

  const magicSequenceStale = selected ? flowMagicSequenceIsStale(selected) : false;
  const magicSequenceDisabled =
    !selected?.steps.length || !resolveFlowSequenceOwner(optionsModel, selected);

  /*
   * Does each flow still describe the model it was drawn on?
   *
   * One index per model, shared by the list and the editor: the pass over the
   * model is the whole cost — measured at a couple of milliseconds on a model
   * far larger than anyone draws — and checking a step against it is free.
   * Keyed on the saved model rather than the draft, so typing a step name does
   * not rebuild it.
   */
  const modelIndex = useMemo(() => buildModelIndex(optionsModel), [optionsModel]);

  const flowStatuses = useMemo(() => {
    const map = new Map<string, FlowStatus>();
    for (const item of flows) {
      map.set(item.id, validateFlow(item, modelIndex, item.validation).status);
    }
    return map;
  }, [flows, modelIndex]);

  /* The open flow is checked against its saved self: an unsaved step cannot be
     stale, and reporting it as such while somebody is mid-edit is noise. */
  const validation = useMemo(
    () => (savedSelected ? validateFlow(savedSelected, modelIndex, savedSelected.validation) : null),
    [savedSelected, modelIndex]
  );

  /**
   * "I looked, and this flow is still right."
   *
   * Records what the model looked like at that moment, so the next change to
   * any of it is reported as a change rather than as the way things have
   * always been.
   *
   * Written straight through rather than into the draft: `saveDraft` reads the
   * draft from its own closure, so saving right after a `setDraft` would
   * persist the version without the stamp — and a confirmation that quietly
   * did not happen is worse than no button at all. Same path the magic
   * sequence takes.
   */
  const markChecked = useCallback(async () => {
    const base = draft ?? savedSelected;
    if (!base || !canWrite || !validation) return;

    const person = personRefFromUser(user);
    const next = cloneFlow({
      ...base,
      validation: {
        checkedAt: new Date().toISOString(),
        ...(person ? { checkedBy: person } : {}),
        dependencies: validation.dependencies,
      },
      ...stampAuditUpdate(base, user),
    });

    setSaveError(null);
    try {
      if (projectMode && projectId) await persistFlowRemote(next);
      const nextList = flows.some((f) => f.id === next.id)
        ? flows.map((f) => (f.id === next.id ? next : f))
        : [...flows, next];
      commitModel(nextList);
      setDraft(cloneFlow(next));
    } catch {
      setSaveError(t('data_flow_save_failed'));
    }
  }, [
    canWrite,
    commitModel,
    draft,
    flows,
    persistFlowRemote,
    projectId,
    projectMode,
    savedSelected,
    t,
    user,
    validation,
  ]);

  const patchStep = useCallback((stepId: string, patch: Partial<DataFlowStep> | DataFlowStep) => {
    if (!canWrite) return;
    setDraft((prev) => {
      const base = prev ?? savedSelected;
      if (!base) return prev;
      const steps = base.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s));
      return { ...base, steps };
    });
  }, [canWrite, savedSelected]);

  const addFlow = () => {
    if (!canWrite) return;
    requestNav({ type: 'create' });
  };

  const addStep = () => {
    if (!selected || !canWrite) return;
    const step = emptyDataFlowStep();
    patchSelected({ steps: [...selected.steps, step] });
    startTransition(() => setSelectedStepId(step.id));
  };

  /* Appended like any other step — moved into position afterward with the
     same up/down controls, not inserted at a cursor. */
  const addLinkStep = () => {
    if (!selected || !canWrite) return;
    const step = emptyDataFlowStep('link');
    patchSelected({ steps: [...selected.steps, step] });
    startTransition(() => setSelectedStepId(step.id));
    setContinuationDialogOpen(true);
  };

  const addFlowBranch = (stepId: string, kind: FlowBranchKind) => {
    if (!selected || !canWrite) return;
    const { steps, newStep } = addBranch(selected.steps, stepId, kind);
    patchSelected({ steps });
    if (newStep) startTransition(() => setSelectedStepId(newStep.id));
  };

  /* Carries a branch on instead of opening another one beside it — the move
     that used to be missing, which is why sequential steps of one branch ended
     up recorded as alternatives to each other. */
  const addStepInBranch = (stepId: string) => {
    if (!selected || !canWrite) return;
    const { steps, newStep } = addStepToArm(selected.steps, stepId);
    if (!newStep) return;
    patchSelected({ steps });
    startTransition(() => setSelectedStepId(newStep.id));
  };

  const detachBranch = (stepId: string) => {
    if (!selected || !canWrite) return;
    patchSelected({ steps: detachFromBranch(selected.steps, stepId) });
  };

  const moveStep = (stepId: string, dir: -1 | 1) => {
    if (!selected || !canWrite) return;
    patchSelected({ steps: moveFlowStage(selected.steps, stepId, dir) });
  };

  const removeStep = (stepId: string) => {
    if (!selected || !canWrite || selected.steps.length <= 1) return;
    patchSelected({ steps: removeFlowStep(selected.steps, stepId) });
  };

  const handleSelectStep = useCallback((stepId: string | null) => {
    startTransition(() => setSelectedStepId(stepId));
  }, []);

  const play = (flow: StoredDataFlow, step?: DataFlowStep) => {
    if (dirty) {
      requestNav({ type: 'play', flowId: flow.id, stepId: step?.id });
      return;
    }
    startPlayback(flow, step?.id);
  };

  const participantOptions = useMemo(
    () =>
      listFlowParticipantOptions(optionsModel).map((opt) => ({
        value: participantKey(opt),
        label: opt.label,
        detail: opt.detail,
        group: opt.group,
      })),
    [optionsModel]
  );

  const endpointOptions = useMemo(() => {
    if (!selectedStep) return [];
    const key = selectedStepRelationKey;
    const cached = endpointOptionsCacheRef.current.get(key);
    if (cached) return cached;
    const computed = listStepEndpointOptions(optionsModel, selectedStep);
    endpointOptionsCacheRef.current.set(key, computed);
    return computed;
  }, [optionsModel, selectedStep, selectedStepRelationKey]);
  const channelOptions = useMemo(() => {
    if (!selectedStep) return [];
    const key = selectedStepRelationKey;
    const cached = channelOptionsCacheRef.current.get(key);
    if (cached) return cached;
    const computed = listStepChannelOptions(optionsModel, selectedStep);
    channelOptionsCacheRef.current.set(key, computed);
    return computed;
  }, [optionsModel, selectedStep, selectedStepRelationKey]);
  const connectionOptions = useMemo(() => {
    if (!selectedStep) return [];
    const key = selectedStepRelationKey;
    const cached = connectionOptionsCacheRef.current.get(key);
    if (cached) return cached;
    const computed = listStepConnectionOptions(optionsModel, selectedStep);
    connectionOptionsCacheRef.current.set(key, computed);
    return computed;
  }, [optionsModel, selectedStep, selectedStepRelationKey]);
  const flowStages = selected ? groupFlowStages(selected.steps) : [];
  const selectedStage = selectedStep
    ? flowStages.find((stage) => stage.steps.some((s) => s.id === selectedStep.id)) ?? null
    : null;
  const propertiesPanel = (
    <FlowStepPropertiesPanel
      step={selectedStep}
      branched={Boolean(selectedStage?.branched)}
      branchKind={selectedStage?.kind}
      canWrite={canWrite}
      currentProjectId={projectId}
      participantOptions={participantOptions}
      endpointOptions={endpointOptions}
      channelOptions={channelOptions}
      connectionOptions={connectionOptions}
      onPatch={patchStep}
      onEditContinuation={() => setContinuationDialogOpen(true)}
    />
  );
  const flowsReturn = projectMode && projectId ? `/projects/${projectId}/flows` : '/flows';

  const toolbar = (
    <ToolbarSlot
      hideTools
      model={model}
      user={user}
      projectName={projectName}
      projectMode={projectMode}
      viewOnly={projectMode && access === 'view'}
      onLogin={() => navigate(loginPagePath(flowsReturn))}
      onLogout={() => setLogoutConfirmOpen(true)}
      onRenameProject={projectMode && canWrite ? handleRenameProject : undefined}
    />
  );

  if (projectMode && authLoading) {
    return (
      <Box h={embedded ? '100%' : '100vh'} display="grid" placeItems="center" bg="bg.canvas">
        <QuackSpinner size="xl" />
      </Box>
    );
  }

  return (
    <Box
      h={embedded ? '100%' : '100vh'}
      display="flex"
      flexDirection="column"
      overflow="hidden"
      bg={embedded ? 'transparent' : 'bg.canvas'}
      color="fg.default"
    >
      {!embedded ? (
        <ConfirmDialog
          open={logoutConfirmOpen}
          title="Log out?"
          content="You are about to leave this session. Are you sure you want to log out?"
          onCancel={() => {
            if (logoutLoading) return;
            setLogoutConfirmOpen(false);
          }}
          onConfirm={() => {
            if (logoutLoading) return;
            setLogoutLoading(true);
            void logout()
              /* No navigation here — AuthProvider sends a finished session
                 to the sign-in screen, and a second destination would race it. */
              .then(() => setLogoutConfirmOpen(false))
              .finally(() => setLogoutLoading(false));
          }}
          confirmText="Yes, log out"
          cancelText="Cancel"
          confirmLoading={logoutLoading}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(pendingDeleteId)}
        title={t('data_flow_delete_title')}
        content={t('data_flow_delete_confirm', {
          /* A flow keeps an empty name until someone types one, and the list
             calls it by the same placeholder — asking to delete "" named
             nothing at all. */
          name:
            (draft?.id === pendingDeleteId ? draft.name : null) ||
            flows.find((f) => f.id === pendingDeleteId)?.name ||
            t('data_flow_new'),
        })}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          const id = pendingDeleteId;
          setPendingDeleteId(null);
          if (!id) return;
          if (flows.some((f) => f.id === id)) {
            commitModel(flows.filter((f) => f.id !== id));
            if (projectMode && projectId && canWrite) {
              void deleteDataFlow.mutateAsync(id);
            }
          }
          if (selectedId === id) {
            setDraft(null);
            setSelectedId(null);
          }
        }}
        confirmText={t('delete')}
        cancelText={t('cancel')}
      />
      <ConfirmDialog
        open={unsavedOpen}
        title={t('data_flow_unsaved_title')}
        content={t('data_flow_unsaved_confirm', {
          name: draft?.name || t('data_flow_new'),
        })}
        onCancel={() => {
          setUnsavedOpen(false);
          setPendingNav(null);
        }}
        onConfirm={discardUnsaved}
        confirmText={t('data_flow_discard')}
        cancelText={t('cancel')}
      />
      {selected && selectedStep ? (
        <FlowContinuationDialog
          open={continuationDialogOpen}
          onClose={() => setContinuationDialogOpen(false)}
          value={selectedStep.nextFlowRef}
          onChange={(ref) => patchStep(selectedStep.id, { nextFlowRef: ref })}
          currentProjectId={projectId}
          currentFlowId={selected.id}
        />
      ) : null}

      <Box flex="1" minH={0} position="relative" overflow="hidden" display="flex" flexDirection="column">
        {!embedded ? toolbar : null}
        <Box
          flex="1"
          minH={0}
          overflow="hidden"
          display="flex"
          flexDirection="column"
          mt={embedded ? 0 : WORKSPACE_CONTENT_TOP}
        >
          <HStack
            px="12px"
            minH={MANAGER_BAR_MIN_H}
            py="10px"
            gap="12px"
            align="center"
            flexShrink={0}
            justify="space-between"
            {...glass.floatBar}
            mx={embedded ? 0 : SIDE_PANEL_INSET}
            mt={SIDE_PANEL_INSET}
          >
            <MagicFlowTitle label={t('data_flow_title')} iconSize={15} />
            <HStack gap="8px" align="center">
              {saveError ? (
                <Text fontSize="xs" color="red.400" maxW="160px">
                  {saveError}
                </Text>
              ) : null}
              {canWrite ? (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    borderRadius="full"
                    onClick={addFlow}
                    data-testid="flows-new"
                  >
                    <Plus size={TOOLBAR_ICON_SIZE} />
                    {t('data_flow_add')}
                  </Button>
                  <ToolbarIconButton
                    colorPalette="brand"
                    color="brand.emphasis"
                    title={t('save')}
                    aria-label={t('save')}
                    data-testid="flows-save"
                    loading={saving}
                    spinner={<QuackSpinner size="sm" color="currentColor" />}
                    disabled={!dirty || saving}
                    onClick={() => {
                      void saveDraft();
                    }}
                  >
                    <Save size={TOOLBAR_ICON_SIZE} />
                  </ToolbarIconButton>
                  {selected ? (
                    <ToolbarIconButton
                      colorPalette="red"
                      color="red.400"
                      title={t('delete')}
                      aria-label={t('delete')}
                      data-testid="flows-delete"
                      onClick={() => setPendingDeleteId(selected.id)}
                    >
                      <Trash2 size={TOOLBAR_ICON_SIZE} />
                    </ToolbarIconButton>
                  ) : null}
                </>
              ) : null}
              <ToolbarIconButton
                title={t('close')}
                aria-label={t('close')}
                data-testid="flows-close"
                onClick={() => requestNav({ type: 'close' })}
              >
                <X size={TOOLBAR_ICON_SIZE} />
              </ToolbarIconButton>
            </HStack>
          </HStack>
          {projectMode && loading ? (
            <Box
              flex="1"
              display="grid"
              placeItems="center"
              mx={embedded ? 0 : SIDE_PANEL_INSET}
              mt={SIDE_PANEL_INSET}
              mb={embedded ? 0 : SIDE_PANEL_INSET}
              {...glass.editorPanel}
            >
              <QuackSpinner size="xl" />
            </Box>
          ) : loadError === 'sign-in' ? (
            <Box
              flex="1"
              display="grid"
              placeItems="center"
              p="24px"
              mx={embedded ? 0 : SIDE_PANEL_INSET}
              mt={SIDE_PANEL_INSET}
              mb={embedded ? 0 : SIDE_PANEL_INSET}
              {...glass.editorPanel}
            >
              <Text color="fg.muted">{t('sign_in')}</Text>
            </Box>
          ) : loadError ? (
            <Box
              flex="1"
              display="grid"
              placeItems="center"
              p="24px"
              mx={embedded ? 0 : SIDE_PANEL_INSET}
              mt={SIDE_PANEL_INSET}
              mb={embedded ? 0 : SIDE_PANEL_INSET}
              {...glass.editorPanel}
            >
              <Text color="fg.muted">{loadError}</Text>
            </Box>
          ) : (
            <HStack
              align="stretch"
              flex="1"
              minH={0}
              overflow="hidden"
              gap={SIDE_PANEL_INSET}
              mx={embedded ? 0 : SIDE_PANEL_INSET}
              mt={SIDE_PANEL_INSET}
              mb={embedded ? 0 : SIDE_PANEL_INSET}
            >
              {isMdUp && !listOpen ? (
                <Box flexShrink={0} h="full">
                  <PanelCollapseRail
                    side="left"
                    label={t('data_flow_panel_list')}
                    title={t('data_flow_show_list')}
                    onExpand={() => setListOpen(true)}
                  />
                </Box>
              ) : null}
              {(isMdUp ? listOpen : !selectedId) ? (
                <SidePanelShell
                  embedded
                  overlay={false}
                  width={isMdUp ? '300px' : 'full'}
                  title={<DataFlowsListTitle count={listFlows.length} />}
                  headerActions={<DataFlowsListSort sort={sort} onSortChange={handleSortChange} />}
                  collapseDirection="left"
                  closable={isMdUp}
                  closeLabel={t('data_flow_hide_list')}
                  onClose={() => setListOpen(false)}
                >
                  <DataFlowsListPanel
                    flows={listFlows}
                    statuses={flowStatuses}
                    selectedId={selectedId}
                    query={query}
                    sort={sort}
                    onQueryChange={setQuery}
                    onSortChange={handleSortChange}
                    onSelect={(id) => {
                      if (id === selectedId) return;
                      requestNav({ type: 'select', id });
                    }}
                  />
                </SidePanelShell>
              ) : null}

              <Box
                flex="1"
                display={{ base: selectedId ? 'flex' : 'none', md: 'flex' }}
                flexDirection="column"
                minW={{ md: DATA_FLOW_PANE_MIN_WIDTH }}
                minH={0}
                overflowY="auto"
                p="20px"
                css={glass.scrollbar}
                {...glass.editorPanel}
              >
                {!selected ? (
                  <Box maxW="520px" color="fg.muted" pt="24px">
                    <MagicFlowIcon size={28} />
                    <Heading as="h2" size="md" mt="12px" mb="8px" color="fg.default">
                      {t('data_flow_title')}
                    </Heading>
                    <Text fontSize="sm" lineHeight="1.7">
                      {t('data_flow_intro')}
                    </Text>
                  </Box>
                ) : (
                  <Box maxW="720px">
                    <HStack mb="12px" justify="space-between" display={{ base: 'flex', md: 'none' }}>
                      <Button
                        size="xs"
                        variant="ghost"
                        display={{ base: 'inline-flex', md: 'none' }}
                        onClick={() => setSelectedId(null)}
                      >
                        {t('data_flow_back_to_list')}
                      </Button>
                    </HStack>
                    {validation ? (
                      <Box mb="14px" data-testid="flow-validation">
                        <HStack justify="space-between" align="center" gap="10px">
                          {/* One mark, not a badge and a hint beside it: the icon
                              is the state, and hovering it gives the sentence. */}
                          <HStack gap="8px" data-testid={`flow-status-${validation.status}`}>
                            <FlowStatusIcon
                              status={validation.status}
                              size={17}
                              hint={`${t(`data_flow_status_${validation.status}`)} — ${t(
                                `data_flow_hint_${validation.status}`,
                                {
                                  when: validation.checkedAt
                                    ? new Date(validation.checkedAt).toLocaleString()
                                    : '',
                                }
                              )}`}
                            />
                            <Text fontSize="sm" color="fg.muted">
                              {t(`data_flow_status_${validation.status}`)}
                            </Text>
                          </HStack>
                          {/* Only where there is something to accept: a first
                              confirmation, or a change to sign off. On a flow
                              that is checked and unchanged the button rewrote
                              the date and nothing else, while implying there
                              was work to do. */}
                          {canWrite && (validation.status !== 'ok' || validation.issues.length) ? (
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => {
                                void markChecked();
                              }}
                              data-testid="flow-mark-checked"
                            >
                              {validation.status === 'unchecked'
                                ? t('data_flow_mark_checked')
                                : t('data_flow_accept_changes')}
                            </Button>
                          ) : null}
                        </HStack>

                        {validation.issues.length ? (
                          <VStack align="stretch" gap="6px" mt="8px">
                            {validation.issues.map((issue) => (
                              <HStack
                                key={issue.key}
                                role="button"
                                tabIndex={0}
                                gap="8px"
                                align="start"
                                textAlign="left"
                                borderRadius="6px"
                                px="6px"
                                py="6px"
                                _hover={{ bg: 'bg.list.hover' }}
                                cursor="pointer"
                                onClick={() => {
                                  const stepId = issue.stepIds[0];
                                  if (stepId) startTransition(() => setSelectedStepId(stepId));
                                }}
                                data-testid={`flow-issue-${issue.key}`}
                              >
                                <Box
                                  as="span"
                                  mt="5px"
                                  w="6px"
                                  h="6px"
                                  borderRadius="full"
                                  flexShrink={0}
                                  bg={
                                    issue.severity === 'broken'
                                      ? 'red.400'
                                      : issue.severity === 'review'
                                        ? 'orange.400'
                                        : 'fg.subtle'
                                  }
                                />
                                <Box minW={0}>
                                  <Text fontSize="sm" color="fg.default" lineClamp={1}>
                                    {issue.name}
                                  </Text>
                                  <Text fontSize="xs" color="fg.muted">
                                    {`${t(`data_flow_dependency_${issue.dependencyKind}`)} — `}
                                    {t(`data_flow_issue_${issue.kind}`, {
                                      count: issue.stepIds.length,
                                    })}
                                    {issue.kind === 'changed' || issue.kind === 'renamed'
                                      ? ` · ${issue.before || '—'} → ${issue.after || '—'}`
                                      : ''}
                                  </Text>
                                </Box>
                              </HStack>
                            ))}
                          </VStack>
                        ) : null}
                      </Box>
                    ) : null}

                    <PanelFieldset readOnly={!canWrite}>
                      <VStack align="stretch" gap={DIALOG_PAD.fieldGap} css={panelFlushFieldCss}>
                        <ThemedTextField
                          label={t('data_flow_name')}
                          value={selected.name}
                          onChange={(e) => patchSelected({ name: e.target.value })}
                          disabled={!canWrite}
                          fullWidth
                        />
                        <ThemedTextField
                          label={t('data_flow_description')}
                          value={selected.description || ''}
                          onChange={(e) => patchSelected({ description: e.target.value })}
                          disabled={!canWrite}
                          fullWidth
                          multiline
                          minRows={5}
                        />
                      </VStack>
                    </PanelFieldset>

                    <HStack mt="16px" mb="8px">
                      <Text fontSize="sm" fontWeight="700">
                        {t('data_flow_steps')}
                      </Text>
                    </HStack>
                    <FlowStepGraph
                      stages={flowStages}
                      steps={selected.steps}
                      selectedStepId={selectedStep?.id ?? null}
                      onSelect={handleSelectStep}
                      canWrite={canWrite}
                      onAddBranch={addFlowBranch}
                      onAddStepToArm={addStepInBranch}
                    />
                    <HStack mt="4px" mb="8px" gap="4px" align="center">
                      <Box
                        w={`${flowRailGutter(flowStages)}px`}
                        flexShrink={0}
                        position="relative"
                        h="28px"
                      >
                        <Box
                          position="absolute"
                          left={`${FLOW_STEP_RAIL_MAIN_X}px`}
                          top="50%"
                          transform="translate(-50%, -50%)"
                        >
                          <ToolbarIconButton
                            color={MAGIC_FLOW_FG}
                            title={t('data_flow_play')}
                            aria-label={t('data_flow_play')}
                            data-testid="flows-play"
                            disabled={selected.steps.length === 0}
                            onClick={() => play(selected, selectedStep || undefined)}
                            _hover={{ bg: 'bg.list.hover', color: MAGIC_FLOW_FG }}
                          >
                            <Play size={TOOLBAR_ICON_SIZE} />
                          </ToolbarIconButton>
                        </Box>
                      </Box>
                      {projectMode && projectId ? (
                        <ToolbarIconButton
                          aria-label={t('compare_this_flow')}
                          title={t('compare_this_flow')}
                          disabled={selected.steps.length === 0}
                          onClick={() => {
                            leaveWorkspaceOverlays();
                            openCompareOverlay({
                              left: `${projectId}@current`,
                              right: `${projectId}@current`,
                              subject: `flow:${selected.id}`,
                              step: selectedStep
                                ? Math.max(
                                    0,
                                    selected.steps.findIndex((s) => s.id === selectedStep.id)
                                  )
                                : 0,
                              stepSide: 'after',
                              arm: 'after',
                            });
                          }}
                        >
                          <GitCompareArrows size={TOOLBAR_ICON_SIZE} />
                        </ToolbarIconButton>
                      ) : null}
                      {canWrite ? (
                        <HStack flex="1" minW={0} justify="flex-end" gap="4px">
                          <ToolbarIconButton
                            aria-label={t('data_flow_add_step')}
                            title={t('data_flow_add_step')}
                            onClick={addStep}
                          >
                            <Plus size={14} />
                          </ToolbarIconButton>
                          <ToolbarIconButton
                            aria-label={t('data_flow_add_link_step')}
                            title={t('data_flow_add_link_step')}
                            onClick={addLinkStep}
                            data-testid="flows-continuation"
                          >
                            <Link2 size={14} />
                          </ToolbarIconButton>
                          {selectedStep ? (
                            <>
                              <ToolbarIconButton
                                aria-label={t('data_flow_move_up')}
                                title={t('data_flow_move_up')}
                                onClick={() => moveStep(selectedStep.id, -1)}
                              >
                                <ArrowUp size={14} />
                              </ToolbarIconButton>
                              <ToolbarIconButton
                                aria-label={t('data_flow_move_down')}
                                title={t('data_flow_move_down')}
                                onClick={() => moveStep(selectedStep.id, 1)}
                              >
                                <ArrowDown size={14} />
                              </ToolbarIconButton>
                              <ToolbarIconButton
                                aria-label={t('data_flow_add_parallel')}
                                title={t('data_flow_add_parallel')}
                                onClick={() => addFlowBranch(selectedStep.id, 'parallel')}
                              >
                                <GitFork size={14} />
                              </ToolbarIconButton>
                              <ToolbarIconButton
                                aria-label={t('data_flow_add_alternative')}
                                title={t('data_flow_add_alternative')}
                                onClick={() => addFlowBranch(selectedStep.id, 'alternative')}
                              >
                                <Split size={14} />
                              </ToolbarIconButton>
                              {selectedStage?.branched ? (
                                <ToolbarIconButton
                                  aria-label={t('data_flow_detach_parallel')}
                                  title={t('data_flow_detach_parallel')}
                                  onClick={() => detachBranch(selectedStep.id)}
                                >
                                  <Unlink size={14} />
                                </ToolbarIconButton>
                              ) : null}
                              <ToolbarIconButton
                                aria-label={t('data_flow_swap')}
                                title={t('data_flow_swap')}
                                onClick={() =>
                                  patchStep(selectedStep.id, swapStepDirection(selectedStep))
                                }
                              >
                                <ArrowLeftRight size={14} />
                              </ToolbarIconButton>
                              {selected.steps.length > 1 ? (
                                <ToolbarIconButton
                                  aria-label={t('delete')}
                                  title={t('delete')}
                                  onClick={() => removeStep(selectedStep.id)}
                                >
                                  <Trash2 size={14} />
                                </ToolbarIconButton>
                              ) : null}
                            </>
                          ) : null}
                        </HStack>
                      ) : null}
                    </HStack>
                    {!isMdUp ? <Box mt="16px">{propertiesPanel}</Box> : null}
                  </Box>
                )}
              </Box>
              {selected ? (
                <DataFlowAttachmentPanes
                  model={optionsModel}
                  flow={selected}
                  canWrite={canWrite}
                  selectedStepId={selectedStep?.id ?? null}
                  onChange={(patch) => patchSelected(patch)}
                  onMakeMagicSequence={makeMagicSequence}
                  magicSequenceBusy={magicSeqBusy}
                  magicSequenceStale={magicSequenceStale}
                  magicSequenceDisabled={magicSequenceDisabled}
                  properties={isMdUp ? propertiesPanel : null}
                />
              ) : null}
            </HStack>
          )}
        </Box>
        {!embedded ? <AppFooter variant="bar" /> : null}
      </Box>
    </Box>
  );
}
