import { Box, HStack, Text } from '@chakra-ui/react';
import type { MenuRowProps } from './types';

/**
 * One row of the tag menu.
 *
 * The leading mark gets a fixed slot rather than sitting inline: the icons and
 * the colour swatches are not the same width, and without it every label
 * started at a slightly different place down the menu.
 */
export default function MenuRow({ mark, children }: MenuRowProps) {
  return (
    <HStack gap="8px" w="100%" justify="flex-start">
      <Box w="16px" flexShrink={0} display="flex" alignItems="center" justifyContent="center">
        {mark}
      </Box>
      <Text fontSize="sm">{children}</Text>
    </HStack>
  );
}
