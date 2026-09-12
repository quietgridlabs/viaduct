import { useFlatC4Store } from '@archivisio/c4-modelizer-sdk';
import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import { MagicFlowIcon } from '@components/data-flow/MagicFlowMark';
import { ToolbarIconButton, TOOLBAR_ICON_SIZE } from '@components/common/ToolbarIconButton';
import { useGlassSurface } from '@theme/glassSurfaces';
import {
  CANVAS_CHROME_INSET,
  CANVAS_CHROME_Z,
  WORKSPACE_CONTENT_TOP,
} from '@theme/sidePanelLayout';
import type { DataFlowStep, FlowContinuationRef } from '@/types/c4Extensions';
import {
  adjacentPlaybackStageFirstIndex,
  dataFlowPlaybackPath,
  firstIndexOfStage,
  flowStepNumberLabel,
  getModelDataFlows,
  indexOfStepInFlow,
  isLinkOnlyStage,
  listStepEndpointOptions,
  outgoingLinkAfterStep,
  participantLabel,
  playbackFlowStages,
  resumeIndexAfterLinkAt,
  resumeIndexAfterOutgoingLink,
  stageAtStepIndex,
  stepAlongArm,
} from '@utils/dataFlows';
import { Box, Badge, Button, HStack, Text, VStack } from '@chakra-ui/react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileText,
  GitCompareArrows,
  GitFork,
  Layers,
  Link2,
  Split,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  closeDataFlowPlayback,
  openDataFlowPlayback,
  patchDataFlowPlayback,
  popDataFlowPlaybackStack,
  pushDataFlowPlaybackForContinuation,
  setPendingPlaybackStack,
  subscribeDataFlowPlayback,
  getDataFlowPlayback,
} from './uiState';
import { openCompareOverlay } from '@/community/stubs';
import { leaveWorkspaceOverlays } from '@/navigation/leaveWorkspaceOverlays';

function hopSubtitle(model: FlatC4Model, step: DataFlowStep): string {
  const fromLabel = step.from.id
    ? participantLabel(model, step.from).split(' · ')[0]!
    : '—';
  const toLabel = step.to.id
    ? participantLabel(model, step.to).split(' · ')[0]!
    : '—';
  return `${fromLabel} → ${toLabel}`;
}

