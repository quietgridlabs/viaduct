import type { DataFlowParticipation } from '@utils/dataFlows';
import { Box, HStack, Text, VStack } from '@chakra-ui/react';
import { Play } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export default function FlowParticipationList({
  participations,
  onOpenStep,
}: {
  participations: DataFlowParticipation[];
  onOpenStep: (flowId: string, stepId: string) => void;
}) {
  const { t } = useTranslation();
  const flows = useMemo(() => {
    const seen = new Map<string, DataFlowParticipation>();
    for (const hit of participations) {
      if (!seen.has(hit.flow.id)) seen.set(hit.flow.id, hit);
    }
    return [...seen.values()];
  }, [participations]);

  if (flows.length === 0) {
    return (
      <Text fontSize="sm" color="fg.muted">
        {t('data_flow_none_for_service')}
      </Text>
    );
  }

  return (
    <VStack align="stretch" gap="4px">
      {flows.map((hit) => {
        const flow = hit.flow;
        const playStepId = flow.steps[0]?.id || hit.step.id;
        return (
          <HStack
            key={flow.id}
            as="button"
            w="full"
            textAlign="left"
            gap="8px"
            px="8px"
            py="6px"
            borderRadius="6px"
            _hover={{ bg: 'bg.list.hover' }}
            cursor="pointer"
            title={t('data_flow_play')}
            aria-label={`${t('data_flow_play')}: ${flow.name}`}
            onClick={() => onOpenStep(flow.id, playStepId)}
          >
            <Box color="fg.muted" flexShrink={0} display="flex">
              <Play size={12} />
            </Box>
            <Text fontSize="sm" fontWeight="600" flex="1" lineClamp={1}>
              {flow.name}
            </Text>
          </HStack>
        );
      })}
    </VStack>
  );
}
