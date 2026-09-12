import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { docsKeys } from '../model/docs.keys';
import type { ProjectDocumentation } from '../api/docs.api';

const createProjectDoc = jest.fn();
const deleteProjectDoc = jest.fn();

jest.mock('../api/docs.api', () => ({
  docsApi: {
    createProjectDoc: (...a: unknown[]) => createProjectDoc(...a),
    deleteProjectDoc: (...a: unknown[]) => deleteProjectDoc(...a),
  },
}));

import { useCreateProjectDoc, useDeleteProjectDoc } from '../model/docs.mutations';

const projectId = 'p1';
const listKey = docsKeys.list(projectId);
const ownerKey = docsKeys.list(projectId, { ownerType: 'system', ownerId: 's1' });

const row: ProjectDocumentation = {
  id: 'd1',
  project_id: projectId,
  owner_type: 'system',
  owner_id: 's1',
  title: 'Doc',
  markdown: '# Hi',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  jest.clearAllMocks();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData<ProjectDocumentation[]>(listKey, [row]);
  client.setQueryData<ProjectDocumentation[]>(ownerKey, [row]);
});

describe('useCreateProjectDoc', () => {
  it('invalidates every docs list for the project after create', async () => {
    createProjectDoc.mockResolvedValue({ doc: { ...row, id: 'd2' } });

    const { result } = renderHook(() => useCreateProjectDoc(projectId), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        ownerType: 'system',
        ownerId: 's1',
        title: 'New',
        markdown: '',
      });
    });

    await waitFor(() => {
      expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
      expect(client.getQueryState(ownerKey)?.isInvalidated).toBe(true);
    });
  });
});

describe('useDeleteProjectDoc', () => {
  it('drops the row from cached lists before refetch lands', async () => {
    deleteProjectDoc.mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useDeleteProjectDoc(projectId), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('d1');
    });

    expect(client.getQueryData<ProjectDocumentation[]>(listKey)).toEqual([]);
    expect(client.getQueryData<ProjectDocumentation[]>(ownerKey)).toEqual([]);
  });
});
