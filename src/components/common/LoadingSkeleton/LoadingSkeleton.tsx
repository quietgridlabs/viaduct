import { Box, VStack } from '@chakra-ui/react';

/**
 * Placeholder for a pane that is still loading.
 *
 * A skeleton in the shape of the content beats a spinner here: the panes keep
 * their size, nothing jumps when the text arrives, and the reader can already
 * tell prose from code from a diagram.
 */
export type SkeletonVariant = 'text' | 'code' | 'diagram';

/** Line widths, in the rhythm of what each pane will hold. */
const SHAPES: Record<SkeletonVariant, number[]> = {
  text: [55, 92, 84, 96, 70, 0, 88, 94, 62],
  code: [40, 78, 66, 82, 54, 70, 36, 88, 60, 44],
  diagram: [30, 30, 30],
};

export default function LoadingSkeleton({
  variant = 'text',
  label,
}: {
  variant?: SkeletonVariant;
  label?: string;
}) {
  const lines = SHAPES[variant];

  return (
    <Box
      h="full"
      w="full"
      minH="180px"
      p="16px"
      overflow="hidden"
      aria-busy="true"
      aria-label={label}
      role="status"
      data-testid="loading-skeleton"
    >
      <VStack align="stretch" gap="10px">
        {variant === 'text' ? (
          <Box
            className="qk-skeleton"
            h="20px"
            w="45%"
            borderRadius="6px"
            mb="6px"
          />
        ) : null}
        {lines.map((width, index) =>
          width === 0 ? (
            <Box key={index} h="6px" />
          ) : (
            <Box
              key={index}
              className="qk-skeleton"
              h={variant === 'diagram' ? '64px' : '11px'}
              w={`${width}%`}
              borderRadius={variant === 'diagram' ? '8px' : '4px'}
              /* Each line starts its sweep a little later than the one above,
                 so the block reads as one surface rather than a flashing list. */
              style={{ animationDelay: `${index * 90}ms` }}
            />
          )
        )}
      </VStack>
    </Box>
  );
}
