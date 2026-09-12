import { MAGIC_FLOW_FG } from '@components/data-flow/MagicFlowMark';
import { getTechnologyById } from '@data/technologies';
import { readableAccent, withAlpha } from '@theme/canvasSurfaces';
import { DIFF_COLORS, type DiffStatus } from '@theme/diffColors';
import { useCanvasPrefs } from '@/state/canvasPrefs';
import { useColorMode } from '@contexts/ColorModeContext';
import { normalizeEdgePathType } from '@/types/c4Extensions';
import {
  BaseEdge,
  EdgeLabelRenderer,
  useStore,
  type EdgeProps,
  type ReactFlowState,
} from '@xyflow/react';
import { CanvasMotionContext } from '@contexts/CanvasMotionContext';
import React, { useCallback, useContext, useMemo } from 'react';
import {
  ANCHOR_TRUST_PX,
  ARROW,
  ARROW_SELECTED,
  EDGE_LABEL_CONTAINER_STYLE,
  SOCKET_CORE_INK,
  SOCKET_CORE_R,
  SOCKET_R,
} from './constants';
import {
  buildEdgePath,
  createEdgeStyle,
  measureSvgPath,
  pointAlongSvgPath,
  selectZoomedOut,
  type PathEnd,
} from './helpers';

const TechnologyEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  selected,
  ...props
}) => {
  const { mode, chrome } = useColorMode();
  const isBidirectional = props.data?.bidirectional === true;
  const pathType = normalizeEdgePathType(props.data?.pathType);

  const { path: edgePath, labelX, labelY } = buildEdgePath(pathType, {
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const technology = (() => {
    const techId =
      (props.data?.technologyId as string | undefined) ||
      (props.data?.technology as string | undefined);
    return techId ? getTechnologyById(techId) : undefined;
  })();

  const labelPosition =
    typeof props.data?.labelPosition === 'number' ? props.data.labelPosition : 50;
  const t = Math.max(0, Math.min(1, labelPosition / 100));
  const along = pointAlongSvgPath(edgePath, t);
  const zoomedOut = useStore(selectZoomedOut);
  const labelAtX = along?.x ?? labelX;
  const labelAtY = along?.y ?? labelY;

  const dimmed = props.data?.traceDimmed === true;
  const highlighted = props.data?.traceHighlight === true;
  /*
   * A comparison colour outranks the technology one, for the same reason it
   * does on a card: the whole point of the view is that one signal, and a
   * connection painted Kafka-red while it is the thing that changed says the
   * wrong word louder.
   */
  const diffStatus =
    props.data?.diffStatus === 'added' ||
    props.data?.diffStatus === 'changed' ||
    props.data?.diffStatus === 'gone'
      ? (props.data.diffStatus as DiffStatus)
      : undefined;
  const flowMotion =
    props.data?.flowMotion === 'forward' || props.data?.flowMotion === 'reverse'
      ? props.data.flowMotion
      : undefined;
  const motionEnabled = useContext(CanvasMotionContext);
  const plainEdges = useCanvasPrefs().edgeColors === 'neutral';
  const edgeStyle = createEdgeStyle(style, isBidirectional, technology, mode, plainEdges);
  const diffStroke = diffStatus ? DIFF_COLORS[mode][diffStatus] : undefined;
  const stroke =
    diffStroke ??
    (flowMotion ? MAGIC_FLOW_FG : (edgeStyle.stroke as string | undefined) || '#1f75cb');
  const active = Boolean(selected || highlighted || flowMotion || diffStatus);
  /*
   * Heads at the ends of the line, and the line cut back to meet them.
   *
   * Without the cut the stroke ran on underneath the head and out the other
   * side: at the tip it showed as a spike, and through a hollow back as a slot.
   * `stroke-dasharray` trims the drawn stretch without touching the geometry,
   * so the label position and the click target stay where they were.
   */
  /* Where the two ends actually plug in.
     Not `sourceX/sourceY`: React Flow reports those on the handle's outer face,
     which measures 4 units short of the card's border — the gap an arrowhead
     placed there leaves between itself and the card. The handle's own bounds
     put its centre on the border to within a hundredth of a unit, so both the
     heads and the selection disc are anchored from there. */
  const socketKey = useStore(
    useCallback(
      (state: ReactFlowState) => {
        const centre = (
          nodeId: string,
          handleId: string | null | undefined,
          type: 'source' | 'target'
        ) => {
          const node = state.nodeLookup.get(nodeId);
          const bounds = node?.internals.handleBounds?.[type];
          if (!node || !bounds?.length) return null;
          const handle = bounds.find((h) => h.id === handleId) ?? bounds[0];
          return [
            node.internals.positionAbsolute.x + handle.x + handle.width / 2,
            node.internals.positionAbsolute.y + handle.y + handle.height / 2,
          ];
        };
        const from = centre(props.source, props.sourceHandleId, 'source');
        const to = centre(props.target, props.targetHandleId, 'target');
        /* A string, because a fresh array from a store selector re-renders every
           edge on every store tick. */
        return from && to ? `${from[0]},${from[1]},${to[0]},${to[1]}` : '';
      },
      [props.source, props.sourceHandleId, props.target, props.targetHandleId]
    )
  );

  const anchors = useMemo(() => {
    if (!socketKey) return null;
    const [ax, ay, bx, by] = socketKey.split(',').map(Number);
    return { source: { x: ax, y: ay }, target: { x: bx, y: by } };
  }, [socketKey]);

  const arrowheads = useMemo(() => {
    const geometry = measureSvgPath(edgePath);
    if (!geometry) return null;
    const size = selected ? ARROW_SELECTED : ARROW;
    /* The tip goes on the border; the line is then trimmed back to whatever is
       left of the head behind it. A wild lookup would drag the head off the
       line entirely, so an anchor is only trusted while it is near the end it
       belongs to. */
    const head = (end: PathEnd, anchor: { x: number; y: number } | undefined) => {
      const reach = anchor ? Math.hypot(anchor.x - end.x, anchor.y - end.y) : Infinity;
      if (!anchor || reach > ANCHOR_TRUST_PX) return { ...end, cut: size.length };
      return {
        x: anchor.x,
        y: anchor.y,
        angle: end.angle,
        cut: Math.max(0, size.length - reach),
      };
    };
    const target = head(geometry.end, anchors?.target);
    const source = isBidirectional ? head(geometry.start, anchors?.source) : null;
    const endCut = Math.min(target.cut, geometry.length / 3);
    const startCut = Math.min(source?.cut ?? 0, geometry.length / 3);
    return {
      target,
      source,
      points: `0,0 ${-size.length},${size.half} ${-size.length},${-size.half}`,
      dash: `0 ${startCut} ${Math.max(0, geometry.length - startCut - endCut)} ${endCut}`,
    };
  }, [anchors, edgePath, isBidirectional, selected]);

  const paintedStyle = useMemo<React.CSSProperties>(() => {
    const next: React.CSSProperties = {
      ...edgeStyle,
      stroke,
      /* A picked connection is the answer to a question the reader just asked,
         so it outweighs a merely traced one. */
      strokeWidth: selected ? 3.4 : active ? 2.4 : dimmed ? 1 : edgeStyle.strokeWidth || 1.5,
      strokeLinecap: 'round',
      opacity: diffStatus === 'gone' ? 0.55 : dimmed && !active ? 0.22 : 1,
      cursor: 'pointer',
      // Filters + CSS stroke-dashoffset force main-thread SVG invalidation
      // under overlay backdrop-filter (one-frame canvas flash).
      filter: 'none',
      animation: 'none',
    };
    /* Gone: drawn, but drawn as absent — the same dashed ghost a removed card
       gets, so the two read as one state. */
    if (diffStatus === 'gone') {
      next.strokeDasharray = '6 6';
      return next;
    }
    if (flowMotion) {
      next.strokeDasharray = '10 14';
    } else if (arrowheads) {
      next.strokeDasharray = arrowheads.dash;
    }
    return next;
  }, [active, arrowheads, diffStatus, dimmed, edgeStyle, flowMotion, selected, stroke]);

  /* Only the end an arrowhead does not claim. The head is already the mark for
     "the connection arrives here"; a disc under it makes two marks for one
     end, and on a two-way connection both ends are spoken for. */
  const sockets = useMemo(() => {
    if (!anchors || !selected || dimmed || isBidirectional) return null;
    return [anchors.source];
  }, [anchors, selected, dimmed, isBidirectional]);

  const inkOpacity = dimmed && !active ? 0.22 : 1;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={paintedStyle}
        // Thin lines are hard to hit; widen the invisible click target.
        interactionWidth={26}
      />
      {flowMotion && motionEnabled ? (
        <>
          <circle r="4.5" fill={MAGIC_FLOW_FG} className="c4-magic-flow-dot">
            <animateMotion
              dur="1.15s"
              repeatCount="indefinite"
              rotate="auto"
              keyPoints={flowMotion === 'reverse' ? '1;0' : '0;1'}
              keyTimes="0;1"
              calcMode="linear"
              path={edgePath}
            />
          </circle>
          <circle r="3" fill="#ede9fe" className="c4-magic-flow-dot">
            <animateMotion
              dur="1.15s"
              begin="-0.55s"
              repeatCount="indefinite"
              rotate="auto"
              keyPoints={flowMotion === 'reverse' ? '1;0' : '0;1'}
              keyTimes="0;1"
              calcMode="linear"
              path={edgePath}
            />
          </circle>
        </>
      ) : null}
      {arrowheads
        ? [arrowheads.target, arrowheads.source].map((head, index) =>
            head ? (
              <polygon
                key={index}
                points={arrowheads.points}
                fill={stroke}
                opacity={inkOpacity}
                transform={`translate(${head.x} ${head.y}) rotate(${head.angle})`}
                pointerEvents="none"
              />
            ) : null
          )
        : null}
      {sockets
        ? sockets.map((socket, index) => (
            <g key={index} pointerEvents="none">
              <circle cx={socket.x} cy={socket.y} r={SOCKET_R} fill={stroke} />
              <circle cx={socket.x} cy={socket.y} r={SOCKET_CORE_R} fill={SOCKET_CORE_INK} />
            </g>
          ))
        : null}
      {props.label && !zoomedOut ? (
        <EdgeLabelRenderer>
          <div
            style={{
              ...EDGE_LABEL_CONTAINER_STYLE,
              transform: `translate(-50%, -50%) translate(${labelAtX}px,${labelAtY}px)`,
              opacity: dimmed && !active ? 0.2 : 1,
              filter: highlighted || selected ? undefined : dimmed ? 'grayscale(0.4)' : undefined,
            }}
            className="nodrag nopan"
          >
            <span
              style={{
                /* Slightly see-through: a label sits on top of the line it
                 describes, and an opaque plate cuts the line in half. */
                background: withAlpha(chrome.dialogBg, 0.82),
                backdropFilter: 'blur(2px)',
                borderRadius: 6,
                padding: '2px 8px',
                fontSize: 12,
                fontWeight: 500,
                color:
                  technology && !plainEdges
                    ? readableAccent(technology.color, mode, 4.5)
                    : chrome.nodeText,
                boxShadow: chrome.shadowSm,
                whiteSpace: 'normal',
                wordBreak: 'break-word',
                textAlign: 'center',
                maxWidth: 200,
                lineHeight: 1.25,
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                border: `1px solid ${active ? stroke : chrome.border}`,
                cursor: 'pointer',
              }}
            >
              {props.label}
            </span>
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
};

export default React.memo(TechnologyEdge);
