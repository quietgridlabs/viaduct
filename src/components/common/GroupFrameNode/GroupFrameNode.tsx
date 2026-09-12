import { useColorMode } from '@contexts/ColorModeContext';
import { Box, Text } from '@chakra-ui/react';
import type { Node, NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

export type GroupFrameData = {
  label: string;
  memberCount?: number;
};

function GroupFrameNode({ data }: NodeProps<Node<GroupFrameData>>) {
  const { mode, chrome } = useColorMode();
  const { t } = useTranslation();
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
      <Text
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
        {t('group')}
      </Text>
    </Box>
  );
}

export default memo(GroupFrameNode);
