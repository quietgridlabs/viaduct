import { Box, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';

type SettingRowProps = {
  title: string;
  hint: string;
  children: ReactNode;
};

/** A setting: what it is, what it does, and the control itself. */
export default function SettingRow({ title, hint, children }: SettingRowProps) {
  return (
    <Box>
      <Text fontSize="sm" fontWeight="600" mb="2px">
        {title}
      </Text>
      <Text fontSize="xs" color="fg.muted" mb="10px" lineHeight="1.5">
        {hint}
      </Text>
      {children}
    </Box>
  );
}
