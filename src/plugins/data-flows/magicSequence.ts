import type { User } from '@shared/api';
import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import type { SequenceDiagramExtras, StoredDataFlow, StoredSequenceDiagram } from '@/types/c4Extensions';
import { stampAuditUpdate, personRefFromUser } from '@utils/audit';
import {
  type MagicSequencePlan,
  planMagicSequence,
} from '@utils/flowToSequence';

/**
 * Drop this diagram from every owner except the one it is moving to.
 *
 * The magic sequence hangs off whichever element the flow's first step starts
 * at, so editing the front of a flow moves it. Writing the new source at the
 * new owner without clearing the old one left the same diagram id on two
 * elements, and every lookup by id — the preview among them — resolves through
 * a map built by walking containers then components, where the last copy wins.
 * The flow then generated correct source and showed the stale diagram.
 */
function removeSequenceElsewhere(
  model: FlatC4Model,
  diagramId: string,
  keepOwnerType: 'container' | 'component',
  keepOwnerId: string
): void {
  const sweep = (
    list: Array<{ id: string } & SequenceDiagramExtras>,
    ownerType: 'container' | 'component'
  ) => {
    list.forEach((owner, i) => {
      if (ownerType === keepOwnerType && owner.id === keepOwnerId) return;
      const diagrams = owner.sequenceDiagrams;
      if (!diagrams?.some((d) => d.id === diagramId)) return;
      list[i] = {
        ...owner,
        sequenceDiagrams: diagrams.filter((d) => d.id !== diagramId),
      } as (typeof list)[number];
    });
  };
  sweep(model.containers as Array<{ id: string } & SequenceDiagramExtras>, 'container');
  sweep(model.components as Array<{ id: string } & SequenceDiagramExtras>, 'component');
}

export function upsertSequenceOnModel(
  model: FlatC4Model,
  ownerType: 'container' | 'component',
  ownerId: string,
  diagram: Pick<StoredSequenceDiagram, 'id' | 'name' | 'plantUmlSource'> & {
    createdAt?: string;
    updatedAt?: string;
    createdBy?: StoredSequenceDiagram['createdBy'];
    updatedBy?: StoredSequenceDiagram['updatedBy'];
  }
): FlatC4Model {
  const now = new Date().toISOString();
  const next = structuredClone(model) as FlatC4Model;
  removeSequenceElsewhere(next, diagram.id, ownerType, ownerId);

  const patchOwner = (
    list: Array<{ id: string } & SequenceDiagramExtras>,
    idx: number
  ) => {
    const owner = list[idx] as typeof list[number] & SequenceDiagramExtras;
    const diagrams = [...(owner.sequenceDiagrams ?? [])];
    const existingIdx = diagrams.findIndex((d) => d.id === diagram.id);
    const stored: StoredSequenceDiagram =
      existingIdx >= 0
        ? {
            ...diagrams[existingIdx]!,
            name: diagram.name,
            plantUmlSource: diagram.plantUmlSource,
            updatedAt: diagram.updatedAt || now,
            ...(diagram.updatedBy ? { updatedBy: diagram.updatedBy } : {}),
          }
        : {
            id: diagram.id,
            name: diagram.name,
            plantUmlSource: diagram.plantUmlSource,
            modelVersion: 1,
            createdAt: diagram.createdAt || now,
            updatedAt: diagram.updatedAt || now,
            ...(diagram.createdBy ? { createdBy: diagram.createdBy } : {}),
            ...(diagram.updatedBy ? { updatedBy: diagram.updatedBy } : {}),
          };
    if (existingIdx >= 0) diagrams[existingIdx] = stored;
    else diagrams.push(stored);
    list[idx] = { ...owner, sequenceDiagrams: diagrams } as typeof list[number];
  };

  if (ownerType === 'container') {
    const idx = next.containers.findIndex((c) => c.id === ownerId);
    if (idx < 0) return model;
    patchOwner(next.containers as Array<{ id: string } & SequenceDiagramExtras>, idx);
    return next;
  }

  const idx = next.components.findIndex((c) => c.id === ownerId);
  if (idx < 0) return model;
  patchOwner(next.components as Array<{ id: string } & SequenceDiagramExtras>, idx);
  return next;
}

export function buildMagicSequenceFlowPatch(
  flow: StoredDataFlow,
  plan: MagicSequencePlan
): StoredDataFlow {
  return {
    ...flow,
    sequenceIds: plan.sequenceIds,
    magicSequenceId: plan.magicSequenceId,
    magicSequenceSourceKey: plan.magicSequenceSourceKey,
  };
}

export function applyMagicSequenceLocally(
  model: FlatC4Model,
  flow: StoredDataFlow,
  user?: User | null
): { model: FlatC4Model; flow: StoredDataFlow; plan: MagicSequencePlan } | { error: string } {
  const author = personRefFromUser(user);
  const result = planMagicSequence(model, flow, author || undefined);
  if (!result.ok) {
    if (result.error === 'invalid_first_service') return { error: 'invalid_first_service' };
    if (result.error === 'no_steps') return { error: 'no_steps' };
    return { error: 'empty_flow' };
  }

  const now = new Date().toISOString();
  const { plan } = result;
  const nextModel = upsertSequenceOnModel(model, plan.owner.ownerType, plan.owner.ownerId, {
    id: plan.diagramId,
    name: plan.diagramName,
    plantUmlSource: plan.plantUmlSource,
    createdAt: plan.created ? now : undefined,
    updatedAt: now,
    ...(author ? { createdBy: author, updatedBy: author } : {}),
  });
  const nextFlow: StoredDataFlow = {
    ...buildMagicSequenceFlowPatch(flow, plan),
    ...stampAuditUpdate(flow, user),
  };

  return { model: nextModel, flow: nextFlow, plan };
}

export { planMagicSequence };
