import { useColorMode } from '@contexts/ColorModeContext';
import type { CSSProperties } from 'react';
import { Box, Text } from '@chakra-ui/react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useSequenceEditorStore } from '../state/sequence-editor-store';
import type { ParticipantNodeData } from './projection';

function colorsForKind(kind: string, c4: ReturnType<typeof useColorMode>['c4Colors']) {
  switch (kind) {
    case 'actor':
    case 'boundary':
      return c4.system;
    case 'participant':
    case 'queue':
      return c4.container;
    case 'control':
      return c4.component;
    case 'entity':
    case 'database':
    case 'collections':
      return c4.code;
    default:
      return c4.component;
  }
}

export default function ParticipantNode({ data, selected: rfSelected }: NodeProps) {
  const { c4Colors, chrome, mode } = useColorMode();
  const d = data as ParticipantNodeData;
  const storeSelected = useSequenceEditorStore(
    (s) => s.selection?.kind === 'participant' && s.selection.id === d.participantId
  );
  const selected = Boolean(rfSelected || storeSelected);
  const colors = colorsForKind(d.kind, c4Colors);
  const text = chrome.nodeText;
  const muted = chrome.nodeTextMuted;

  const handleStyle: CSSProperties = {
    width: 12,
    height: 12,
    background: colors.border,
    border: mode === 'dark' ? `2px solid ${colors.border}` : '2px solid #fff',
    opacity: 1,
  };

  return (
    <Box
      bg={colors.background}
      borderWidth={selected ? '3px' : '1px'}
      borderColor={colors.border}
      borderRadius="md"
      px="10px"
      py="8px"
      minW="140px"
      maxW="160px"
      textAlign="center"
      boxShadow={
        selected ? `0 0 0 2px ${colors.border}` : 'sm'
      }
      cursor="grab"
      position="relative"
      zIndex={2}
      title={d.label}
      style={{
        backgroundImage: `linear-gradient(135deg, ${colors.gradient}, ${colors.background})`,
      }}
    >
      <Text fontSize="10px" color={muted} textTransform="uppercase" fontWeight="600">
        {d.kind}
      </Text>
      <Text
        fontWeight="700"
        fontSize="sm"
        lineClamp={2}
        color={text}
        title={d.label}
      >
        {d.label}
      </Text>
      <Text fontSize="10px" color={muted} lineClamp={1} title={d.participantId}>
        {d.participantId}
      </Text>
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        style={{ ...handleStyle, left: -6 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ ...handleStyle, right: -6 }}
      />
    </Box>
  );
}
