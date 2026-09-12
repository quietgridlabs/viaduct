import { Box, HStack, Text } from '@chakra-ui/react';
import { INSTRUMENTS_DIMMED_OPACITY } from './constants';
import { menuItemTitle } from './helpers';
import type { InstrumentsMenuRowProps } from './types';

/** One instrument in the drop-down: icon, name, and its current state. */
export default function InstrumentsMenuRow({ item }: InstrumentsMenuRowProps) {
  const dimmed = Boolean(item.disabled && !item.active);
  return (
    <HStack
      as="button"
      w="full"
      gap="10px"
      px="14px"
      py="8px"
      cursor={item.disabled ? 'default' : 'pointer'}
      opacity={dimmed ? INSTRUMENTS_DIMMED_OPACITY : 1}
      color={item.active ? 'fg.default' : 'fg.muted'}
      bg={item.active ? 'bg.list.selected' : 'transparent'}
      _hover={!item.disabled ? { bg: 'bg.list.hover', color: 'fg.default' } : undefined}
      onClick={item.disabled ? undefined : item.onClick}
      title={menuItemTitle(item)}
      overflow="hidden"
    >
      <Box flexShrink={0} lineHeight={0} color={item.active ? 'fg.default' : 'fg.subtle'}>
        {item.icon}
      </Box>
      <Text fontSize="sm" fontWeight={item.active ? '600' : '500'} whiteSpace="nowrap">
        {item.label}
      </Text>
    </HStack>
  );
}
