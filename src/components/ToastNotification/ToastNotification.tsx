import { ToolbarIconButton, TOOLBAR_ICON_SIZE } from '@components/common/ToolbarIconButton';
import { Box, Text } from '@chakra-ui/react';
import { CANVAS_CHROME_INSET, SIDE_PANEL_TOP } from '@theme/sidePanelLayout';
import { useGlassSurface } from '@theme/glassSurfaces';
import { X } from 'lucide-react';
import { useEffect } from 'react';
import { DEFAULT_AUTO_HIDE_MS, TOAST_HEIGHT_PX } from './constants';
import type { ToastNotificationProps } from './types';

export default function ToastNotification({
  message,
  onClose,
  autoHideDuration = DEFAULT_AUTO_HIDE_MS,
}: ToastNotificationProps) {
  const glass = useGlassSurface();

  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(onClose, autoHideDuration);
    return () => window.clearTimeout(id);
  }, [message, autoHideDuration, onClose]);

  if (!message) return null;

  return (
    <Box
      position="fixed"
      /* Under the right-hand chrome bar rather than in a bottom corner: the
         bottom-left now belongs to the zoom bar and the version rail, and a
         toast that lands on top of them hides the controls it interrupts. */
      top={SIDE_PANEL_TOP}
      right={CANVAS_CHROME_INSET}
      zIndex={2000}
      maxW="min(420px, calc(100vw - 24px))"
      w="max-content"
      minW="220px"
      h={`${TOAST_HEIGHT_PX}px`}
      minH={`${TOAST_HEIGHT_PX}px`}
      px="8px"
      py="6px"
      display="flex"
      alignItems="center"
      gap="6px"
      color="fg.default"
      pointerEvents="auto"
      {...glass.floatBar}
    >
      <Text flex="1" fontSize="sm" fontWeight="500" lineHeight="1.25" lineClamp={1}>
        {message}
      </Text>
      <ToolbarIconButton
        aria-label="Close"
        title="Close"
        tooltipPlacement="top"
        onClick={onClose}
      >
        <X size={TOOLBAR_ICON_SIZE} />
      </ToolbarIconButton>
    </Box>
  );
}
