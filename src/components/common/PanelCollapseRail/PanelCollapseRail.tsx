import { Box, VStack } from '@chakra-ui/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { useGlassSurface } from '@theme/glassSurfaces';
import { ToolbarIconButton, TOOLBAR_ICON_SIZE } from '../ToolbarIconButton';

type Props = {
  label: string;
  title: string;
  side: 'left' | 'right';
  onExpand: () => void;
  /** Drop own chrome — sit inside PanelCollapseStack. */
  stacked?: boolean;
};

/** Vertical collapsed-pane rail used by docs, sequence, and data-flow editors. */
export default function PanelCollapseRail({
  label,
  title,
  side,
  onExpand,
  stacked = false,
}: Props) {
  const glass = useGlassSurface();
  return (
    <Box
      w="36px"
      flex={stacked ? '1' : undefined}
      flexShrink={0}
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      py={stacked ? '10px' : '8px'}
      gap="8px"
      minH={stacked ? 0 : undefined}
      pointerEvents="auto"
      {...(stacked
        ? {}
        : {
            ...glass.editorPanel,
            borderRadius: '12px',
            mx: '4px',
            alignSelf: 'center',
          })}
    >
      <ToolbarIconButton aria-label={title} title={title} onClick={onExpand}>
        {side === 'left' ? (
          <ChevronRight size={TOOLBAR_ICON_SIZE} />
        ) : (
          <ChevronLeft size={TOOLBAR_ICON_SIZE} />
        )}
      </ToolbarIconButton>
      <Box
        writingMode="vertical-rl"
        transform={side === 'left' ? 'rotate(180deg)' : undefined}
        fontSize="11px"
        fontWeight="600"
        letterSpacing="0.04em"
        color="fg.muted"
        userSelect="none"
        lineHeight="1"
      >
        {label}
      </Box>
    </Box>
  );
}

/** One 36px column for several collapsed pane rails. */
export function PanelCollapseStack({
  side,
  children,
}: {
  side: 'left' | 'right';
  children: ReactNode;
}) {
  const glass = useGlassSurface();
  return (
    <VStack
      w="36px"
      flexShrink={0}
      alignSelf="stretch"
      h="full"
      py="6px"
      gap="0"
      pointerEvents="auto"
      {...glass.editorPanel}
      borderRadius="12px"
      ml={side === 'right' ? '4px' : undefined}
      mr={side === 'left' ? '4px' : undefined}
    >
      {children}
    </VStack>
  );
}
