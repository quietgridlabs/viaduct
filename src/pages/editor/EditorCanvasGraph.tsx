import {
  useFlatActiveElements,
  useFlatC4Store,
  useFlatEdges,
  useFlatNodes,
  useFlatStore,
} from '@archivisio/c4-modelizer-sdk';
import type { ConnectionInfo } from '@archivisio/c4-modelizer-sdk';
import FlowCanvas from '@components/FlowCanvas';
import DuckHopOverlay from '@components/DuckHopOverlay';
import { trackProductEvent } from '@/metrics';
import { Box } from '@chakra-ui/react';
import NavBarSlot from '@slots/NavBarSlot';
import { useConnectionTrace } from '@contexts/ConnectionTraceContext';
import { useDialogs } from '@contexts/DialogContext';
import type { TableExtras } from '@/types/c4Extensions';
import { normalizeEdgePathType } from '@/types/c4Extensions';
import { canvasSafeTechColor, getTechnologyById } from '@data/technologies';
import { resolveCloneNodes } from '@utils/cloneSource';
import LevelHelper, { type HelperLevel } from '@components/LevelHelper';
import {
  getDataFlowPlayback,
  subscribeDataFlowPlayback,
} from '@plugins/data-flows/uiState';
import { useWorkspaceOverlayCoversCanvas } from '@hooks/useWorkspaceOverlayCoversCanvas';
import {
  buildConnectionTraceView,
  enrichConnectionInfo,
  findStoredConnection,
} from '@utils/connectionTrace';
import { getModelDataFlows, highlightForSteps, playbackHighlightSteps, stageAtStepIndex } from '@utils/dataFlows';
import { isDatabaseSchemaView } from '@utils/databaseTech';
import { isBrokerView } from '@utils/brokerTech';
import { useAddElementInView } from '@hooks/useAddElementInView';
import {
  flowMotionForEdge,
  isNeighborhoodEdge,
  resolveNeighborhood,
} from '@utils/neighborhoodHighlight';
import { reuseRfEdges, reuseRfNodes } from '@utils/reuseGraphItems';
import { findComponentConnection, fkEdgeLabel, getTableColumns } from '@utils/schemaModel';
import { closeFloatingSidePanels } from '@/navigation/closeFloatingSidePanels';
import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import type { DragLiveElement } from '@hooks/useYjsProject';
import type { Edge, Node } from '@xyflow/react';
import {
  memo,
  useCallback,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import {
  getDuckHopSnapshot,
  subscribeDuckHop,
} from '@/state/duckHopGame';

type Props = {
  /** Rendered beside the zoom bar — the version rail lives here. */
  bottomLeft?: React.ReactNode;
  viewOnly: boolean;
  collabEnabled: boolean;
  awareness: unknown;
  setLocalCursor: (cursor: { x: number; y: number } | null) => void;
  setLocalDragging: (elements: DragLiveElement[] | null) => void;
  pushLocalModel: (model: FlatC4Model) => void;
  followFocus: {
    x: number;
    y: number;
    requestId: number;
    viewKey: string;
  } | null;
  onFollowFocusApplied: () => void;
  focusNodeId: string | null;
  highlightNodeId: string | null;
  highlightEdge: {
    id?: string | null;
    source?: string | null;
    target?: string | null;
  } | null;
  onPaneClick?: () => void;
  onNodeContextMenu?: (event: React.MouseEvent, node: Node) => void;
  onEdgeContextMenu?: (event: React.MouseEvent, edge: Edge) => void;
  onClipboardNotice: (message: string) => void;
  onEditComponent: (id: string) => void;
  onEditSystem: (id: string) => void;
  onEditContainer: (id: string) => void;
  onEditCode: (id: string) => void;
  onSchemaFk: (info: { sourceId: string; targetId: string; edgeId: string }) => void;
  extraNodes?: Node[];
  /** Null outside project mode — Community always passes null. */
  threadProjectId: string | null;
  onThreadDeleteDenied?: () => void;
};

const noopConnect = () => {};
const noopPositionChange = () => {};

function EditorCanvasGraph({
  bottomLeft,
  viewOnly,
  collabEnabled,
  awareness,
  setLocalCursor: _setLocalCursor,
  setLocalDragging,
  pushLocalModel,
  followFocus,
  onFollowFocusApplied,
  focusNodeId,
  highlightNodeId,
  highlightEdge,
  onPaneClick,
  onNodeContextMenu,
  onEdgeContextMenu,
  onClipboardNotice,
  onEditComponent,
  onEditSystem,
  onEditContainer,
  onEditCode,
  onSchemaFk,
  extraNodes,
  threadProjectId: _threadProjectId,
  onThreadDeleteDenied: _onThreadDeleteDenied,
}: Props) {
  const { trace } = useConnectionTrace();
  const { activeSystem, activeContainer, activeComponent } = useFlatActiveElements();
  const { getBlockById } = useFlatStore();
  const { openConnectionDialog, closeEditDialog } = useDialogs();
  const model = useFlatC4Store((s) => s.model);
  const dataFlowPlayback = useSyncExternalStore(
    subscribeDataFlowPlayback,
    getDataFlowPlayback,
    () => null
  );

  const duckHop = useSyncExternalStore(subscribeDuckHop, getDuckHopSnapshot);
  const duckHopActive = duckHop.phase !== 'idle';
  const overlayCoversCanvas = useWorkspaceOverlayCoversCanvas();
  const interactionLocked = viewOnly || duckHopActive || overlayCoversCanvas;
  const duckFocusId =
    duckHopActive && duckHop.currentNodeId ? duckHop.currentNodeId : null;
  const effectiveFocusNodeId = duckFocusId ?? focusNodeId;
  const effectiveHighlightNodeId = duckFocusId ?? highlightNodeId;

  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);

  const flatNodeCallbacks = useMemo(
    () => ({
      onEditSystem,
      onEditContainer,
      onEditComponent,
      onEditCode,
    }),
    [onEditSystem, onEditContainer, onEditComponent, onEditCode]
  );
  const { currentNodes: storedNodes, handleNodePositionChange } = useFlatNodes(flatNodeCallbacks);

  /* Clone cards hold a snapshot of the block they were made from, so edits to
     the original never reached them. Resolve the pointer here, before group
     frames and the rest of the pipeline read the node data. Community: in-project
     clones only — no remote prefetch. */
  const currentNodes = useMemo(() => resolveCloneNodes(storedNodes, model), [storedNodes, model]);

  /* The helper explains the level you are looking at; anything unexpected
     falls back to the widest one. */
  const helperLevel: HelperLevel = (
    ['system', 'container', 'component', 'code'] as const
  ).includes(model.viewLevel as HelperLevel)
    ? (model.viewLevel as HelperLevel)
    : 'system';

  const getTechnologyColor = useCallback((technologyId?: string) => {
    return canvasSafeTechColor(getTechnologyById(technologyId || '')?.color);
  }, []);

  const handleConnectionDialogRequest = useCallback(
    (connectionInfo: ConnectionInfo) => {
      if (interactionLocked) return;
      const current = useFlatC4Store.getState().model;
      if (isDatabaseSchemaView(current)) {
        closeFloatingSidePanels();
        closeEditDialog();
        onSchemaFk({
          sourceId: connectionInfo.sourceId,
          targetId: connectionInfo.targetId,
          edgeId: connectionInfo.id || `${connectionInfo.sourceId}->${connectionInfo.targetId}`,
        });
        return;
      }
      openConnectionDialog(enrichConnectionInfo(current, connectionInfo));
    },
    [interactionLocked, openConnectionDialog, closeEditDialog, onSchemaFk]
  );

  const noopConnectionDialog = useCallback(() => {}, []);
  const flatEdgeCallbacks = useMemo(
    () => ({
      onConnectionDialog: interactionLocked ? noopConnectionDialog : handleConnectionDialogRequest,
      getTechnologyColor,
    }),
    [interactionLocked, noopConnectionDialog, handleConnectionDialogRequest, getTechnologyColor]
  );
  const { edges, onConnect } = useFlatEdges(flatEdgeCallbacks);

  /* Drawing an edge is the moment a diagram becomes an architecture rather
     than a pile of boxes, so it is worth its own metric — level only. */
  const onConnectTracked = useCallback(
    (params: Parameters<typeof onConnect>[0]) => {
      trackProductEvent('editor.connection_added', { level: model.viewLevel });
      onConnect(params);
    },
    [onConnect, model.viewLevel]
  );

  const schemaMode = isDatabaseSchemaView(model);

  /*
   * Double-click on empty board puts a block there.
   *
   * Not on the schema or broker views: what belongs on those is a table or a
   * channel, and a plain element among them is a thing with no meaning at that
   * level. The Add menu makes the same distinction.
   */
  const { addElementInView } = useAddElementInView();
  const canAddByDoubleClick = !interactionLocked && !schemaMode && !isBrokerView(model);
  const handlePaneDoubleClick = useCallback(
    (position: { x: number; y: number }) => {
      addElementInView({ position });
    },
    [addElementInView]
  );
  const isTraceComponentView = Boolean(
    trace &&
      model.viewLevel === 'component' &&
      model.activeContainerId === trace.focusContainerId
  );

  const playbackHighlight = useMemo(() => {
    if (!dataFlowPlayback) return null;
    const flow = getModelDataFlows(model).find((item) => item.id === dataFlowPlayback.flowId);
    if (!flow) return null;
    // "Show all" lights up everything the flow touches on this level at once;
    // otherwise only the hop being played.
    if (dataFlowPlayback.showAll) return highlightForSteps(model, flow.steps);
    const stage = stageAtStepIndex(flow.steps, dataFlowPlayback.stepIndex)?.stage;
    if (!stage) return null;
    return highlightForSteps(
      model,
      playbackHighlightSteps(stage, dataFlowPlayback.branchStepId)
    );
  }, [dataFlowPlayback, model]);

  const playbackFocusNodeIds = useMemo(
    () => (playbackHighlight ? [...playbackHighlight.nodeIds] : null),
    [playbackHighlight]
  );

  const neighborhood = useMemo(() => {
    if (playbackHighlight) return playbackHighlight;
    if (!focusNodeId || isTraceComponentView) return null;
    return resolveNeighborhood(model, focusNodeId);
  }, [playbackHighlight, focusNodeId, isTraceComponentView, model]);

  const traceView = useMemo(() => {
    if (!isTraceComponentView || !trace) return null;
    return buildConnectionTraceView({
      model,
      trace,
      onEditComponent,
      getTechnologyColor,
    });
  }, [isTraceComponentView, trace, model, onEditComponent, getTechnologyColor]);

  const displayNodes = useMemo(() => {
    let nodes = currentNodes;
    if (traceView?.nodes) {
      nodes = traceView.nodes;
    } else if (schemaMode) {
      nodes = currentNodes.map((n) => ({
        ...n,
        type: 'table',
        data: {
          ...n.data,
          columns: getTableColumns(n.data as TableExtras),
        },
      }));
    }

    if (neighborhood && neighborhood.nodeIds.size > 0) {
      nodes = nodes.map((n) => {
        const hit = neighborhood.nodeIds.has(n.id);
        const data = n.data as { traceHighlight?: boolean; traceDimmed?: boolean };
        if (Boolean(data.traceHighlight) === hit && Boolean(data.traceDimmed) === !hit) {
          return n;
        }
        return {
          ...n,
          data: {
            ...n.data,
            traceHighlight: hit,
            traceDimmed: !hit,
          },
        };
      });
    }

    const withExtras = extraNodes && extraNodes.length > 0 ? [...nodes, ...extraNodes] : nodes;
    const reused = reuseRfNodes(nodesRef.current, withExtras);
    nodesRef.current = reused;
    return reused;
  }, [traceView, schemaMode, currentNodes, neighborhood, extraNodes]);

  const displayEdges: Edge[] = useMemo(() => {
    let next = edges;
    if (traceView?.edges) {
      next = traceView.edges;
    } else if (schemaMode) {
      next = edges.map((edge) => {
        const stored = findComponentConnection(model, edge.source, edge.target);
        const fk = stored?.foreignKey;
        const label = fkEdgeLabel(model, edge.source, edge.target, fk) || edge.label;
        return {
          ...edge,
          label,
          type: label ? 'technology' : edge.type,
          data: {
            ...edge.data,
            foreignKey: fk,
          },
        };
      });
    }

    next = next.map((edge) => {
      const stored = findStoredConnection(model, edge.source, edge.target);
      const pathType = normalizeEdgePathType(
        stored?.pathType ?? (edge.data as { pathType?: string } | undefined)?.pathType
      );
      if ((edge.data as { pathType?: string } | undefined)?.pathType === pathType) {
        return edge;
      }
      return {
        ...edge,
        data: {
          ...edge.data,
          pathType,
        },
      };
    });

    if (neighborhood && neighborhood.nodeIds.size > 0) {
      next = next.map((edge) => {
        const hit = isNeighborhoodEdge(neighborhood, edge.source, edge.target);
        const motion = playbackHighlight
          ? flowMotionForEdge(neighborhood, edge.source, edge.target)
          : undefined;
        const data = edge.data as {
          traceHighlight?: boolean;
          traceDimmed?: boolean;
          flowMotion?: 'forward' | 'reverse';
          bidirectional?: boolean;
        };
        if (
          Boolean(data.traceHighlight) === hit &&
          Boolean(data.traceDimmed) === !hit &&
          data.flowMotion === motion
        ) {
          return edge;
        }
        return {
          ...edge,
          style: {
            ...edge.style,
            opacity: hit ? 1 : 0.18,
            strokeWidth: hit ? 2.5 : 1,
          },
          data: {
            ...edge.data,
            traceHighlight: hit,
            traceDimmed: !hit,
            flowMotion: motion,
          },
        };
      });
    }

    const reused = reuseRfEdges(edgesRef.current, next);
    edgesRef.current = reused;
    return reused;
  }, [traceView, schemaMode, edges, model, neighborhood, playbackHighlight]);

  const presenceView = useMemo(() => {
    if (!collabEnabled) return undefined;
    return {
      viewLevel: model.viewLevel,
      activeSystemId: model.activeSystemId,
      activeContainerId: model.activeContainerId,
      activeComponentId: model.activeComponentId,
    };
  }, [
    collabEnabled,
    model.viewLevel,
    model.activeSystemId,
    model.activeContainerId,
    model.activeComponentId,
  ]);

  const handleNodeDragLive = useCallback(
    (elements: { id: string; position: { x: number; y: number } }[]) => {
      if (!collabEnabled || interactionLocked) return;
      setLocalDragging(
        elements.map((el) => ({
          elementId: el.id,
          x: el.position.x,
          y: el.position.y,
        }))
      );
    },
    [collabEnabled, interactionLocked, setLocalDragging]
  );

  const handleNodeDragLiveEnd = useCallback(() => {
    if (!collabEnabled) return;
    pushLocalModel(useFlatC4Store.getState().model);
    setLocalDragging(null);
  }, [collabEnabled, pushLocalModel, setLocalDragging]);

  const handleNodeClick = useCallback(
    (nodeId: string, node?: Node) => {
      if (node?.type === 'thread') return;
      const original = (node?.data as { original?: { id?: string } } | undefined)?.original;
      /* Clones are projections — edit belongs on the original, not here. */
      if (original?.id) return;

      const block = getBlockById(nodeId);
      if (!block) return;

      closeFloatingSidePanels();

      if (block.type === 'system') {
        onEditSystem(nodeId);
        return;
      }
      if (block.type === 'container') {
        onEditContainer(nodeId);
        return;
      }
      if (block.type === 'code') {
        onEditCode(nodeId);
        return;
      }
      onEditComponent(nodeId);
    },
    [getBlockById, onEditSystem, onEditContainer, onEditComponent, onEditCode]
  );

  /* Drill-down is only via the magnifier — double-click used to dive a level. */
  const handleNodeDoubleClick = useCallback((_nodeId: string, _node?: Node) => {}, []);

  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      if (interactionLocked) return;
      handleConnectionDialogRequest({
        id: edge.id,
        sourceId: edge.source,
        targetId: edge.target,
      });
    },
    [interactionLocked, handleConnectionDialogRequest]
  );

  return (
    <Box position="relative" flex="1" minH={0} w="100%" overflow="hidden">
      <NavBarSlot
        systemName={activeSystem?.name}
        containerName={activeContainer?.name}
        componentName={activeComponent?.name}
      />
      <FlowCanvas
        bottomRight={<LevelHelper level={helperLevel} />}
        bottomLeft={bottomLeft}
        nodes={displayNodes}
        edges={displayEdges}
        onConnect={interactionLocked ? noopConnect : onConnectTracked}
        onNodePositionChange={
          interactionLocked ? noopPositionChange : handleNodePositionChange
        }
        onNodeDragLive={collabEnabled && !interactionLocked ? handleNodeDragLive : undefined}
        onNodeDragLiveEnd={collabEnabled && !interactionLocked ? handleNodeDragLiveEnd : undefined}
        awareness={collabEnabled ? awareness : null}
        localView={presenceView}
        viewLevel={model.viewLevel}
        viewKey={[
          model.viewLevel,
          model.activeSystemId || '',
          model.activeContainerId || '',
          model.activeComponentId || '',
          trace ? `trace:${trace.sourceId}->${trace.targetId}` : '',
        ].join(':')}
        onNodeClick={duckHopActive ? undefined : handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onEdgeClick={duckHopActive ? undefined : handleEdgeClick}
        onPaneClick={onPaneClick}
        onPaneDoubleClick={canAddByDoubleClick ? handlePaneDoubleClick : undefined}
        onNodeContextMenu={
          duckHopActive || overlayCoversCanvas ? undefined : onNodeContextMenu
        }
        onEdgeContextMenu={
          duckHopActive || overlayCoversCanvas ? undefined : onEdgeContextMenu
        }
        followFocus={followFocus}
        onFollowFocusApplied={onFollowFocusApplied}
        focusNodeId={playbackHighlight ? null : effectiveFocusNodeId}
        focusNodeIds={playbackFocusNodeIds}
        viewOnly={viewOnly}
        canPaste={!interactionLocked}
        canDelete={!interactionLocked}
        onClipboardNotice={onClipboardNotice}
        highlightNodeId={effectiveHighlightNodeId}
        highlightEdge={highlightEdge}
      />
      <DuckHopOverlay />
    </Box>
  );
}

export default memo(EditorCanvasGraph);
