import { useFlatC4Store } from '@archivisio/c4-modelizer-sdk';
import SidePanelShell, {
  PanelEmptyState,
  PanelListItem,
} from '@components/common/SidePanelShell';
import { MagicFlowTitle } from '@components/data-flow/MagicFlowMark';
import { ToolbarIconButton } from '@components/common/ToolbarIconButton';
import { leaveWorkspaceOverlays } from '@/navigation/leaveWorkspaceOverlays';
import { flowsForElement, getModelDataFlows, groupFlowStages, initialOrBranchStepId } from '@utils/dataFlows';
import { Pencil } from 'lucide-react';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import {
  closeDataFlowSidebar,
  getDataFlowSidebar,
  openDataFlowManager,
  openDataFlowPlayback,
  subscribeDataFlowPlayback,
} from './uiState';

export default function DataFlowsSidebar() {
  const { t } = useTranslation();
  const location = useLocation();
  const panelRef = useRef<HTMLDivElement>(null);
  const sidebar = useSyncExternalStore(
    subscribeDataFlowPlayback,
    getDataFlowSidebar,
    () => null
  );
  const model = useFlatC4Store((s) => s.model);

  const entries = useMemo(() => {
    if (!sidebar) return [];
    const seen = new Set<string>();
    const out: {
      flowId: string;
      name: string;
      stepId: string;
      stepIndex: number;
      stepCount: number;
      stageIndex: number;
    }[] = [];
    for (const hit of flowsForElement(model, sidebar.ownerId)) {
      if (seen.has(hit.flow.id)) continue;
      seen.add(hit.flow.id);
      const stages = groupFlowStages(hit.flow.steps);
      const stageIndex = stages.findIndex((s) => s.steps.some((x) => x.id === hit.step.id));
      out.push({
        flowId: hit.flow.id,
        name: hit.flow.name,
        stepId: hit.step.id,
        stepIndex: hit.stepIndex,
        stepCount: stages.length,
        stageIndex: stageIndex < 0 ? hit.stepIndex : stageIndex,
      });
    }
    return out;
  }, [sidebar, model]);

  /* Capture phase — same as docs list. React Flow stops bubbling pane events. */
  useEffect(() => {
    if (!sidebar) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (panelRef.current?.contains(target)) return;
      if (target.closest('[data-flow-sidebar-trigger]')) return;
      closeDataFlowSidebar();
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDataFlowSidebar();
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [sidebar]);

  const openInManager = (flowId: string, stepId: string) => {
    leaveWorkspaceOverlays({ resetTrail: true });
    const from = `${location.pathname}${location.search}`;
    const returnView = {
      viewLevel: model.viewLevel,
      activeSystemId: model.activeSystemId,
      activeContainerId: model.activeContainerId,
      activeComponentId: model.activeComponentId,
    };
    try {
      sessionStorage.setItem('c4-flows-return', from);
      sessionStorage.setItem('c4-flows-return-view', JSON.stringify(returnView));
    } catch {
      /* ignore */
    }
    openDataFlowManager({ flowId, stepId });
  };

  if (!sidebar) return null;

  return (
    <SidePanelShell
      panelRef={panelRef}
      data-panel="data-flows"
      width="300px"
      title={<MagicFlowTitle label={t('data_flow_title')} iconSize={16} fontSize="md" />}
      subtitle={sidebar.ownerName}
      onClose={closeDataFlowSidebar}
    >
      {entries.length === 0 ? (
        <PanelEmptyState>{t('data_flow_sidebar_empty')}</PanelEmptyState>
      ) : (
        entries.map((entry) => (
          <PanelListItem
            key={entry.flowId}
            onClick={() => {
              const flow = getModelDataFlows(model).find((f) => f.id === entry.flowId);
              openDataFlowPlayback({
                flowId: entry.flowId,
                stepIndex: entry.stepIndex,
                flowSnapshot: flow,
                stepCount: flow?.steps.length,
                branchStepId: flow
                  ? initialOrBranchStepId(flow.steps, entry.stepIndex, entry.stepId)
                  : null,
                returnView: {
                  viewLevel: model.viewLevel,
                  activeSystemId: model.activeSystemId,
                  activeContainerId: model.activeContainerId,
                  activeComponentId: model.activeComponentId,
                },
              });
            }}
            title={entry.name || t('data_flow_new')}
            subtitle={t('data_flow_play_from_step', {
              n: entry.stageIndex + 1,
              count: entry.stepCount,
            })}
            actions={
              <ToolbarIconButton
                aria-label={t('data_flow_open_manager')}
                title={t('data_flow_open_manager')}
                onClick={() => openInManager(entry.flowId, entry.stepId)}
              >
                <Pencil size={14} />
              </ToolbarIconButton>
            }
          />
        ))
      )}
    </SidePanelShell>
  );
}
