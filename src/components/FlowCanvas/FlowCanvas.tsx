import {
  Background,
  BackgroundVariant,
  Connection,
  Edge,
  MarkerType,
  Node,
  NodeChange,
  Panel,
  PanOnScrollMode,
  ReactFlow,
  SelectionMode,
  applyNodeChanges,
  useReactFlow,
} from "@xyflow/react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useTranslation } from "react-i18next";
import { trackProductEvent } from "@/metrics";

import { CanvasMotionContext } from "@contexts/CanvasMotionContext";
import { useAuth } from "@contexts/AuthContext";
import { useColorMode } from "@contexts/ColorModeContext";
import { useDialogs } from "@contexts/DialogContext";
import { useWorkspaceOverlayCoversCanvas } from "@hooks/useWorkspaceOverlayCoversCanvas";
import { isGuestUser } from "@shared/api";
import { useFlatStore, useFlatC4Store } from "@archivisio/c4-modelizer-sdk";
import { elementIdsWithTag } from "@utils/tagCatalog";
import { getHighlightedTag, subscribeHighlightedTag } from "@/features/tags/uiState";
import { useDiagramClipboard } from "@hooks/useDiagramClipboard";
import { useRemoteNodeDrags } from "@hooks/useRemoteNodeDrags";
import { canvasSafeTechColor, getTechnologyById } from "@data/technologies";
import {
  neutralAccentColor,
  CANVAS_DOT_GAP,
  CANVAS_DOT_SIZE,
  CANVAS_NODE_WIDTH,
} from "@theme/canvasSurfaces";
import { useCanvasPrefs } from "@/state/canvasPrefs";
import { forgetEndpointOperation } from "@utils/serviceContract";
import { isDuckHopActive } from "@/state/duckHopGame";
import {
  getDiffOverlaySnapshot,
  subscribeDiffOverlay,
} from "@/state/diffOverlay";
import { ghostBelongsToView } from "@utils/ghostVisibility";
import { MAGIC_FLOW_FG } from "@components/data-flow/MagicFlowMark";
import LevelTransitionOverlay from "@components/LevelTransitionOverlay";
import ConfirmDialog from "@components/common/ConfirmDialog";
import { Box, HStack } from "@chakra-ui/react";
import CanvasZoomBar from "@components/common/CanvasZoomBar";
import { registerFlowInstance, unregisterFlowInstance } from "@utils/flowViewport";
import { buildGroupFrameNodes } from "@utils/elementGroups";
import { isGroupFrameNodeId } from "@/types/c4Extensions";
import type { FinalConnectionState, OnSelectionChangeParams } from "@xyflow/react";
import ClearConnectionTracePanel from "./ClearConnectionTracePanel";
import { edgeTypes, nodeTypes } from "./constants";
import { buildGhostNode, isGhostNode, nodesLayoutEqual } from "./helpers";
import type { FlowCanvasProps } from "./types";
import { isTypingTarget } from '@utils/typingTarget';

