import { Box } from '@chakra-ui/react';
import { Route } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useFlatC4Store } from '@archivisio/c4-modelizer-sdk';
import type { FlowOwnerType } from '@/types/c4Extensions';
import { ActionIconButton, NodeTooltip } from '@components/common/C4BlockStyled';
import { toggleDataFlowSidebar } from '@plugins/data-flows/uiState';
import { uniqueFlowsForElement } from '@utils/dataFlows';

type Props = {
  ownerType: FlowOwnerType;
  ownerId: string;
  ownerName: string;
};

/** Action button (left of Edit) when the entity participates in data flows. */
export default function DataFlowBadge({
  ownerType,
  ownerId,
  ownerName,
}: Props) {
  const { t } = useTranslation();
  const model = useFlatC4Store((s) => s.model);
  const flows = uniqueFlowsForElement(model, ownerId);
  if (!flows.length) return null;

  const label = t('data_flow_badge_hint', { count: flows.length });

  const onClick = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    toggleDataFlowSidebar({ ownerType, ownerId, ownerName });
  };

  return (
    <NodeTooltip label={label}>
      <Box as="span" display="inline-flex" data-flow-sidebar-trigger>
        <ActionIconButton
          onClick={onClick}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label={label}
          position="relative"
        >
          <Route size={12} />
        </ActionIconButton>
      </Box>
    </NodeTooltip>
  );
}
