import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { docsApi } from '../api/docs.api';
import { docsKeys, type DocOwnerFilter } from './docs.keys';
import type { ProjectDocumentation } from '../api/docs.api';

type CreatePayload = {
  id?: string;
  ownerType: 'system' | 'container' | 'component' | 'code';
  ownerId: string;
  title: string;
  markdown: string;
};

type UpdatePayload = {
  title?: string;
  markdown?: string;
  ownerType?: 'system' | 'container' | 'component' | 'code';
  ownerId?: string;
};

export function invalidateProjectDocs(client: QueryClient, projectId: string): Promise<void> {
  return client.invalidateQueries({ queryKey: docsKeys.prefix(projectId) }).then(() => undefined);
}

function useDocsInvalidation(projectId: string) {
  const client = useQueryClient();
  return () => invalidateProjectDocs(client, projectId);
}

export function useCreateProjectDoc(projectId: string) {
  const invalidate = useDocsInvalidation(projectId);
  return useMutation({
    mutationFn: (payload: CreatePayload) =>
      docsApi.createProjectDoc(projectId, payload).then((r) => r.doc),
    onSuccess: invalidate,
  });
}

/** When the project id is only known after create (onboarding), pass it per call. */
export function useCreateProjectDocForProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (vars: { projectId: string; payload: CreatePayload }) =>
      docsApi.createProjectDoc(vars.projectId, vars.payload).then((r) => r.doc),
    onSuccess: (_doc, vars) => invalidateProjectDocs(client, vars.projectId),
  });
}

export function useUpdateProjectDoc(projectId: string) {
  const invalidate = useDocsInvalidation(projectId);
  return useMutation({
    mutationFn: (vars: { docId: string; payload: UpdatePayload }) =>
      docsApi.updateProjectDoc(projectId, vars.docId, vars.payload).then((r) => r.doc),
    onSuccess: invalidate,
  });
}

export function useUpdateProjectDocForProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (vars: { projectId: string; docId: string; payload: UpdatePayload }) =>
      docsApi
        .updateProjectDoc(vars.projectId, vars.docId, vars.payload)
        .then((r) => r.doc),
    onSuccess: (_doc, vars) => invalidateProjectDocs(client, vars.projectId),
  });
}

function patchDocOutOfCaches(client: QueryClient, projectId: string, docId: string) {
  client.setQueriesData<ProjectDocumentation[]>(
    { queryKey: docsKeys.prefix(projectId), exact: false },
    (prev) => prev?.filter((d) => d.id !== docId)
  );
}

export function useDeleteProjectDoc(projectId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (docId: string) => docsApi.deleteProjectDoc(projectId, docId),
    onSuccess: (_result, docId) => {
      patchDocOutOfCaches(client, projectId, docId);
      return invalidateProjectDocs(client, projectId);
    },
  });
}

export function useDeleteProjectDocForProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (vars: { projectId: string; docId: string }) =>
      docsApi.deleteProjectDoc(vars.projectId, vars.docId),
    onSuccess: (_result, vars) => {
      patchDocOutOfCaches(client, vars.projectId, vars.docId);
      return invalidateProjectDocs(client, vars.projectId);
    },
  });
}

export type { CreatePayload, UpdatePayload, DocOwnerFilter };
