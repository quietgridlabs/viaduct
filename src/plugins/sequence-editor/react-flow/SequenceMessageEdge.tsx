import { useColorMode } from '@contexts/ColorModeContext';
import { canvasPanelColor } from '@theme/canvasSurfaces';
import { BaseEdge, EdgeLabelRenderer, type EdgeProps } from '@xyflow/react';
import { DEFAULT_LAYOUT, laneX } from '../layout/sequence-layout';
import { useSequenceEditorStore } from '../state/sequence-editor-store';

type MessageData = {
  text: string;
  arrow: string;
  itemId: string;
  eventIndex: number;
  y?: number;
  fromOrder?: number;
  toOrder?: number;
  isReturn?: boolean;
};

function markerId(arrow: string, id: string): string {
  if (arrow.includes('x')) return `seq-x-${id}`;
  if (arrow.includes('>>')) return `seq-open-${id}`;
  return `seq-filled-${id}`;
}

export default function SequenceMessageEdge({ id, data }: EdgeProps) {
  const { chrome, c4Colors, mode } = useColorMode();
  const d = (data || {}) as MessageData;
  const selected = useSequenceEditorStore(
    (s) => s.selection?.kind === 'item' && s.selection.id === d.itemId
  );
  const y = d.y ?? 160;
  const fromX = laneX(d.fromOrder ?? 0, DEFAULT_LAYOUT);
  const toX = laneX(d.toOrder ?? 0, DEFAULT_LAYOUT);
  const dashed = d.arrow.startsWith('--');
  const midX = (fromX + toX) / 2;
  const mid = markerId(d.arrow, id);
  const color = selected ? c4Colors.connection.border : chrome.edgeStroke;
  const labelColor = selected ? c4Colors.connection.hover : chrome.nodeText;

  return (
    <>
      <defs>
        <marker
          id={`seq-filled-${id}`}
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L9,3 L0,6 Z" fill={color} />
        </marker>
        <marker
          id={`seq-open-${id}`}
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L9,3 L0,6" fill="none" stroke={color} strokeWidth="1.5" />
        </marker>
        <marker
          id={`seq-x-${id}`}
          markerWidth="10"
          markerHeight="10"
          refX="8"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L8,8 M0,8 L8,0" stroke={color} strokeWidth="1.5" />
        </marker>
      </defs>
      <BaseEdge
        id={id}
        path={`M ${fromX} ${y} L ${toX} ${y}`}
        style={{
          stroke: color,
          strokeWidth: selected ? 3 : 1.5,
          strokeDasharray: dashed ? '6 4' : undefined,
        }}
        markerEnd={`url(#${mid})`}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -100%) translate(${midX}px, ${y - 4}px)`,
            fontSize: 12,
            fontWeight: selected ? 700 : 600,
            pointerEvents: 'all',
            background: canvasPanelColor(mode),
            padding: '0 4px',
            color: labelColor,
            borderRadius: 4,
            boxShadow: selected ? `0 0 0 2px ${c4Colors.connection.border}` : undefined,
          }}
          className="nodrag nopan"
          title={d.isReturn ? `↩ ${d.text || 'return'}` : d.text || undefined}
        >
          {d.isReturn ? `↩ ${d.text || 'return'}` : d.text || '—'}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
