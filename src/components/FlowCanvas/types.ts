import type { Connection, Edge, Node } from '@xyflow/react';
import type { ViewLevel } from '@archivisio/c4-modelizer-sdk';
import type React from 'react';

export interface FlowCanvasProps {
  nodes: Node[];
  /** Canvas corner slot, e.g. the level helper. */
  bottomRight?: React.ReactNode;
  /** Sits to the right of the zoom bar, in the same bottom-left cluster. */
  bottomLeft?: React.ReactNode;
  edges: Edge[];
  onConnect: (params: Edge | Connection) => void;
  onNodePositionChange: (id: string, position: { x: number; y: number }) => void;
  /** Called while dragging — unused in Community (no collab broadcast). */
  onNodeDragLive?: (elements: { id: string; position: { x: number; y: number } }[]) => void;
  /** Called when local drag ends (after positions are committed). */
  onNodeDragLiveEnd?: () => void;
  /** Kept for call-site compatibility; ignored in Community. */
  awareness?: unknown;
  localView?: {
    viewLevel?: string;
    activeSystemId?: string;
    activeContainerId?: string;
    activeComponentId?: string;
    [key: string]: unknown;
  };
  viewLevel: ViewLevel;
  viewKey?: string;
  onNodeDoubleClick?: (nodeId: string, node: Node) => void;
  onNodeClick?: (nodeId: string, node: Node) => void;
  onPaneClick?: () => void;
  /** Double-click on empty board — flow coordinates of the point. */
  onPaneDoubleClick?: (position: { x: number; y: number }) => void;
  onEdgeClick?: (event: React.MouseEvent, edge: Edge) => void;
  onNodeContextMenu?: (event: React.MouseEvent, node: Node) => void;
  onEdgeContextMenu?: (event: React.MouseEvent, edge: Edge) => void;
  /** Pan/zoom to a flow-space point. One-shot per request. */
  followFocus?: {
    x: number;
    y: number;
    requestId: number;
    viewKey: string;
  } | null;
  onFollowFocusApplied?: () => void;
  /** Center/zoom on this node after the current view is ready. */
  focusNodeId?: string | null;
  /** Fit these nodes together (Magic flow playback). Wins over `focusNodeId`. */
  focusNodeIds?: string[] | null;
  viewOnly?: boolean;
  /** Allow Ctrl/Cmd+V (copy always allowed when enabled). */
  canPaste?: boolean;
  onClipboardNotice?: (message: string) => void;
  /** Keep this node visually selected (e.g. while the edit panel is open). */
  highlightNodeId?: string | null;
  /** Keep this edge visually selected (id and/or source+target). */
  highlightEdge?: {
    id?: string | null;
    source?: string | null;
    target?: string | null;
  } | null;
  canDelete?: boolean;
  /** Community has no thread nodes — accepted and ignored. */
  onThreadDelete?: (threadId: string) => Promise<boolean>;
}