const FlowCanvas: React.FC<FlowCanvasProps> = ({
  nodes,
  bottomRight,
  bottomLeft,
  edges,
  onConnect,
  onNodePositionChange,
  onNodeDragLive,
  onNodeDragLiveEnd,
  awareness,
  localView,
  viewLevel,
  viewKey,
  onNodeDoubleClick,
  onNodeClick,
  onPaneClick,
  onPaneDoubleClick,
  onEdgeClick,
  onNodeContextMenu,
  onEdgeContextMenu,
  followFocus,
  onFollowFocusApplied,
  focusNodeId,
  focusNodeIds,
  viewOnly = false,
  canPaste = true,
  onClipboardNotice,
  highlightNodeId = null,
  highlightEdge = null,
  canDelete = true,
  onThreadDelete,
}) => {
  const flowKey = viewKey || viewLevel;
  const overlayCoversCanvas = useWorkspaceOverlayCoversCanvas();
  const model = useFlatC4Store((s) => s.model);
  const highlightedTag = useSyncExternalStore(subscribeHighlightedTag, getHighlightedTag);
  const canvasRef = useRef<HTMLDivElement>(null);
  const overlayEditorOpen = overlayCoversCanvas;
  /* The board is behind a panel: dimmed, blurred and deaf to clicks. */
  const canvasReadOnly = overlayEditorOpen;
  /*
   * Nothing here may be changed — either a panel is in the way, or this is a
   * read-only viewer. Kept apart from `canvasReadOnly` because a viewer must
   * still be able to click a card and read it; only the gestures that would
   * rearrange the board are withheld.
   */
  const editLocked = overlayEditorOpen || viewOnly;
  const { setPendingConnection } = useDialogs();
  const { user } = useAuth();
  const guestSession = isGuestUser(user);
  const { getBlockById } = useFlatStore();
  const {
    removeSystem,
    removeContainer,
    removeComponent,
    removeCodeElement,
    removeConnection,
  } = useFlatC4Store();
  /* Where on the C4 tree the canvas is currently looking — needed to decide
     which ghosts belong on THIS screen. A container removed from system A
     must not appear while looking at system B's containers. */
  const activeSystemId = useFlatC4Store((s) => s.model.activeSystemId);
  const activeContainerIdForDiff = useFlatC4Store((s) => s.model.activeContainerId);
  const activeComponentId = useFlatC4Store((s) => s.model.activeComponentId);
  const diffOverlay = useSyncExternalStore(
    subscribeDiffOverlay,
    getDiffOverlaySnapshot,
    () => null
  );
  const reactFlowInstance = useReactFlow();
  React.useEffect(() => {
    registerFlowInstance(reactFlowInstance);
    return () => unregisterFlowInstance();
  }, [reactFlowInstance]);
  const { mode, chrome } = useColorMode();
  const plainEdges = useCanvasPrefs().edgeColors === 'neutral';
  const { t } = useTranslation();
  const localDraggingIdsRef = useRef<Set<string>>(new Set());
  const selectedIdsRef = useRef<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<{
    nodes: Node[];
    edges: Edge[];
  } | null>(null);
  const pendingDeleteResolveRef = useRef<((allow: boolean) => void) | null>(null);

  const getSelectedIds = useCallback(() => selectedIdsRef.current, []);

  useDiagramClipboard({
    enabled: true,
    canPaste,
    getSelectedIds,
    onNotice: onClipboardNotice,
  });

  /* Connection selection is owned here rather than by React Flow: the edge list
     is rebuilt from the model on every render, so RF's internal `selected` flag
     would be dropped on the next update. */
  const [selectedEdge, setSelectedEdge] = useState<{
    id: string;
    source: string;
    target: string;
  } | null>(null);

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes }: OnSelectionChangeParams) => {
      selectedIdsRef.current = selectedNodes
        .filter((n) => !isGroupFrameNodeId(n.id))
        .map((n) => n.id);
    },
    []
  );

  useEffect(() => {
    if (!followFocus) return;
    const currentKey = localView
      ? [
          localView.viewLevel,
          localView.activeSystemId || '',
          localView.activeContainerId || '',
          localView.activeComponentId || '',
        ].join(':')
      : flowKey;
    // Ignore stale follow targets after the user left that peer's layer.
    if (followFocus.viewKey !== currentKey) return;
    const { x, y } = followFocus;
    // Wait for view remount / fitView, then center on peer cursor once.
    const id = window.setTimeout(() => {
      const zoom = Math.max(reactFlowInstance.getZoom(), 0.85);
      reactFlowInstance.setCenter(x, y, { zoom, duration: 450 });
      onFollowFocusApplied?.();
    }, 80);
    return () => window.clearTimeout(id);
  }, [followFocus, reactFlowInstance, flowKey, localView, onFollowFocusApplied]);

  /* Lighting up a tag is a question about where its elements are, and on a
     board wider than the viewport the answer is usually off screen — the rail
     would dim everything and leave the reader to go looking. Fitting to them
     answers it. Keyed on the tag alone: a highlight that stays put must not
     yank the view back every time the model ticks. */
  useEffect(() => {
    if (!highlightedTag) return;
    const ids = elementIdsWithTag(model, highlightedTag);
    if (!ids.length) return;
    const timer = window.setTimeout(() => {
      const found = ids
        .map((id) => reactFlowInstance.getNode(id))
        .filter((node): node is Node => Boolean(node));
      if (!found.length) return;
      void reactFlowInstance.fitView({ nodes: found, padding: 0.35, duration: 450, maxZoom: 1 });
    }, 60);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedTag, reactFlowInstance]);

  const playbackFit = Boolean(focusNodeIds && focusNodeIds.length > 0);
  const focusIdsKey = playbackFit
    ? [...focusNodeIds!].sort().join('|')
    : focusNodeId || '';

  useEffect(() => {
    const ids = playbackFit
      ? [...new Set(focusNodeIds!)]
      : focusNodeId
        ? [focusNodeId]
        : [];
    if (!ids.length) return;
    let attempts = 0;
    let timer = 0;
    const fitOptions = playbackFit
      ? {
          padding: { top: 0.28, right: 0.22, left: 0.42, bottom: 0.22 },
          duration: 450,
          maxZoom: 0.6,
          minZoom: 0.1,
        }
      : {
          padding: 0.45,
          duration: 400,
          maxZoom: 1.05,
        };
    const tryFit = () => {
      const found = ids
        .map((id) => reactFlowInstance.getNode(id))
        .filter((node): node is Node => Boolean(node));
      const waiting = found.length === 0 || found.length < ids.length;
      if (waiting && attempts++ < 8) {
        timer = window.setTimeout(tryFit, 80);
        return;
      }
      if (found.length === 0) return;
      void reactFlowInstance.fitView({ nodes: found, ...fitOptions });
    };
    timer = window.setTimeout(tryFit, 120);
    return () => window.clearTimeout(timer);
  }, [focusIdsKey, playbackFit, focusNodeId, focusNodeIds, flowKey, reactFlowInstance]);

  const defaultEdgeOptions = useMemo(
    () => ({
      animated: false,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
        color: chrome.edgeStroke,
      },
      markerStart: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
        color: chrome.edgeStroke,
      },
      style: {
        strokeWidth: 1.5,
        stroke: chrome.edgeStroke,
        opacity: 0.85,
      },
    }),
    [chrome.edgeStroke]
  );

  const [internalNodes, setInternalNodes] = useState<Node[]>(nodes);

  const { mergeWithRemoteDrags } = useRemoteNodeDrags(
    awareness,
    localView,
    setInternalNodes,
    localDraggingIdsRef
  );

  // Hard-block native browser context menu anywhere inside canvas.
  // React handlers are not always enough because some nested DOM can bypass them.
  useEffect(() => {
    const root = canvasRef.current;
    if (!root) return;
    const blockMenu = (event: Event) => event.preventDefault();
    root.addEventListener('contextmenu', blockMenu, { capture: true });
    return () => root.removeEventListener('contextmenu', blockMenu, { capture: true });
  }, []);

  useEffect(() => {
    const next = mergeWithRemoteDrags(nodes);
    // Hard-reset positions on view switch without remounting React Flow.
    setInternalNodes(next);
    const id = window.setTimeout(() => {
      void reactFlowInstance.fitView({ padding: 0.2, includeHiddenNodes: false });
    }, 0);
    return () => window.clearTimeout(id);
  }, [flowKey, reactFlowInstance]); // eslint-disable-line react-hooks/exhaustive-deps -- intentional: hard reset on view switch

  useEffect(() => {
    const next = mergeWithRemoteDrags(nodes);
    setInternalNodes((prev) => {
      if (nodesLayoutEqual(prev, next)) return prev;
      const prevById = new Map(prev.map((n) => [n.id, n]));
      return next.map((n) => {
        const old = prevById.get(n.id);
        if (!old?.measured) return n;
        return {
          ...n,
          measured: n.measured ?? old.measured,
          width: n.width ?? old.width,
          height: n.height ?? old.height,
        };
      });
    });
  }, [nodes, mergeWithRemoteDrags]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    const next = changes.filter((c) => !('id' in c) || !isGroupFrameNodeId(String(c.id)));
    if (!next.length) return;
    setInternalNodes((nds) => applyNodeChanges(next, nds));
  }, []);

  const handleNodeDrag = useCallback(
    (_: React.MouseEvent, node: Node, dragged: Node[]) => {
      if (!onNodeDragLive) return;
      const list = dragged?.length ? dragged : [node];
      localDraggingIdsRef.current = new Set(list.map((n) => n.id));
      onNodeDragLive(list.map((n) => ({ id: n.id, position: n.position })));
    },
    [onNodeDragLive]
  );

  const handleNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node, dragged: Node[]) => {
      const list = dragged?.length ? dragged : [node];
      localDraggingIdsRef.current = new Set();
      for (const n of list) {
        onNodePositionChange(n.id, n.position);
      }
      onNodeDragLiveEnd?.();
    },
    [onNodePositionChange, onNodeDragLiveEnd]
  );

  const handleNodeDoubleClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      if (canvasReadOnly || isGroupFrameNodeId(node.id) || isGhostNode(node)) return;

      if (onNodeDoubleClick) {
        onNodeDoubleClick(node.id, node);
      }
    },
    [canvasReadOnly, onNodeDoubleClick]
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (canvasReadOnly || isGroupFrameNodeId(node.id) || node.type === 'thread' || isGhostNode(node)) return;
      onNodeClick?.(node.id, node);
    },
    [canvasReadOnly, onNodeClick]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedEdge(null);
    onPaneClick?.();
  }, [onPaneClick]);

  const handleBeforeDelete = useCallback(
    async ({ nodes: nodesToDelete, edges: edgesToDelete }: { nodes: Node[]; edges: Edge[] }) => {
      if (!canDelete) return false;

      // Thread nodes are deleted via their own API — handle them separately
      const threadNodes = nodesToDelete.filter((n) => n.type === 'thread');
      const regularNodes = nodesToDelete.filter((n) => n.type !== 'thread');

      for (const tn of threadNodes) {
        if (onThreadDelete) {
          await onThreadDelete(tn.id);
        }
      }

      // If only thread nodes were selected, we handled everything — block RF from deleting
      if (!regularNodes.length && !edgesToDelete.length) return false;

      return new Promise<boolean>((resolve) => {
        pendingDeleteResolveRef.current = resolve;
        setPendingDelete({ nodes: regularNodes, edges: edgesToDelete });
      });
    },
    [canDelete, onThreadDelete]
  );

  /*
   * Backspace / Delete on the selection, with a guard that knows what typing
   * looks like. React Flow's built-in handling had to go because it cannot
   * tell Monaco from the canvas; `isTypingTarget` can. Everything else about
   * deletion — the confirmation, the endpoint bookkeeping — still runs
   * through `onBeforeDelete` / `onDelete`, because `deleteElements` is the
   * same path React Flow's key handler would have taken.
   */
  useEffect(() => {
    if (overlayEditorOpen || !canDelete) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Backspace' && event.key !== 'Delete') return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      const nodes = reactFlowInstance.getNodes().filter((node) => node.selected);
      const edges = reactFlowInstance.getEdges().filter((edge) => edge.selected);
      if (!nodes.length && !edges.length) return;
      event.preventDefault();
      void reactFlowInstance.deleteElements({ nodes, edges });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlayEditorOpen, canDelete, reactFlowInstance]);

  const cancelPendingDelete = useCallback(() => {
    pendingDeleteResolveRef.current?.(false);
    pendingDeleteResolveRef.current = null;
    setPendingDelete(null);
  }, []);

  const allowPendingDelete = useCallback(() => {
    pendingDeleteResolveRef.current?.(true);
    pendingDeleteResolveRef.current = null;
    setPendingDelete(null);
  }, []);

  const handleDeleteConfirmed = useCallback(
    ({ nodes: nodesToDelete, edges: edgesToDelete }: { nodes: Node[]; edges: Edge[] }) => {
      for (const node of nodesToDelete) {
        if (node.type !== "thread") {
          trackProductEvent('editor.element_deleted', { level: viewLevel });
        }
        if (node.type === "thread") {
          continue; // handled in handleBeforeDelete via onThreadDelete
        } else if (node.type === "system") {
          removeSystem(node.id);
        } else if (node.type === "container") {
          removeContainer(node.id);
        } else if (node.type === "component") {
          /* An endpoint is half of a service's contract; the stored document
             is the other half, and the merge that joins them keeps any path
             the canvas does not claim. Without this the element goes and the
             operation stays, unreachable. */
          const state = useFlatC4Store.getState();
          forgetEndpointOperation(
            state.model,
            state.model.components.find((c) => c.id === node.id) as {
              containerId?: string;
              endpoint?: string;
              method?: string;
            } | undefined,
            state.updateContainer
          );
          removeComponent(node.id);
        } else if (node.type === "code") {
          removeCodeElement(node.id);
        }
      }
      for (const edge of edgesToDelete) {
        removeConnection(viewLevel, edge.source, edge.target);
      }
    },
    [
      removeSystem,
      removeContainer,
      removeComponent,
      removeCodeElement,
      removeConnection,
      viewLevel,
    ]
  );

  const pendingDeleteMessage = useMemo(() => {
    if (!pendingDelete) return "";
    const n = pendingDelete.nodes.length;
    const e = pendingDelete.edges.length;
    if (n && e) {
      return t("delete_selection_confirmation", { nodes: n, edges: e });
    }
    if (n > 1) {
      return t("delete_nodes_confirmation", { count: n });
    }
    if (n === 1) {
      const name =
        (pendingDelete.nodes[0].data as { name?: string } | undefined)?.name ||
        t("connection");
      return t("delete_confirmation_named", { name });
    }
    if (e > 1) {
      return t("delete_edges_confirmation", { count: e });
    }
    return t("delete_connection_confirmation");
  }, [pendingDelete, t]);

  /*
   * Which nodes exist, as a value that only changes when the membership does.
   *
   * The set has to come from `internalNodes` — that is the list actually
   * rendered, and filtering edges against anything else lets the two drift
   * apart, which shows up as edges missing from nodes that are on screen. But
   * `internalNodes` carries live positions and gets a new identity on every
   * frame of a drag, and having the edge list depend on it rebuilt all of them
   * sixty times a second: every edge component re-rendering because one node
   * moved. Joining the ids is cheap and its *result* is stable, so the memo
   * below holds across a drag while still tracking real membership changes.
   */
  const nodeIdKey = internalNodes.map((n) => n.id).join('\u0000');
  const nodeIds = useMemo(() => new Set(nodeIdKey ? nodeIdKey.split('\u0000') : []), [nodeIdKey]);

  /* What the canvas is currently pointing at: the two ends of a selected
     connection, or everything wearing the tag the rail is lighting up. */
  const focusIds = useMemo(() => {
    const ids = new Set(selectedEdge ? [selectedEdge.source, selectedEdge.target] : []);
    for (const id of highlightedTag ? elementIdsWithTag(model, highlightedTag) : []) {
      ids.add(id);
    }
    return ids;
  }, [selectedEdge, highlightedTag, model]);

  const preparedEdges = useMemo(() => {
    const fallback = chrome.edgeStroke;
    /* Markers are baked into the edge object here, so the preference has to be
       read at this level too — TechnologyEdge only owns the stroke. */
    return edges
      .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
      .map((edge) => {
        const technologyId = (edge.data &&
          (edge.data.technology || edge.data.technologyId)) as string | undefined;
        const flowing =
          edge.data?.flowMotion === 'forward' || edge.data?.flowMotion === 'reverse';
        const color = flowing
          ? MAGIC_FLOW_FG
          : plainEdges
            ? neutralAccentColor(mode)
            : canvasSafeTechColor(
                technologyId ? getTechnologyById(technologyId)?.color : undefined,
                fallback,
                mode
              );
        const arrow = {
          type: MarkerType.ArrowClosed,
          width: 18,
          height: 18,
          color,
        };
        const bidirectional = Boolean(edge.data?.bidirectional);
        const highlighted = Boolean(
          (highlightEdge?.id && edge.id === highlightEdge.id) ||
            (highlightEdge?.source &&
              highlightEdge?.target &&
              edge.source === highlightEdge.source &&
              edge.target === highlightEdge.target)
        );
        const inFocus =
          edge.id === selectedEdge?.id ||
          (focusIds.size > 0 && focusIds.has(edge.source) && focusIds.has(edge.target));
        return {
          ...edge,
          selected: highlighted || edge.id === selectedEdge?.id,
          type: "technology" as const,
          animated: false,
          markerEnd: arrow,
          markerStart: bidirectional ? arrow : undefined,
          style: {
            stroke: color,
            strokeWidth: highlighted
              ? 3
              : typeof edge.style?.strokeWidth === 'number'
                ? edge.style.strokeWidth
                : edge.style?.strokeWidth ?? 1.5,
            opacity:
              typeof edge.style?.opacity === 'number' ? edge.style.opacity : edge.style?.opacity,
          },
          data: {
            ...edge.data,
            technologyId,
            bidirectional,
            traceDimmed: focusIds.size > 0 && !inFocus ? true : edge.data?.traceDimmed,
          },
        };
      });
  }, [
    edges,
    nodeIds,
    chrome.edgeStroke,
    mode,
    highlightEdge,
    selectedEdge,
    plainEdges,
    focusIds,
  ]);

  useEffect(() => {
    const root = canvasRef.current;
    if (!root) return;
    const svgs = root.querySelectorAll("svg");
    svgs.forEach((svg) => {
      if (overlayCoversCanvas) svg.pauseAnimations();
      else svg.unpauseAnimations();
    });
  }, [overlayCoversCanvas, preparedEdges]);

  const nodesForFlow = useMemo(() => {
    const linked = focusIds;
    const statusById = diffOverlay?.statusById;
    if (!highlightNodeId && linked.size === 0 && !statusById) return internalNodes;
    return internalNodes.map((n) => {
      const status = statusById?.[n.id];
      if (n.id === highlightNodeId) return { ...n, selected: true };
      if (status) return { ...n, data: { ...n.data, diffStatus: status } };
      if (linked.has(n.id)) {
        return { ...n, data: { ...n.data, linkedHighlight: true } };
      }
      /* Emphasis only reads as emphasis against something quieter. Whatever the
         focus is not about steps back rather than competing with it. */
      if (linked.size > 0) {
        return { ...n, data: { ...n.data, traceDimmed: true } };
      }
      return n;
    });
  }, [internalNodes, highlightNodeId, focusIds, diffOverlay]);

  /* Elements gone from the side being viewed — read-only cards at their old
     position, scoped to the level and parent currently on screen. A removed
     container must not appear while looking at an unrelated system's
     containers, so this filters on exactly what a live node would need to
     match to belong here.
     Edges are not ghosted: a removed connection still shows in the
     comparison panel, but drawing it would mean synthesizing an edge between
     a real node and a ghost (or two ghosts) with no live connection data to
     style it from — a separate piece of work from the node itself. */
  const ghostNodes = useMemo(() => {
    if (!diffOverlay?.ghosts.length) return [];
    const view = {
      viewLevel,
      activeSystemId,
      activeContainerId: activeContainerIdForDiff,
      activeComponentId,
    };
    return diffOverlay.ghosts.filter((g) => ghostBelongsToView(g, view)).map(buildGhostNode);
  }, [diffOverlay, viewLevel, activeSystemId, activeContainerIdForDiff, activeComponentId]);

  const rfNodes = useMemo(() => {
    const frames = buildGroupFrameNodes(nodesForFlow);
    const withGhosts = ghostNodes.length ? [...nodesForFlow, ...ghostNodes] : nodesForFlow;
    return frames.length ? [...frames, ...withGhosts] : withGhosts;
  }, [nodesForFlow, ghostNodes]);

  const handleEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.stopPropagation();
      setSelectedEdge((prev) =>
        prev?.id === edge.id
          ? null
          : { id: edge.id, source: edge.source, target: edge.target }
      );
      if (onEdgeClick) {
        onEdgeClick(event, edge);
      }
    },
    [onEdgeClick]
  );

  /* Dropping a line on empty canvas opens the clone-search bar. Guests have no
     domain catalog to pull from, and the bar is that catalog — so the gesture
     ends quietly for them instead of offering a search that cannot work. */
  const handleConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState: FinalConnectionState) => {
      if (canvasReadOnly || guestSession || isDuckHopActive()) return;
      if (connectionState.fromNode && !connectionState.toNode) {
        setPendingConnection({ event, connectionState });
      }
    },
    [canvasReadOnly, guestSession, setPendingConnection]
  );

  const blockContextMenu = useCallback((event: React.MouseEvent) => event.preventDefault(), []);

  const handlePaneDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if (canvasReadOnly || !onPaneDoubleClick) return;
      /* Only the board itself. A double-click on a node drills into it and on
         an edge or a label belongs to those — React Flow has no pane-only
         double-click, so the target is the test. */
      const target = event.target as HTMLElement | null;
      if (!target?.classList.contains('react-flow__pane')) return;
      const point = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      /* Under the cursor, not beside it: the position is the card's top-left,
         and a block that appears with its corner where you aimed reads as
         having landed somewhere you did not point at. */
      onPaneDoubleClick({ x: point.x - CANVAS_NODE_WIDTH / 2, y: point.y - 60 });
    },
    [canvasReadOnly, onPaneDoubleClick, reactFlowInstance]
  );

  const handlePaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      // Block browser menu; right button is used for pan.
      event.preventDefault();
    },
    []
  );

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      event.stopPropagation();
      if (isGroupFrameNodeId(node.id) || isGhostNode(node)) return;
      onNodeContextMenu?.(event, node);
    },
    [onNodeContextMenu]
  );

  const handleEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      event.stopPropagation();
      onEdgeContextMenu?.(event, edge);
    },
    [onEdgeContextMenu]
  );

  const isValidConnection = useCallback(
    (connectionState: Edge | Connection) => {
      if (connectionState.source === connectionState.target) {
        return false;
      }

      const sourceNode = getBlockById(connectionState.source);
      if (
        sourceNode?.connections
          ?.map((conn) => conn.targetId)
          .includes(connectionState.target)
      ) {
        return false;
      }

      return true;
    },
    [getBlockById]
  );

  return (
    <CanvasMotionContext.Provider value={!overlayCoversCanvas}>
      <Box
        ref={canvasRef}
        className="c4-canvas-layer"
        onContextMenu={blockContextMenu}
        w="100%"
        h="100%"
        overflow="hidden"
        bg={chrome.canvasBg}
        isolation="isolate"
        transform="translateZ(0)"
        opacity={canvasReadOnly ? 0.78 : 1}
        transition="opacity 0.22s ease"
        style={{ backfaceVisibility: "hidden" }}
        css={
          canvasReadOnly
            ? {
                '& .react-flow__viewport': {
                  filter: 'blur(5px) saturate(0.85)',
                  transition: 'filter 0.22s ease',
                },
              }
            : {
                '& .react-flow__viewport': {
                  filter: 'none',
                  transition: 'filter 0.22s ease',
                },
              }
        }
        /* On the wrapper, not on <ReactFlow>: it does not forward stray DOM
           handlers, and the pane is the only target this acts on anyway. */
        onDoubleClick={handlePaneDoubleClick}
      >
        <ReactFlow
          className="c4-react-flow"
          /* Without this React Flow stamps `light` on its own container, and
             every Chakra semantic token used inside the canvas — toolbars,
             helpers, tooltips — resolves to the light palette on a dark board. */
          colorMode={mode}
          nodes={rfNodes}
          edges={preparedEdges}
          edgeTypes={edgeTypes}
          onConnect={editLocked ? undefined : onConnect}
          onNodesChange={handleNodesChange}
          onNodeDrag={!editLocked && onNodeDragLive ? handleNodeDrag : undefined}
          onNodeDragStop={editLocked ? undefined : handleNodeDragStop}
          nodeTypes={nodeTypes}
          onNodeDoubleClick={handleNodeDoubleClick}
          onNodeClick={onNodeClick ? handleNodeClick : undefined}
          onPaneClick={handlePaneClick}
          /* Double-click makes a block, so it cannot also zoom. React Flow's
             zoom is d3's, and d3 stops the event dead at the pane — with this
             on, nothing downstream ever sees a double-click. */
          zoomOnDoubleClick={false}
          onEdgeClick={handleEdgeClick}
          onPaneContextMenu={handlePaneContextMenu}
          onNodeContextMenu={
            overlayEditorOpen || !onNodeContextMenu ? undefined : handleNodeContextMenu
          }
          onEdgeContextMenu={
            overlayEditorOpen || !onEdgeContextMenu ? undefined : handleEdgeContextMenu
          }
          onSelectionChange={handleSelectionChange}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          /* `onlyRenderVisibleElements` belongs here on paper — it cut the DOM
             from 18 674 elements to 2 700 on a 400-block level. It is off
             because React Flow decides an edge is visible from its endpoints'
             *measured* dimensions, and a node that has never been rendered has
             none: edges to it are dropped until something brings it on screen,
             which reads as connections that come and go. Turning it back on
             needs node dimensions that do not depend on having been rendered. */
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={!editLocked}
          nodesConnectable={!editLocked}
          elementsSelectable={!canvasReadOnly}
          selectionOnDrag={!editLocked}
          multiSelectionKeyCode="Control"
          selectionMode={SelectionMode.Partial}
          selectionKeyCode={null}
          panOnDrag={[1, 2]}
          zoomOnScroll={false}
          zoomOnPinch={true}
          panOnScroll={true}
          panOnScrollMode={PanOnScrollMode.Free}
          panActivationKeyCode={overlayEditorOpen ? null : 'Space'}
          /* Delete is handled by hand below, not by React Flow. Its own key
             handler only stands down for <input>, <textarea> and
             contentEditable — and Monaco, which every contract editor is,
             types through a plain <div>. So Backspace inside a JSON body was
             reaching the canvas and asking whether to delete the element. */
          deleteKeyCode={null}
          onDelete={canDelete ? handleDeleteConfirmed : undefined}
          onBeforeDelete={canDelete ? handleBeforeDelete : undefined}
          isValidConnection={isValidConnection}
          onConnectEnd={handleConnectEnd}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={CANVAS_DOT_GAP}
            size={CANVAS_DOT_SIZE}
            color={chrome.canvasDot}
            bgColor={chrome.canvasBg}
          />
          <Panel position="bottom-left" style={{ margin: 12 }}>
            <HStack gap="8px" align="center">
              <CanvasZoomBar />
              {bottomLeft}
            </HStack>
          </Panel>
          {bottomRight ? (
            <Panel position="bottom-right" style={{ margin: 12 }}>
              {bottomRight}
            </Panel>
          ) : null}
          <ClearConnectionTracePanel />
        </ReactFlow>
        <LevelTransitionOverlay />
        <ConfirmDialog
          open={Boolean(pendingDelete)}
          title={t("confirm_delete")}
          content={pendingDeleteMessage}
          onCancel={cancelPendingDelete}
          onConfirm={allowPendingDelete}
          confirmText={t("delete")}
          cancelText={t("cancel")}
        />
      </Box>
    </CanvasMotionContext.Provider>
  );
};

export default React.memo(FlowCanvas);
