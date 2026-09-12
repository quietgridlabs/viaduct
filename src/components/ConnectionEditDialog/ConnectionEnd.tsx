import TechnologyIcon from '@components/TechnologyIcon';
import { findById } from '@utils/dataFlows';
import { useFlatC4Store } from '@archivisio/c4-modelizer-sdk';
import type { ComponentBlock } from '@archivisio/c4-modelizer-sdk';
import { Box, Field, HStack, Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';

/**
 * One end of the connection: whatever it is joined to, drawn the way the panel
 * head draws an element — its mark and its name.
 *
 * Read-only on purpose. Which two things an arrow joins is the first thing you
 * want to know about it and the last thing you would want to change by
 * accident; it is changed by dragging the arrow, on the diagram.
 */
export default function ConnectionEnd({ label, id }: { label: string; id: string }) {
  const model = useFlatC4Store((s) => s.model);
  const found = id ? findById(model, id) : null;
  const item = found?.item as { name?: string; technology?: string } | undefined;
  const { t } = useTranslation();

  return (
    <Field.Root w="full" minW={0}>
      <Field.Label color="fg.muted" mb="6px">
        {label}
      </Field.Label>
      {/* The same height a picked value has, so the two ends and the three
          choices below them keep one rhythm rather than alternating between a
          line of text and a control. */}
      <HStack gap="6px" minW={0} minH="40px">
        {item?.technology ? (
          <Box flexShrink={0} lineHeight={0}>
            <TechnologyIcon
              item={{ technology: item.technology } as ComponentBlock}
              size={16}
              showTooltip={false}
            />
          </Box>
        ) : null}
        <Text fontSize="sm" truncate color={item ? 'fg.default' : 'fg.subtle'}>
          {item?.name || t('field_empty', { label: label.toLowerCase() })}
        </Text>
      </HStack>
    </Field.Root>
  );
}
