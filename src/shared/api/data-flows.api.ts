import type { DomainElement, DomainMapEdge, DomainMapElement, WorkspaceSearchElement } from './types';

/**
 * Community: Magic flows persist in the local model.
 * Remote upserts are no-ops so callers never hit `/api/projects/.../data-flows`.
 */
export const dataFlowsApi = {
  upsertDataFlow: async (
    _projectId: string,
    payload: {
      flowId?: string;
      name?: string;
      description?: string;
      steps?: unknown[];
      documentationIds?: string[];
      sequenceIds?: string[];
      magicSequenceId?: string;
      magicSequenceSourceKey?: string;
    }
  ) => ({
    ok: true as const,
    created: !payload.flowId,
    flow: payload,
  }),

  upsertSequence: async (
    _projectId: string,
    payload: {
      ownerType: 'container' | 'component';
      ownerId: string;
      name: string;
      plantUmlSource: string;
      diagramId?: string;
    }
  ) => ({
    ok: true as const,
    created: !payload.diagramId,
    diagram: {
      id: payload.diagramId || crypto.randomUUID(),
      name: payload.name,
      plantUmlSource: payload.plantUmlSource,
    },
    ownerType: payload.ownerType,
    ownerId: payload.ownerId,
  }),

  deleteDataFlow: async (_projectId: string, flowId: string) => ({
    ok: true as const,
    flow: { id: flowId },
  }),

  upsertDataFlowStep: async (
    _projectId: string,
    flowId: string,
    payload: {
      stepId?: string;
      index?: number;
      name?: string;
      description?: string;
      from?: { id: string; type: string };
      to?: { id: string; type: string };
      endpointIds?: string[];
      channelIds?: string[];
      connections?: { sourceId: string; targetId: string }[];
      parallelGroupId?: string;
      branchKind?: 'parallel' | 'alternative';
      branchArmId?: string;
    }
  ) => ({
    ok: true as const,
    created: !payload.stepId,
    flow: { id: flowId },
    step: { id: payload.stepId || crypto.randomUUID(), ...payload },
  }),

  deleteDataFlowStep: async (_projectId: string, flowId: string, stepId: string) => ({
    ok: true as const,
    flow: { id: flowId },
    step: { id: stepId },
  }),
};

/** Cross-project domain map is Cloud-only — empty locally. */
export const domainsApi = {
  getDomainMap: async () => ({
    domains: [] as DomainMapElement[],
    edges: [] as DomainMapEdge[],
  }),
  listDomainElements: async (_params?: {
    level?: 'system' | 'container';
    q?: string;
    limit?: number;
    offset?: number;
  }) => ({ elements: [] as DomainElement[], hasMore: false, total: 0 }),
  searchWorkspaceElements: async (_params: {
    projectId: string;
    q: string;
    limit?: number;
    offset?: number;
  }) => ({
    elements: [] as WorkspaceSearchElement[],
    hasMore: false,
    total: 0,
  }),
};
