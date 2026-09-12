import { Text, VStack } from '@chakra-ui/react';
import type { MenuRowProps } from './types';

/** A row is just its title until there is something to explain. */
export default function MenuRow({ title, hint }: MenuRowProps) {
  if (!hint) {
    return <Text fontWeight="600">{title}</Text>;
  }
  return (
    <VStack align="start" gap="0">
      <Text fontWeight="600">{title}</Text>
      <Text fontSize="xs" color="fg.muted">
        {hint}
      </Text>
    </VStack>
  );
}