export default function DataFlowPlaybackOverlay() {
  const { t } = useTranslation();
  const glass = useGlassSurface();
  const location = useLocation();
  const navigate = useNavigate();
  const { projectId: currentProjectId } = useParams();
  const { model } = useFlatC4Store();
  const [expanded, setExpanded] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const jumpingLinkRef = useRef(false);
  const playback = useSyncExternalStore(
    subscribeDataFlowPlayback,
    getDataFlowPlayback,
    () => null
  );

  const hidden =
    location.pathname.endsWith('/catalog') || location.pathname.endsWith('/flows');

  const flow = useMemo(() => {
    if (!playback) return null;
    return (
      playback.flowSnapshot ||
      getModelDataFlows(model).find((item) => item.id === playback.flowId) ||
      null
    );
  }, [model, playback]);

  const stepIndex = playback?.stepIndex ?? 0;
  const showAll = playback?.showAll === true;
  const branchStepId = playback?.branchStepId ?? null;
  const toggleShowAll = useCallback(() => {
    patchDataFlowPlayback({ showAll: !showAll });
  }, [showAll]);
  const stages = useMemo(() => (flow ? playbackFlowStages(flow.steps) : []), [flow]);
  const hit = flow ? stageAtStepIndex(flow.steps, stepIndex) : null;
  const rawStage = hit?.stage ?? null;
  const onLinkStage = Boolean(rawStage && isLinkOnlyStage(rawStage));
  const stage = onLinkStage ? null : rawStage;
  const needsOrChoice = Boolean(
    stage && stage.branched && stage.kind === 'alternative' && !branchStepId && !showAll
  );
  const visibleSteps = useMemo(() => {
    if (!stage) return [];
    if (showAll) return stage.steps;
    if (stage.kind === 'alternative' && stage.branched) {
      if (!branchStepId) return [];
      const picked = stage.steps.find((s) => s.id === branchStepId);
      return picked ? [picked] : [];
    }
    return stage.steps;
  }, [stage, showAll, branchStepId]);
  const stageIndex = stage
    ? Math.max(0, stages.findIndex((s) => s.id === stage.id))
    : 0;
  const stageCount = stages.length;
  const atStart = stageIndex <= 0;
  const stackDepth = playback?.stack?.length ?? 0;
  const parentResumeAfter = (() => {
    if (!stackDepth) return null;
    const frame = playback?.stack?.[stackDepth - 1];
    return frame?.resumeAfterStepIndex ?? null;
  })();
  const canResumeParent = parentResumeAfter != null;
  const outgoingLink = useMemo(() => {
    if (showAll || !flow || onLinkStage || needsOrChoice) return undefined;
    return outgoingLinkAfterStep(flow.steps, stepIndex);
  }, [showAll, flow, onLinkStage, needsOrChoice, stepIndex]);
  const canGoNext = Boolean(
    !showAll &&
      !needsOrChoice &&
      (outgoingLink ||
        (stage && stageIndex < stageCount - 1) ||
        (stage && stageIndex >= stageCount - 1 && canResumeParent))
  );
  const canGoPrev = Boolean(
    !showAll && (!atStart || stackDepth > 0 || Boolean(branchStepId && stage?.kind === 'alternative'))
  );

  /* A link step's job: jump playback to another flow. The target project's
     model is not loaded here — there is nothing to check the pick against —
     so this just asks to go there; if the flow is gone, the effect above
     closes playback the same way it already does for a dangling flowId. */
  const continueToFlow = useCallback(
    (
      ref: FlowContinuationRef,
      opts?: { returnToStepIndex?: number; resumeAfterStepIndex?: number | null }
    ) => {
      if (!playback || !flow) return;
      const resumeAfter =
        opts?.resumeAfterStepIndex !== undefined
          ? opts.resumeAfterStepIndex
          : resumeIndexAfterOutgoingLink(flow.steps, stepIndex);
      patchDataFlowPlayback({
        flowSnapshot: flow,
        homeProjectId: playback.homeProjectId || currentProjectId,
        stepCount: flow.steps.length,
        ...(opts?.returnToStepIndex != null ? { stepIndex: opts.returnToStepIndex } : {}),
      });
      pushDataFlowPlaybackForContinuation({ resumeAfterStepIndex: resumeAfter });
      navigate(dataFlowPlaybackPath(ref.projectId, ref.id));
    },
    [playback, flow, currentProjectId, navigate, stepIndex]
  );

  const openStackedFrame = useCallback(
    (
      frame: NonNullable<ReturnType<typeof popDataFlowPlaybackStack>>['frame'],
      rest: NonNullable<ReturnType<typeof popDataFlowPlaybackStack>>['rest'],
      stepIndexOverride?: number
    ) => {
      const at = stepIndexOverride ?? frame.stepIndex;
      const stepId = frame.flowSnapshot?.steps[at]?.id;
      const targetProjectId = frame.homeProjectId || currentProjectId;

      if (targetProjectId && targetProjectId !== currentProjectId) {
        setPendingPlaybackStack(rest);
        navigate(dataFlowPlaybackPath(targetProjectId, frame.flowId, stepId));
        return;
      }

      openDataFlowPlayback({
        flowId: frame.flowId,
        stepIndex: at,
        homeProjectId: frame.homeProjectId || currentProjectId,
        flowSnapshot: frame.flowSnapshot,
        showAll: false,
        stepCount: frame.stepCount ?? frame.flowSnapshot?.steps.length,
        branchStepId: null,
        stack: rest,
      });
    },
    [currentProjectId, navigate]
  );

  const restoreFromStack = useCallback(() => {
    const popped = popDataFlowPlaybackStack();
    if (!popped) return;
    openStackedFrame(popped.frame, popped.rest, popped.frame.stepIndex);
  }, [openStackedFrame]);

  const resumeParentAfterLink = useCallback(() => {
    const popped = popDataFlowPlaybackStack();
    if (!popped) return;
    const at = popped.frame.resumeAfterStepIndex;
    if (at == null) return;
    openStackedFrame(popped.frame, popped.rest, at);
  }, [openStackedFrame]);

  const pickBranch = useCallback(
    (stepId: string) => {
      if (!flow) return;
      patchDataFlowPlayback({
        branchStepId: stepId,
        stepIndex: indexOfStepInFlow(flow.steps, stepId),
      });
      setDescOpen(false);
    },
    [flow]
  );

  const go = useCallback(
    (dir: -1 | 1) => {
      if (!flow) return;
      if (dir === 1 && outgoingLink) {
        continueToFlow(outgoingLink);
        return;
      }
      if (
        dir === 1 &&
        stageIndex >= stageCount - 1 &&
        canResumeParent
      ) {
        resumeParentAfterLink();
        return;
      }
      /*
       * A picked branch is walked step by step before the flow moves on: the
       * track is a sequence, and the beats of the tracks not taken are not on
       * the path the reader chose.
       */
      if (stage?.kind === 'alternative' && stage.branched && branchStepId) {
        const along = stepAlongArm(flow.steps, branchStepId, dir);
        if (along) {
          patchDataFlowPlayback({
            branchStepId: along.id,
            stepIndex: indexOfStepInFlow(flow.steps, along.id),
          });
          return;
        }
        if (dir === -1) {
          patchDataFlowPlayback({
            branchStepId: null,
            stepIndex: firstIndexOfStage(flow.steps, stage),
          });
          return;
        }
      }
      if (dir === -1 && atStart && stackDepth > 0) {
        restoreFromStack();
        return;
      }
      patchDataFlowPlayback({
        stepIndex: adjacentPlaybackStageFirstIndex(flow.steps, stepIndex, dir),
        branchStepId: null,
      });
    },
    [
      flow,
      stepIndex,
      outgoingLink,
      continueToFlow,
      atStart,
      stackDepth,
      restoreFromStack,
      stage,
      branchStepId,
      stageIndex,
      stageCount,
      canResumeParent,
      resumeParentAfterLink,
    ]
  );

  const goToStage = useCallback(
    (idx: number) => {
      if (!flow) return;
      const s = stages[idx];
      if (!s) return;
      patchDataFlowPlayback({
        stepIndex: firstIndexOfStage(flow.steps, s),
        branchStepId: null,
      });
      setExpanded(false);
      setDescOpen(false);
    },
    [flow, stages]
  );

  useEffect(() => {
    if (playback && !flow) closeDataFlowPlayback();
  }, [playback, flow]);

  useEffect(() => {
    jumpingLinkRef.current = false;
  }, [playback?.flowId]);

  /* If playback lands on a link step (URL, play-from-here), jump immediately
     and remember the hop before it so Previous can return there. */
  useEffect(() => {
    if (!flow || hidden || !onLinkStage || !rawStage) return;
    if (jumpingLinkRef.current) return;
    const ref = rawStage.steps.find((s) => s.kind === 'link')?.nextFlowRef;
    if (ref) {
      jumpingLinkRef.current = true;
      continueToFlow(ref, {
        returnToStepIndex: adjacentPlaybackStageFirstIndex(flow.steps, stepIndex, -1),
        resumeAfterStepIndex: resumeIndexAfterLinkAt(flow.steps, stepIndex),
      });
      return;
    }
    const fallback = adjacentPlaybackStageFirstIndex(flow.steps, stepIndex, -1);
    if (fallback !== stepIndex) patchDataFlowPlayback({ stepIndex: fallback });
  }, [flow, hidden, onLinkStage, rawStage, continueToFlow, stepIndex]);

  // Collapse list when flow changes
  useEffect(() => {
    setExpanded(false);
    setDescOpen(false);
  }, [playback?.flowId]);

  useEffect(() => {
    setDescOpen(false);
  }, [stepIndex]);

  useEffect(() => {
    if (!playback || hidden) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === 'Escape') {
        if (expanded) { setExpanded(false); return; }
        closeDataFlowPlayback();
        return;
      }
      if (event.key === 'a' || event.key === 'A') {
        event.preventDefault();
        toggleShowAll();
        return;
      }
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        if (canGoNext) go(1);
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (canGoPrev) go(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playback, hidden, canGoNext, canGoPrev, go, expanded, toggleShowAll]);

  if (!playback || !flow || !stage || hidden) return null;

  const stageHasDescription = visibleSteps.some((step) => Boolean(step.description?.trim()));

  return (
    <Box
      position="fixed"
      top={WORKSPACE_CONTENT_TOP}
      left={CANVAS_CHROME_INSET}
      zIndex={CANVAS_CHROME_Z}
      w="min(520px, calc(100% - 24px))"
      pointerEvents="auto"
      px="12px"
      py="10px"
      {...glass.floatBar}
      data-testid="data-flow-playback"
    >
      {/* ── current step info ── */}
      <HStack align="flex-start" gap="10px">
        <VStack align="stretch" gap="5px" flex="1" minW={0}>
          <HStack gap="6px" color="fg.muted">
            <MagicFlowIcon size={13} />
            <Text fontSize="xs" fontWeight="600" lineClamp={1} flex="1">
              {flow.name}
            </Text>
            <Text fontSize="xs" color="fg.muted" flexShrink={0}>
              {showAll ? t('data_flow_all_steps') : `${stageIndex + 1} / ${stageCount}`}
            </Text>
          </HStack>

          {stage.branched && !showAll ? (
            <HStack gap="6px" color="fg.muted" justify="space-between">
              <HStack gap="6px">
                {stage.kind === 'alternative' ? <Split size={12} /> : <GitFork size={12} />}
                <Text fontSize="xs" fontWeight="700">
                  {t(stage.kind === 'alternative' ? 'data_flow_alternative' : 'data_flow_parallel')}
                </Text>
              </HStack>
              {stage.kind === 'alternative' && branchStepId ? (
                <Button
                  size="xs"
                  variant="ghost"
                  h="auto"
                  minH={0}
                  py="2px"
                  px="6px"
                  fontSize="xs"
                  color="fg.muted"
                  onClick={() =>
                    patchDataFlowPlayback({
                      branchStepId: null,
                      stepIndex: firstIndexOfStage(flow.steps, stage),
                    })
                  }
                >
                  {t('data_flow_change_branch')}
                </Button>
              ) : null}
            </HStack>
          ) : null}

          {showAll ? (
            <VStack align="stretch" gap="3px">
              <Text fontSize="md" fontWeight="700" lineClamp={2}>
                {flow.name}
              </Text>
              <Text fontSize="sm" color="fg.muted">
                {t('data_flow_play_from_step', { n: stageIndex + 1, count: stageCount })}
              </Text>
            </VStack>
          ) : needsOrChoice ? (
            <VStack align="stretch" gap="8px" data-testid="data-flow-or-choice">
              <Text fontSize="sm" fontWeight="600">
                {t('data_flow_choose_branch')}
              </Text>
              <VStack align="stretch" gap="4px">
                {/* One choice per track, not per step: the reader picks a
                    branch, and its first step is where that branch starts. */}
                {stage.arms.map((arm) => {
                  const step = arm.steps[0]!;
                  return (
                  <Box
                    key={arm.id}
                    textAlign="left"
                    px="10px"
                    py="8px"
                    borderRadius="md"
                    borderWidth="1px"
                    borderColor="border.glass"
                    bg="transparent"
                    cursor="pointer"
                    _hover={{ bg: 'bg.list.hover', borderColor: 'border.default' }}
                    onClick={() => pickBranch(step.id)}
                  >
                    <HStack gap="6px" align="center">
                      <Text fontSize="xs" color="fg.muted" fontWeight="600" flexShrink={0}>
                        {flowStepNumberLabel(flow.steps, step.id)}
                      </Text>
                      <Text fontSize="sm" fontWeight="600" lineClamp={1} flex="1">
                        {step.name || t('data_flow_unnamed_step')}
                      </Text>
                    </HStack>
                    <Text fontSize="xs" color="fg.muted" lineClamp={1} mt="2px" pl="18px">
                      {hopSubtitle(model, step)}
                      {arm.steps.length > 1
                        ? ` · ${t('data_flow_branch_step_count', { count: arm.steps.length })}`
                        : ''}
                    </Text>
                  </Box>
                  );
                })}
              </VStack>
            </VStack>
          ) : (
            visibleSteps.map((step) => {
            const endpointLabels =
              step.endpointIds?.length
                ? listStepEndpointOptions(model, step)
                    .filter((o) => step.endpointIds!.includes(o.id))
                    .map((o) => o.label)
                : [];
            const channelLabels =
              step.channelIds?.length
                ? (step.channelIds || [])
                    .map((id) => model.components.find((c) => c.id === id)?.name)
                    .filter((name): name is string => Boolean(name))
                : [];
            return (
              <VStack key={step.id} align="stretch" gap="3px">
                <Text fontSize="md" fontWeight="700" lineClamp={2}>
                  {step.name || t('data_flow_unnamed_step')}
                </Text>
                <Text fontSize="sm" color="fg.muted" lineClamp={1}>
                  {hopSubtitle(model, step)}
                </Text>
                {endpointLabels.length > 0 || channelLabels.length > 0 ? (
                  <HStack gap="4px" flexWrap="wrap" mt="2px">
                    {endpointLabels.map((lbl) => (
                      <Badge
                        key={lbl}
                        fontSize="xs"
                        px="6px"
                        py="1px"
                        borderRadius="sm"
                        variant="subtle"
                        color="fg.muted"
                        fontFamily="mono"
                      >
                        {lbl}
                      </Badge>
                    ))}
                    {channelLabels.map((lbl) => (
                      <Badge
                        key={`ch-${lbl}`}
                        fontSize="xs"
                        px="6px"
                        py="1px"
                        borderRadius="sm"
                        variant="subtle"
                        color="fg.muted"
                        fontFamily="mono"
                      >
                        {lbl}
                      </Badge>
                    ))}
                  </HStack>
                ) : null}
                {descOpen && step.description?.trim() ? (
                  <Text
                    fontSize="sm"
                    color="fg.default"
                    mt="2px"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 8,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {step.description}
                  </Text>
                ) : null}
              </VStack>
            );
            })
          )}
        </VStack>

        <VStack gap="4px" flexShrink={0}>
          <ToolbarIconButton
            aria-label={t('close')}
            title={t('close')}
            onClick={() => closeDataFlowPlayback()}
          >
            <X size={TOOLBAR_ICON_SIZE} />
          </ToolbarIconButton>
          {currentProjectId && playback?.flowId ? (
            <ToolbarIconButton
              aria-label={t('compare_this_flow')}
              title={t('compare_this_flow')}
              onClick={() => {
                leaveWorkspaceOverlays();
                closeDataFlowPlayback();
                openCompareOverlay({
                  left: `${currentProjectId}@current`,
                  right: `${currentProjectId}@current`,
                  subject: `flow:${playback.flowId}`,
                  step: stepIndex,
                  stepSide: 'after',
                  arm: 'after',
                });
              }}
            >
              <GitCompareArrows size={TOOLBAR_ICON_SIZE} />
            </ToolbarIconButton>
          ) : null}
          <ToolbarIconButton
            active={showAll}
            aria-label={showAll ? t('data_flow_show_all_on') : t('data_flow_show_all')}
            title={showAll ? t('data_flow_show_all_on') : t('data_flow_show_all')}
            aria-pressed={showAll}
            onClick={toggleShowAll}
            data-testid="data-flow-show-all"
          >
            <Layers size={TOOLBAR_ICON_SIZE} />
          </ToolbarIconButton>
          <ToolbarIconButton
            aria-label={expanded ? t('collapse') : t('expand')}
            title={expanded ? t('collapse') : t('expand')}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronUp size={TOOLBAR_ICON_SIZE} /> : <ChevronDown size={TOOLBAR_ICON_SIZE} />}
          </ToolbarIconButton>
          {stageHasDescription && !showAll ? (
            <ToolbarIconButton
              active={descOpen}
              aria-label={t('data_flow_step_description')}
              title={t('data_flow_step_description')}
              onClick={() => setDescOpen((v) => !v)}
            >
              <FileText size={TOOLBAR_ICON_SIZE} />
            </ToolbarIconButton>
          ) : null}
        </VStack>
      </HStack>

      {/* ── navigation ── */}
      <HStack mt="12px" justify="space-between">
        <Button
          size="sm"
          variant="ghost"
          disabled={!canGoPrev}
          onClick={() => go(-1)}
        >
          <ChevronLeft size={15} />
          {t('data_flow_previous')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!canGoNext}
          onClick={() => go(1)}
        >
          {outgoingLink ? <Link2 size={14} /> : null}
          {t('data_flow_next')}
          <ChevronRight size={15} />
        </Button>
      </HStack>

      {expanded ? (
        <VStack align="stretch" gap="2px" mt="12px" maxH="280px" overflowY="auto">
          {stages.map((s, idx) => {
            const isActive = idx === stageIndex;
            const firstStep = s.steps[0]!;
            const fromLabel = firstStep.from.id
              ? participantLabel(model, firstStep.from).split(' · ')[0]!
              : null;
            const toLabel = firstStep.to.id
              ? participantLabel(model, firstStep.to).split(' · ')[0]!
              : null;
            return (
              <Box
                key={s.id}
                px="10px"
                py="8px"
                borderRadius="md"
                cursor="pointer"
                bg={isActive ? 'bg.list.selected' : 'transparent'}
                _hover={{ bg: isActive ? 'bg.list.selected' : 'bg.list.hover' }}
                onClick={() => {
                  if (showAll) patchDataFlowPlayback({ showAll: false });
                  goToStage(idx);
                }}
              >
                <HStack gap="6px" align="center">
                  {s.branched ? (
                    s.kind === 'alternative' ? (
                      <Split size={11} opacity={0.6} />
                    ) : (
                      <GitFork size={11} opacity={0.6} />
                    )
                  ) : null}
                  {firstStep.kind === 'link' ? <Link2 size={11} opacity={0.6} /> : null}
                  <Text fontSize="xs" color="fg.muted" fontWeight="600" flexShrink={0}>
                    {idx + 1}/{stageCount}
                  </Text>
                  <Text fontSize="sm" fontWeight={isActive ? '700' : '500'} lineClamp={1} flex="1">
                    {s.steps.map((x) => x.name || t('data_flow_unnamed_step')).join(' · ')}
                  </Text>
                </HStack>
                {fromLabel && toLabel ? (
                  <Text fontSize="xs" color="fg.muted" lineClamp={1} mt="2px" pl="18px">
                    {fromLabel} → {toLabel}
                  </Text>
                ) : null}
              </Box>
            );
          })}
        </VStack>
      ) : null}
    </Box>
  );
}
