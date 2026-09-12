import { requestDiagramFocus } from '@/navigation/diagramFocusBus';
import { showWorkspaceNotice } from '@/state/workspaceNotice';
import { cloneOriginalRef } from '@utils/domains';
import { isCloneBlock } from '@utils/cloneSource';
import { planCloneJump } from '@utils/cloneJump';
import { diagramFocusMatchesView } from '@utils/serviceCatalog';
import { useFlatC4Store, useFlatNavigation } from '@archivisio/c4-modelizer-sdk';
import { runLevelChange } from '@/state/levelTransition';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

export { planCloneJump } from '@utils/cloneJump';
export type { CloneJumpPlan } from '@utils/cloneJump';

type BlockLike = {
  id: string;
  type?: string;
  systemId?: string;
  containerId?: string;
  original?: { id?: string; type?: string; projectId?: string };
  domainId?: string;
};

export function isCrossDomainClone(
  item: BlockLike,
  model: { systems?: BlockLike[]; containers?: BlockLike[] },
  currentProjectId?: string
): boolean {
  const original = cloneOriginalRef(item);
  if (!original?.id) return false;
  if (original.projectId && original.projectId !== currentProjectId) return true;

  const collections = [...(model.systems || []), ...(model.containers || [])];
  const src = collections.find((b) => b.id === original.id && !b.original);
  return Boolean(src?.domainId);
}

/** Community: no remote projects. */
export async function canViewProject(_projectId: string): Promise<boolean> {
  return false;
}

/** Jump to the original card (in-project clones only). */
export function useCloneJump(item: BlockLike): (() => void) | undefined {
  const { projectId: currentProjectId } = useParams();
  const model = useFlatC4Store((s) => s.model);
  const { navigateToView } = useFlatNavigation();
  const { t } = useTranslation();

  const enabled = isCloneBlock(item);

  const jump = useCallback(() => {
    const plan = planCloneJump(item, model, currentProjectId);
    if (!plan) return;

    if (plan.kind === 'missing') {
      showWorkspaceNotice(t('clone_original_missing'));
      return;
    }

    if (plan.kind === 'remote') {
      showWorkspaceNotice(t('domain_project_no_access', { defaultValue: 'Remote clones are Cloud-only.' }));
      return;
    }

    const { target } = plan;
    if (!diagramFocusMatchesView(model, target)) {
      runLevelChange(() => {
        navigateToView(
          target.viewLevel,
          target.activeSystemId,
          target.activeContainerId,
          target.activeComponentId
        );
        requestDiagramFocus(target.id);
      });
      return;
    }
    requestDiagramFocus(target.id);
  }, [item, currentProjectId, model, navigateToView, t]);

  return enabled ? jump : undefined;
}

/** @deprecated Use useCloneJump — jump is no longer limited to cross-domain clones. */
export const useCrossDomainCloneJump = useCloneJump;
