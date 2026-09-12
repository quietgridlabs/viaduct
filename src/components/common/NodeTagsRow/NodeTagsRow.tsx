import { getElementTags } from '@/types/c4Extensions';
import { HStack } from '@chakra-ui/react';
import ElementTag from '@components/common/ElementTag';

export default function NodeTagsRow({ item }: { item: unknown }) {
  const tags = getElementTags(item);
  if (!tags.length) return null;

  return (
    <HStack
      pt="8px"
      gap="4px"
      flexWrap="wrap"
      minW={0}
      data-testid="block-tags"
    >
      {tags.map((tag) => (
        <ElementTag key={tag} tag={tag} tagSize="card" />
      ))}
    </HStack>
  );
}
