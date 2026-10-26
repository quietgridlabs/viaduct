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
  resolveNeighborhoodIn,
} from '@utils/neighborhoodHighlight';
import { buildServiceGraph, type ServiceGraph } from '@utils/buildServiceGraph';
import {
  fitFlowView,
  getFlowViewport,
  setFlowViewport,
  type FlowViewport,
} from '@utils/flowViewport';
import {
  isServiceGraphActive,
  setServiceGraphBuilding,
  subscribeServiceGraph,
} from '@/state/serviceGraph';
import { reuseRfEdges, reuseRfNodes } from '@utils/reuseGraphItems';
import { findComponentConnection, fkEdgeLabel, getTableColumns } from '@utils/schemaModel';
import { closeFloatingSidePanels } from '@/navigation/closeFloatingSidePanels';
import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import type { DragLiveElement } from '@hooks/useYjsProject';
import type { Edge, Node } from '@xyflow/react';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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

  /*
   * The service graph replaces the level diagram wholesale: one orb per system
   * or container, one line per connection drawn between them. It is swapped in
   * at the very end, over `displayNodes` / `displayEdges`, so everything the
   * level view computes on the way down — trace, schema mode, neighbourhood,
   * ghosts — is simply not asked for while it is up.
   */
  const serviceGraphActive = useSyncExternalStore(
    subscribeServiceGraph,
    isServiceGraphActive,
    () => false
  );
  /*
   * Built off to one side, because the layout is asynchronous.
   *
   * ELK does the placing (see layoutServiceGraph: the model is a compound
   * digraph, and laying one out means layered drawing that respects
   * containment), and it is both a promise and a 1.5MB import fetched the
   * first time the graph is opened. So the canvas keeps showing the level
   * diagram until the answer arrives rather than blanking in the meantime.
   *
   * `token` is what keeps a slow build from landing after a newer one: each
   * run claims the latest number and only writes if it still holds it, so
   * toggling the graph or editing the model mid-layout cannot leave the
   * previous answer on screen.
   */
  const [serviceGraph, setServiceGraph] = useState<ServiceGraph | null>(null);
  const graphToken = useRef(0);
  /*
   * The diagram's own viewport, held for as long as the graph covers it.
   *
   * The two pictures have nothing to do with each other's coordinates, so
   * whichever one arrives has to say where to look. The graph gets framed;
   * the diagram gets put back exactly where it was, which is better than
   * framing it too — somebody who was reading one corner of a large model is
   * returned to that corner rather than to the whole of it.
   */
  const diagramViewport = useRef<FlowViewport | null>(null);
  const graphWasOpen = useRef(false);
  const fitOnArrival = useRef(false);
  useEffect(() => {
    const token = ++graphToken.current;
    if (!serviceGraphActive) {
      setServiceGraph(null);
      setServiceGraphBuilding(false);
      /* Only on the way back, never on an ordinary edit: this effect also
         runs whenever the model changes, and re-aiming the canvas under
         somebody who is editing it would be its own bug. */
      if (graphWasOpen.current) {
        graphWasOpen.current = false;
        fitOnArrival.current = false;
        const saved = diagramViewport.current;
        diagramViewport.current = null;
        requestAnimationFrame(() => {
          if (saved) setFlowViewport(saved);
          else fitFlowView();
        });
      }
      return;
    }
    if (!graphWasOpen.current) {
      graphWasOpen.current = true;
      diagramViewport.current = getFlowViewport();
      /* Frame the graph when it opens, and only then. This effect also runs
         on every model change, and re-framing under somebody who has panned
         the graph and is now editing would throw their place away. */
      fitOnArrival.current = true;
    }
    setServiceGraphBuilding(true);
    void buildServiceGraph(model)
      .then((built) => {
        if (graphToken.current !== token) return;
        setServiceGraph(built);
        setServiceGraphBuilding(false);
        /*
         * Frame it once it exists. Its coordinates come from ELK and have
         * nothing to do with where the diagram was, so without this the graph
         * is drawn somewhere off the side of the canvas and has to be hunted
         * for. The frame has to wait for the nodes to mount, hence the frame
         * after this one.
         */
        if (fitOnArrival.current) {
          fitOnArrival.current = false;
          requestAnimationFrame(() => fitFlowView());
        }
      })
      .catch(() => {
        /* A layout that cannot be computed leaves the diagram alone rather
           than an empty canvas with no way back. */
        if (graphToken.current !== token) return;
        setServiceGraph(null);
        setServiceGraphBuilding(false);
      });
  }, [serviceGraphActive, model]);
  const duckFocusId =
    duckHopActive && duckHop.currentNodeId ? duckHop.currentNodeId : null;
  const effectiveFocusNodeId = duckFocusId ?? focusNodeId;
  const effectiveHighlightNodeId = duckFocusId ?? highlightNodeId;

  /*
   * Where the graph has been dragged to, for this sitting only.
   *
   * The graph's positions come from ELK, and a drag must not reach the model
   * — it would move cards on a level diagram nobody is looking at. But it has
   * to reach something: React Flow asks the owner of the nodes for the new
   * position, and when the answer is "nothing happened" the orb springs back,
   * the frame drawn round it never follows, and a service dragged out of its
   * system simply returns. Held here instead, and dropped when the graph
   * closes: a rearranged graph is a way of looking at the model for a moment,
   * not a thing to save.
   */
  const [graphMoves, setGraphMoves] = useState<Record<string, { x: number; y: number }>>({});
  useEffect(() => {
    if (!serviceGraphActive) setGraphMoves({});
  }, [serviceGraphActive]);
  const handleGraphMove = useCallback((id: string, position: { x: number; y: number }) => {
    setGraphMoves((moves) => ({ ...moves, [id]: position }));
  }, []);

  /*
   * "Highlight connections" over the graph.
   *
   * The menu item does one thing — it names a focus element — and the level
   * view answers by lighting that element's hop and dimming the rest. The
   * graph is a different picture of the same model, so it owes the same
   * answer; it just has to work it out over its own pool, since a system and
   * a container are neighbours here and are never on one level.
   *
   * Written against the already-built graph rather than folded into
   * `buildServiceGraph`, so changing the focus re-tints what is on screen
   * instead of laying the whole thing out again.
   */
  const serviceGraphView = useMemo(() => {
    if (!serviceGraph) return null;

    const moved =
      Object.keys(graphMoves).length === 0
        ? serviceGraph
        : {
            ...serviceGraph,
            nodes: serviceGraph.nodes.map((node) =>
              graphMoves[node.id] ? { ...node, position: graphMoves[node.id] } : node
            ),
          };

    if (!effectiveFocusNodeId) return moved;

    const hop = resolveNeighborhoodIn(moved.services, effectiveFocusNodeId);
    if (!hop.nodeIds.size) return moved;

    return {
      ...moved,
      nodes: moved.nodes.map((node) => {
        const hit = hop.nodeIds.has(node.id);
        return { ...node, data: { ...node.data, traceHighlight: hit, traceDimmed: !hit } };
      }),
      edges: moved.edges.map((edge) => {
        const hit = hop.edgeIds.has(`${edge.source}->${edge.target}`)
          || hop.edgeIds.has(`${edge.target}->${edge.source}`);
        /* The same two numbers the level view uses for a dimmed and a lit
           connection — a highlight should not read differently depending on
           which picture you are looking at. */
        return {
          ...edge,
          style: { ...edge.style, opacity: hit ? 1 : 0.18, strokeWidth: hit ? 2.5 : 1 },
          data: { ...edge.data, traceHighlight: hit, traceDimmed: !hit },
        };
      }),
    };
  }, [serviceGraph, effectiveFocusNodeId, graphMoves]);

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
        nodes={serviceGraphView ? serviceGraphView.nodes : displayNodes}
        edges={serviceGraphView ? serviceGraphView.edges : displayEdges}
        /* Nothing in the graph writes back. Its positions are computed, so a
           drag that persisted would move cards on a level diagram the person
           is not looking at, and a connection drawn here has no level to
           belong to. */
        onConnect={interactionLocked || serviceGraph ? noopConnect : onConnectTracked}
        /* A drag in the graph goes to the sitting, not to the model — see
           `graphMoves`. Without it the frames cannot follow. */
        onNodePositionChange={
          interactionLocked
            ? noopPositionChange
            : serviceGraph
              ? handleGraphMove
              : handleNodePositionChange
        }
        onNodeDragLive={collabEnabled && !interactionLocked ? handleNodeDragLive : undefined}
        onNodeDragLiveEnd={collabEnabled && !interactionLocked ? handleNodeDragLiveEnd : undefined}
        onArranged={
          collabEnabled && !interactionLocked
            ? () => pushLocalModel(useFlatC4Store.getState().model)
            : undefined
        }
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
