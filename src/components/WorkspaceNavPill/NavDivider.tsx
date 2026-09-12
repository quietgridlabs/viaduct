import { Box } from '@chakra-ui/react';
import { DIVIDER_HEIGHT, DIVIDER_OPACITY } from './constants';

/** A hairline between groups of controls. */
export default function NavDivider() {
  return (
    <Box
      w="1px"
      h={DIVIDER_HEIGHT}
      bg="border.glass"
      opacity={DIVIDER_OPACITY}
      mx="4px"
      flexShrink={0}
      aria-hidden
    />
  );
}
