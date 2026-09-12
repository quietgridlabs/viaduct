import { useColorMode } from '@contexts/ColorModeContext';
import { canvasPanelColor } from '@theme/canvasSurfaces';
import { type NodeProps } from '@xyflow/react';
import { useSequenceEditorStore } from '../state/sequence-editor-store';

export type NoteNodeData = {
  noteId: string;
  text: string;
  position: 'left' | 'right' | 'over';
  width: number;
  height: number;
};

export default function NoteNode({ data }: NodeProps) {
  const { chrome, mode } = useColorMode();
  const d = data as NoteNodeData;
  const selected = useSequenceEditorStore(
    (s) => s.selection?.kind === 'item' && s.selection.id === d.noteId
  );
  return (
    <div
      className="nopan nodrag"
      style={{
        width: d.width,
        minHeight: d.height,
        boxSizing: 'border-box',
        padding: '8px 10px',
        borderRadius: 6,
        border: `${selected ? 3 : 1.5}px solid ${chrome.borderStrong}`,
        background: canvasPanelColor(mode),
        color: chrome.nodeText,
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1.35,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        boxShadow: selected ? `0 0 0 1px ${chrome.borderStrong}` : undefined,
        cursor: 'pointer',
        pointerEvents: 'all',
      }}
      title={d.text}
    >
      {d.text || 'note'}
    </div>
  );
}
