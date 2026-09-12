import { Box, Text, VStack } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import type { Diagnostic } from '../plantuml/diagnostics';

export default function DiagnosticsPanel({ diagnostics }: { diagnostics: Diagnostic[] }) {
  const { t } = useTranslation();
  if (!diagnostics.length) {
    return (
      <Box px="12px" py="6px" borderTopWidth="1px" borderColor="border.default">
        <Text fontSize="xs" color="fg.muted">
          {t('sequence_diagnostics_ok')}
        </Text>
      </Box>
    );
  }
  return (
    <VStack
      align="stretch"
      gap="2px"
      px="12px"
      py="6px"
      borderTopWidth="1px"
      borderColor="border.default"
      maxH="96px"
      overflowY="auto"
    >
      {diagnostics.map((d, i) => (
        <Text
          key={`${d.code}-${d.line}-${i}`}
          fontSize="xs"
          color={d.severity === 'error' ? 'red.400' : 'yellow.500'}
        >
          L{d.line}:{d.column} [{d.severity}] {d.message}
        </Text>
      ))}
    </VStack>
  );
}
