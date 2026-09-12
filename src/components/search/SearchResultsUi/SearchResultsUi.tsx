import TechnologyIcon from '@components/TechnologyIcon';
import type { BaseBlock } from '@archivisio/c4-modelizer-sdk';
import { Box, Badge, HStack, Text, VStack } from '@chakra-ui/react';

export const SEARCH_SKELETON_ROWS = 4;

export function SearchResultSkeletonRows({ count }: { count: number }) {
  return (
    <VStack align="stretch" gap="1px" aria-busy="true" role="status">
      {Array.from({ length: count }, (_, index) => (
        <HStack key={index} gap="10px" px="10px" py="8px" borderRadius="md">
          <Box
            className="qk-skeleton"
            w="16px"
            h="16px"
            borderRadius="4px"
            flexShrink={0}
            style={{ animationDelay: `${index * 70}ms` }}
          />
          <VStack gap="6px" align="start" flex="1" minW={0}>
            <Box
              className="qk-skeleton"
              h="12px"
              w={`${58 + (index % 3) * 12}%`}
              borderRadius="4px"
              style={{ animationDelay: `${index * 70 + 40}ms` }}
            />
            <Box
              className="qk-skeleton"
              h="9px"
              w={`${38 + (index % 2) * 18}%`}
              borderRadius="4px"
              style={{ animationDelay: `${index * 70 + 80}ms` }}
            />
          </VStack>
          <Box
            className="qk-skeleton"
            w="52px"
            h="18px"
            borderRadius="4px"
            flexShrink={0}
            style={{ animationDelay: `${index * 70 + 120}ms` }}
          />
        </HStack>
      ))}
    </VStack>
  );
}

export function SearchResultRow({
  name,
  technology,
  kindLabel,
  meta,
  onClick,
}: {
  name: string;
  technology?: string;
  kindLabel: string;
  meta?: string;
  onClick: () => void;
}) {
  return (
    <HStack
      as="button"
      w="full"
      textAlign="left"
      gap="10px"
      px="10px"
      py="8px"
      borderRadius="md"
      cursor="pointer"
      justify="space-between"
      _hover={{ bg: 'bg.list.hover' }}
      onClick={onClick}
    >
      <HStack gap="8px" minW={0}>
        {technology ? (
          <TechnologyIcon item={{ technology, name } as BaseBlock} size={16} showTooltip={false} />
        ) : null}
        <VStack gap="1px" align="start" minW={0}>
          <Text fontSize="sm" fontWeight="500" color="fg.default" lineClamp={1}>
            {name}
          </Text>
          {meta ? (
            <Text fontSize="0.65rem" color="fg.muted" lineClamp={1}>
              {meta}
            </Text>
          ) : null}
        </VStack>
      </HStack>
      <Badge flexShrink={0} variant="subtle" fontSize="xs" color="fg.muted">
        {kindLabel}
      </Badge>
    </HStack>
  );
}
