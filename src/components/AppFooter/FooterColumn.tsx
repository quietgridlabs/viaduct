import { Box, Text } from '@chakra-ui/react';
import type { FooterColumnProps } from './types';

export default function FooterColumn({ title, children }: FooterColumnProps) {
  return (
    <Box display="flex" flexDirection="column" gap="8px" minW="140px">
      <Text
        fontSize="xs"
        fontWeight="700"
        letterSpacing="0.06em"
        textTransform="uppercase"
        color="fg.subtle"
        mb="2px"
      >
        {title}
      </Text>
      {children}
    </Box>
  );
}
