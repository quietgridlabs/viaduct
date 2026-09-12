import type { Node } from '@xyflow/react';

/** Thread node payload — Community never renders threads; shape is permissive. */
export type ThreadNodeData = {
  id?: string;
  body?: string;
  x?: number;
  y?: number;
  position?: { x: number; y: number };
  viewLevel?: string;
  thread?: unknown;
  projectId?: string;
  currentUser?: unknown;
  peers?: unknown[];
  canEdit?: boolean;
  [key: string]: unknown;
};

export function attachToProject(_projectId: string | null, _canWrite = false) {}

export function threadBelongsToView(_thread: ThreadNodeData, _model: unknown): boolean {
  return false;
}

export function useThreads(_projectId: string | null) {
  return [] as Array<ThreadNodeData & { id: string; x: number; y: number }>;
}

export function useDeleteThread(_projectId: string) {
  return {
    mutateAsync: async (_id: string) => {},
    isPending: false,
  };
}

export function useMoveThread(_projectId: string) {
  return {
    mutateAsync: async (_args: { id: string; x: number; y: number }) => {},
    mutate: (_args: { threadId: string; position: { x: number; y: number } }) => {},
    isPending: false,
  };
}

/** Placeholder node type — Community does not render threads. */
export function ThreadNode(_props: { data: ThreadNodeData }) {
  return null;
}

export function threadsToNodes(_threads: ThreadNodeData[]): Node[] {
  return [];
}
