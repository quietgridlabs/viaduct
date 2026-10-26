import { useColorMode } from '@contexts/ColorModeContext';
import { Box, Text } from '@chakra-ui/react';
import type { Node, NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

export type GroupFrameData = {
  label: string;
  memberCount?: number;
  /**
   * What the frame is, printed small under it. Defaults to "Group", which is
   * what a frame is on the level diagram — there it gathers elements sharing
   * a group tag. The service graph draws one round a system instead, and
   * calling that a group would tell the reader something untrue; it passes an
   * empty string, and nothing is printed.
   */
  caption?: string;
};

function GroupFrameNode({ data }: NodeProps<Node<GroupFrameData>>) {
  const { mode, chrome } = useColorMode();
  const { t } = useTranslation();
  const caption = data.caption ?? t('group');
  const light = mode === 'light';

  return (
    <Box
      w="100%"
      h="100%"
      borderRadius="16px"
      borderWidth="1px"
      borderStyle="solid"
      borderColor={light ? 'rgba(26, 22, 20, 0.16)' : 'rgba(232, 220, 210, 0.22)'}
      bg={light ? 'rgba(255, 255, 255, 0.32)' : 'rgba(255, 248, 242, 0.045)'}
      pointerEvents="none"
      position="relative"
    >
      {/* The title is the one grabbable part (the frame's dragHandle): dragging
          it moves every card in the group. The body stays canvas. */}
      <Text
        className="group-frame-handle"
        pointerEvents="auto"
        cursor="grab"
        position="absolute"
        top="10px"
        left="14px"
        right="14px"
        fontWeight="600"
        fontSize="sm"
        letterSpacing="-0.02em"
        color={chrome.nodeText}
        lineClamp={1}
      >
        {data.label}
      </Text>
      {caption ? (
        <Text
          position="absolute"
          bottom="8px"
          left="0"
          right="0"
          textAlign="center"
          fontSize="11px"
          color={chrome.nodeTextMuted}
          pointerEvents="none"
        >
          {caption}
        </Text>
      ) : null}
    </Box>
  );
}

export default memo(GroupFrameNode);
