import type { ComponentBlock, NodeData } from '@archivisio/c4-modelizer-sdk';
import type { TableColumn, TableExtras } from '@/types/c4Extensions';
import { getElementTags } from '@/types/c4Extensions';
import UrlLinkBadge from '@components/common/UrlLinkBadge';
import NodeTagsRow from '@components/common/NodeTagsRow';
import { useColorMode } from '@contexts/ColorModeContext';
import {
  CANVAS_NODE_RADIUS,
  getNodeSurface,
  handleStyle,
} from '@theme/canvasSurfaces';
import { KeyRound } from 'lucide-react';
import { Box, Text } from '@chakra-ui/react';
import { Handle, Position } from '@xyflow/react';
import { memo } from 'react';
import { sameNodeCard } from '@components/common/NodeCardMemo';

export type TableNodeData = ComponentBlock &
  TableExtras & {
    onEdit: () => void;
    traceHighlight?: boolean;
    traceDimmed?: boolean;
  };

const TableNode: React.FC<NodeData<ComponentBlock>> = memo(({ data, selected }) => {
  const { c4Colors, chrome, mode } = useColorMode();
  const nodeData = data as TableNodeData;
  const columns: TableColumn[] = nodeData.columns || [];
  const colors = c4Colors.component;
  const accent = colors.border;
  const highlighted = Boolean(nodeData.traceHighlight);
  const dimmed = Boolean(nodeData.traceDimmed);
  const linked = Boolean((nodeData as { linkedHighlight?: boolean }).linkedHighlight);
  const surface = getNodeSurface(
    accent,
    mode,
    highlighted ? 'highlight' : selected ? 'selected' : linked ? 'linked' : 'idle'
  );
  const borderW = selected || highlighted ? '2px' : '1px';

  return (
    <Box
      w="300px"
      borderRadius={CANVAS_NODE_RADIUS}
      borderWidth={borderW}
      borderStyle="solid"
      borderColor={highlighted || selected || linked ? accent : surface.border}
      bg={surface.bg}
      boxShadow={surface.shadow}
      overflow="hidden"
      fontSize="12px"
      opacity={dimmed ? 0.22 : 1}
      filter={dimmed ? 'grayscale(0.35) saturate(0.5)' : 'none'}
      transition="opacity 0.15s ease, filter 0.15s ease, box-shadow 0.15s ease"
      css={{ '--node-accent': accent }}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        style={handleStyle(accent, mode) as React.CSSProperties}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="target-top"
        style={handleStyle(accent, mode) as React.CSSProperties}
      />

      <Box
        display="flex"
        alignItems="center"
        gap="8px"
        px="10px"
        py="7px"
        bg={surface.headerBg}
        borderBottomWidth="1px"
        borderBottomColor={surface.headerBorder}
      >
        <Text
          flex="1"
          fontWeight="700"
          color={chrome.textPrimary}
          overflow="hidden"
          textOverflow="ellipsis"
          whiteSpace="nowrap"
          fontSize="sm"
        >
          {nodeData.name || 'table'}
        </Text>
        <UrlLinkBadge item={nodeData} ownerName={nodeData.name} />
      </Box>

      <Box maxH="260px" overflowY="auto">
        {columns.length === 0 ? (
          <Text display="block" px="10px" py="8px" color={chrome.textMuted} fontSize="xs">
            No columns
          </Text>
        ) : (
          columns.map((col) => (
            <Box
              key={col.id}
              display="flex"
              alignItems="center"
              gap="6px"
              px="10px"
              py="4px"
              borderBottomWidth="1px"
              borderBottomColor={chrome.border}
              _last={{ borderBottomWidth: 0 }}
            >
              {col.primaryKey ? (
                <KeyRound size={12} color={accent} />
              ) : (
                <Box w="12px" />
              )}
              <Text
                flex="1"
                color={chrome.textPrimary}
                overflow="hidden"
                textOverflow="ellipsis"
                whiteSpace="nowrap"
                fontSize="xs"
              >
                {col.name}
              </Text>
              <Text color={chrome.textMuted} fontSize="xs">
                {col.dataType}
                {col.nullable === false || col.primaryKey ? '' : '?'}
              </Text>
            </Box>
          ))
        )}
      </Box>

      {getElementTags(nodeData).length > 0 && (
        <Box px="10px" pb="8px">
          <NodeTagsRow item={nodeData} />
        </Box>
      )}

      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        style={handleStyle(accent, mode) as React.CSSProperties}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="source-bottom"
        style={handleStyle(accent, mode) as React.CSSProperties}
      />
    </Box>
  );
}, sameNodeCard);

TableNode.displayName = 'TableNode';

export default TableNode;
