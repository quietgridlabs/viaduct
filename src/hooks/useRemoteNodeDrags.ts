import type { Node } from '@xyflow/react';
import { useCallback } from 'react';

/** Community: no remote peer drags. */
export function useRemoteNodeDrags(
  _awareness: unknown,
  _localView: unknown,
  _setInternalNodes: React.Dispatch<React.SetStateAction<Node[]>>,
  _localDraggingIdsRef: React.MutableRefObject<Set<string>>
) {
  const mergeWithRemoteDrags = useCallback((nodes: Node[]) => nodes, []);
  return { mergeWithRemoteDrags };
}
