import { useColorMode } from '@contexts/ColorModeContext';
import { type NodeProps } from '@xyflow/react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ExpandNodeData } from './projection';
import { useSequenceEditorStore } from '../state/sequence-editor-store';

export default function ExpandFrameNode({ data }: NodeProps) {
  const { chrome } = useColorMode();
  const d = data as ExpandNodeData;
  const toggleExpandCollapsed = useSequenceEditorStore((s) => s.toggleExpandCollapsed);
  /* A preview owns its own collapsed state — see ExpandNodeData.onToggle. */
  const toggle = d.onToggle ?? toggleExpandCollapsed;
  const selected = useSequenceEditorStore(
    (s) => s.selection?.kind === 'expand' && s.selection.id === d.fragmentId
  );

  const border = chrome.borderStrong;
  const headerBg = chrome.paperMuted;
  const kindLabel = d.kind === 'group' ? 'group' : d.kind;

  return (
    <div
      style={{
        width: d.width,
        height: d.height,
        border: `${selected ? 3 : 1.5}px dashed ${border}`,
        borderRadius: 10,
        background: d.collapsed ? `${chrome.borderStrong}12` : 'transparent',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <button
        type="button"
        className="nodrag nopan"
        onClick={(e) => {
          e.stopPropagation();
          toggle(d.fragmentId);
        }}
        style={{
          pointerEvents: 'all',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          border: 'none',
          borderBottom: d.collapsed ? 'none' : `1px solid ${chrome.border}`,
          background: headerBg,
          color: chrome.textPrimary,
          padding: '8px 12px',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 700,
          textAlign: 'left',
        }}
        title={d.collapsed ? `Expand ${kindLabel}` : `Collapse ${kindLabel}`}
      >
        {d.collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {d.label}
        </span>
        <span style={{ fontWeight: 500, color: chrome.textMuted, fontSize: 11 }}>
          {d.collapsed ? `${d.messageCount} hidden` : kindLabel}
        </span>
      </button>
    </div>
  );
}
