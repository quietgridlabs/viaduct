import { useMutation } from '@tanstack/react-query';
import { dataFlowsApi } from '../api/data-flows.api';

export type UpsertDataFlowPayload = {
  flowId?: string;
  name?: string;
  description?: string;
  steps?: unknown[];
  documentationIds?: string[];
  sequenceIds?: string[];
  magicSequenceId?: string;
  magicSequenceSourceKey?: string;
};

export type UpsertSequencePayload = {
  ownerType: 'container' | 'component';
  ownerId: string;
  name: string;
  plantUmlSource: string;
  diagramId?: string;
};

/** Flows live in the model (Zustand); mutations only persist writes to the server. */
export function useUpsertDataFlow(projectId: string) {
  return useMutation({
    mutationFn: (payload: UpsertDataFlowPayload) =>
      dataFlowsApi.upsertDataFlow(projectId, payload),
  });
}

export function useDeleteDataFlow(projectId: string) {
  return useMutation({
    mutationFn: (flowId: string) => dataFlowsApi.deleteDataFlow(projectId, flowId),
  });
}

export function useUpsertSequence(projectId: string) {
  return useMutation({
    mutationFn: (payload: UpsertSequencePayload) =>
      dataFlowsApi.upsertSequence(projectId, payload),
  });
}
