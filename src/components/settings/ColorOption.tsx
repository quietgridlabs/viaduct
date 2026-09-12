import { Box, chakra, HStack, Text } from '@chakra-ui/react';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';

const SMALL_ICON_SIZE = 13;
const SWATCH_W = '30px';
const SWATCH_H = '20px';

type ColorOptionProps = {
  active: boolean;
  label: string;
  hint: string;
  preview: ReactNode;
  onSelect: () => void;
};

/* Chakra v3's polymorphic Box does not type `type` on a button element. */
const PlainButton = chakra('button');

/** A miniature of an element card, so the choice shows what it does. */
export function Swatch({ fill, border }: { fill: string; border: string }) {
  return (
    <Box
      w={SWATCH_W}
      h={SWATCH_H}
      borderRadius="5px"
      bg={fill}
      borderWidth="1px"
      borderColor={border}
    />
  );
}

/**
 * One colour option, shown as a card with a live preview.
 *
 * Two chips said "By technology / Neutral" and left the reader to imagine the
 * result; the preview is built from the same functions the canvas uses, so what
 * is on the card is what lands on the board.
 */
export default function ColorOption({
  active,
  label,
  hint,
  preview,
  onSelect,
}: ColorOptionProps) {
  return (
    <PlainButton
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      textAlign="left"
      flex="1"
      minW={0}
      p="10px"
      borderRadius="10px"
      borderWidth="1px"
      cursor="pointer"
      transition="border-color 0.12s ease, background 0.12s ease"
      borderColor={active ? 'brand.solid' : 'border.default'}
      bg={active ? 'bg.brand.subtle' : 'transparent'}
      _hover={{ bg: active ? 'bg.brand.subtle' : 'bg.list.hover' }}
    >
      <HStack gap="6px" mb="8px">
        {preview}
      </HStack>
      <HStack gap="6px" align="center" mb="2px">
        <Text fontSize="sm" fontWeight="600" color={active ? 'brand.text' : 'fg.default'}>
          {label}
        </Text>
        {active && <Check size={SMALL_ICON_SIZE} />}
      </HStack>
      <Text fontSize="xs" color="fg.muted" lineHeight="1.4">
        {hint}
      </Text>
    </PlainButton>
  );
}
