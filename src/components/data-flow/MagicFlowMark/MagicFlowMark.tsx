import { Box, HStack, Text } from '@chakra-ui/react';
import { Route } from 'lucide-react';

/** Quiet violet for Magic flow chrome — keep it thin. */
export const MAGIC_FLOW_FG = '#a78bfa';
export const MAGIC_FLOW_BORDER = 'rgba(167, 139, 250, 0.4)';
export const MAGIC_FLOW_SELECTED = 'rgba(167, 139, 250, 0.18)';

export function MagicFlowIcon({ size = 14 }: { size?: number }) {
  return (
    <Box
      as="span"
      display="inline-flex"
      color={MAGIC_FLOW_FG}
      lineHeight={0}
    >
      <Route size={size} strokeWidth={2} />
    </Box>
  );
}

export function MagicFlowTitle({
  label,
  iconSize = 14,
  fontSize = 'sm',
}: {
  label: string;
  iconSize?: number;
  fontSize?: string;
}) {
  return (
    <HStack gap="7px" align="center" minW={0}>
      <MagicFlowIcon size={iconSize} />
      <Text fontSize={fontSize} fontWeight="700" letterSpacing="-0.02em" lineClamp={1}>
        {label}
      </Text>
    </HStack>
  );
}
