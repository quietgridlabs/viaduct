import { Box, Button, HStack, Text } from '@chakra-ui/react';
import { GLASS_RADIUS_BAR } from '@theme/glassSurfaces';
import { CRUMB_LABEL_MAX_W, PILL_CONTROL_H } from './constants';
import type { CrumbButtonProps } from './types';

/** Where you are, or somewhere you could go. The active crumb is neither. */
export default function CrumbButton({
  active,
  onClick,
  icon,
  label,
  title,
  testId,
}: CrumbButtonProps) {
  const interactive = Boolean(onClick) && !active;
  return (
    <Button
      variant="ghost"
      size="xs"
      h={PILL_CONTROL_H}
      minH={PILL_CONTROL_H}
      minW={PILL_CONTROL_H}
      px="8px"
      borderRadius={GLASS_RADIUS_BAR}
      flexShrink={0}
      color={active ? 'fg.default' : 'fg.muted'}
      fontWeight={active ? '600' : '500'}
      fontSize="sm"
      bg={active ? 'bg.list.selected' : 'transparent'}
      _hover={interactive ? { bg: 'bg.list.hover', color: 'fg.default' } : undefined}
      onClick={interactive ? onClick : undefined}
      disabled={!interactive && !active}
      cursor={interactive ? 'pointer' : 'default'}
      title={title ?? label}
      aria-label={label}
      data-testid={testId}
    >
      <HStack gap="6px" minW={0}>
        {icon ? (
          <Box flexShrink={0} color={active ? 'fg.default' : 'fg.subtle'} lineHeight={0}>
            {icon}
          </Box>
        ) : null}
        <Text as="span" data-nav-label="" lineClamp={1} maxW={CRUMB_LABEL_MAX_W}>
          {label}
        </Text>
      </HStack>
    </Button>
  );
}
