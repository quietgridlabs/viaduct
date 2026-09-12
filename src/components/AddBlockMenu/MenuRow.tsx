import { Menu, Text, VStack } from '@chakra-ui/react';
import type { MenuRowProps } from './types';

/** One offer in the menu: what it adds, and underneath, what that means. */
export default function MenuRow({
  primary,
  secondary,
  disabled,
  onClick,
  testId,
}: MenuRowProps) {
  return (
    <Menu.Item
      value={testId || primary}
      disabled={disabled}
      data-testid={testId}
      onClick={onClick}
      cursor={disabled ? 'not-allowed' : 'pointer'}
    >
      <VStack align="start" gap="0" py="2px">
        <Text fontWeight="600">{primary}</Text>
        {secondary ? (
          <Text fontSize="xs" color="fg.muted">
            {secondary}
          </Text>
        ) : null}
      </VStack>
    </Menu.Item>
  );
}
