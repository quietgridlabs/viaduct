import { cloneOriginalRef } from '@utils/domains';
import {
  resolveDiagramFocus,
  type DiagramFocusTarget,
} from '@utils/serviceCatalog';
import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';

type BlockLike = {
  id: string;
  original?: { id?: string; type?: string; projectId?: string };
};

export type CloneJumpPlan =
  | { kind: 'remote'; projectId: string; focusId: string }
  | { kind: 'local'; target: DiagramFocusTarget }
  | { kind: 'missing' };

/** Where the clone's original lives — same project, another project, or gone. */
export function planCloneJump(
  item: BlockLike,
  model: FlatC4Model,
  currentProjectId?: string
): CloneJumpPlan | null {
  const original = cloneOriginalRef(item);
  if (!original?.id) return null;

  const isRemote = Boolean(original.projectId && original.projectId !== currentProjectId);
  if (isRemote && original.projectId) {
    return { kind: 'remote', projectId: original.projectId, focusId: original.id };
  }

  const target = resolveDiagramFocus(model, original.id);
  if (!target) return { kind: 'missing' };
  return { kind: 'local', target };
}
