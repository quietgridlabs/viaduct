import { useColorMode } from '@contexts/ColorModeContext';
import { type NodeProps } from '@xyflow/react';
import { useSequenceEditorStore } from '../state/sequence-editor-store';

export type DividerNodeData = {
  dividerId: string;
  text: string;
  width: number;
  kind: 'divider' | 'delay' | 'branch';
};

export default function DividerNode({ data }: NodeProps) {
  const { chrome } = useColorMode();
  const d = data as DividerNodeData;
  const selected = useSequenceEditorStore(
    (s) => s.selection?.kind === 'item' && s.selection.id === d.dividerId
  );
  const isDelay = d.kind === 'delay';
  const isBranch = d.kind === 'branch';
  const lineW = selected ? 2.5 : 1.5;
  return (
    <div
      className="nopan nodrag"
      style={{
        width: d.width,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        pointerEvents: isBranch ? 'none' : 'all',
        cursor: isBranch ? 'default' : 'pointer',
        background: selected ? `${chrome.borderStrong}14` : 'transparent',
        borderRadius: 6,
        outline: selected ? `${lineW}px solid ${chrome.borderStrong}` : undefined,
        outlineOffset: 2,
      }}
      title={d.text}
    >
      <div
        style={{
          flex: 1,
          height: 0,
          borderTop: isDelay || isBranch
            ? `${lineW}px dotted ${chrome.borderStrong}`
            : `${lineW}px solid ${chrome.borderStrong}`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          flexShrink: 0,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: isDelay || isBranch ? 'none' : 'uppercase',
          color: chrome.textMuted,
          maxWidth: '50%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}
      >
        {d.text || (isDelay ? '…' : isBranch ? 'else' : '—')}
      </div>
      <div
        style={{
          flex: 1,
          height: 0,
          borderTop: isDelay || isBranch
            ? `${lineW}px dotted ${chrome.borderStrong}`
            : `${lineW}px solid ${chrome.borderStrong}`,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
