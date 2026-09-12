import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';

const upsertDataFlow = jest.fn();
const deleteDataFlow = jest.fn();

jest.mock('../api/data-flows.api', () => ({
  dataFlowsApi: {
    upsertDataFlow: (...args: unknown[]) => upsertDataFlow(...args),
    deleteDataFlow: (...args: unknown[]) => deleteDataFlow(...args),
  },
}));

import { useDeleteDataFlow, useUpsertDataFlow } from '../model/data-flows.mutations';

const projectId = 'p1';

let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  jest.clearAllMocks();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  upsertDataFlow.mockResolvedValue({ ok: true });
  deleteDataFlow.mockResolvedValue({ ok: true });
});

describe('useUpsertDataFlow', () => {
  it('calls the API with project id and payload', async () => {
    const { result } = renderHook(() => useUpsertDataFlow(projectId), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ flowId: 'f1', name: 'Checkout' });
    });

    expect(upsertDataFlow).toHaveBeenCalledWith(projectId, { flowId: 'f1', name: 'Checkout' });
  });
});

describe('useDeleteDataFlow', () => {
  it('calls the API with project id and flow id', async () => {
    const { result } = renderHook(() => useDeleteDataFlow(projectId), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('f1');
    });

    expect(deleteDataFlow).toHaveBeenCalledWith(projectId, 'f1');
  });
});
