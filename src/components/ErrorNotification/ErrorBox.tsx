import { Box, Text } from '@chakra-ui/react';
import { useColorMode } from '@contexts/ColorModeContext';
import { getErrorColor } from '@theme/theme';
import { CANVAS_CHROME_INSET, SIDE_PANEL_TOP } from '@theme/sidePanelLayout';
import { useGlassSurface } from '@theme/glassSurfaces';
import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';
import { STACK_GAP_PX, TOAST_HEIGHT_PX } from './constants';

/**
 * Sits directly under the toast in the same corner, so the two notification
 * surfaces read as one channel instead of appearing in opposite corners of the
 * screen. The bottom-left it used to occupy now belongs to the zoom bar and the
 * version rail, which it covered.
 */
export function ErrorBox({ children }: { children: ReactNode }) {
  const glass = useGlassSurface();
  const { mode } = useColorMode();
  const errorColor = getErrorColor(mode);

  return (
    <Box
      role="alert"
      position="fixed"
      top={`calc(${SIDE_PANEL_TOP} + ${TOAST_HEIGHT_PX + STACK_GAP_PX}px)`}
      right={CANVAS_CHROME_INSET}
      zIndex={2000}
      maxW="min(420px, calc(100vw - 24px))"
      w="max-content"
      minW="220px"
      minH="40px"
      px="10px"
      py="8px"
      display="flex"
      alignItems="center"
      gap="8px"
      pointerEvents="auto"
      {...glass.floatBar}
      borderColor={errorColor}
    >
      <Box flexShrink={0} lineHeight={0} color={errorColor}>
        <AlertTriangle size={15} />
      </Box>
      <Text fontSize="sm" fontWeight="500" lineHeight="1.3" color="fg.default">
        {children}
      </Text>
    </Box>
  );
}
