import { Menu, Text, VStack } from '@chakra-ui/react';
import type { ExportMenuRowProps } from './types';

/** One export choice: what leaves the tool, and underneath, in what shape. */
export default function ExportMenuRow({
  value,
  testId,
  primary,
  secondary,
  onClick,
}: ExportMenuRowProps) {
  return (
    <Menu.Item value={value} data-testid={testId} cursor="pointer" onClick={onClick}>
      <VStack align="start" gap="0" py="2px">
        <Text fontWeight="600">{primary}</Text>
        <Text fontSize="xs" color="fg.muted">
          {secondary}
        </Text>
      </VStack>
    </Menu.Item>
  );
}
