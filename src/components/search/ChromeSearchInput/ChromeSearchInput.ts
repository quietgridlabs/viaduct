import { GLASS_RADIUS_BAR } from '@theme/glassSurfaces';
import type { InputProps } from '@chakra-ui/react';

/**
 * Search fields that live inside glass chrome (toolbar pill, connect popover).
 * Radius matches `glass.floatBar` / `glass.dialog` shells — not the default
 * Chakra input corner.
 */
export const chromeSearchInputProps: InputProps = {
  size: 'sm',
  h: '28px',
  fontSize: 'sm',
  borderRadius: GLASS_RADIUS_BAR,
  bg: 'bg.subtle',
  borderColor: 'border.input',
  _hover: { borderColor: 'border.strong' },
  _focusVisible: { borderColor: 'border.focus', boxShadow: 'none' },
};
