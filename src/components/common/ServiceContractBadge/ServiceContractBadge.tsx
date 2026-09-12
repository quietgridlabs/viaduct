import { Box } from '@chakra-ui/react';
import { FileJson } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionIconButton,
  NodeTooltip,
} from '@components/common/C4BlockStyled';
import { openServiceContract } from '@components/service-contract/UiState';

type Props = {
  containerId: string;
  containerName: string;
  endpointCount: number;
  /** Projected OpenAPI from a clone card when the owner isn't local. */
  openapi?: string;
};

/** Action button on a container that serves an API — opens its OpenAPI contract. */
export default function ServiceContractBadge({
  containerId,
  containerName,
  endpointCount,
  openapi,
}: Props) {
  const { t } = useTranslation();
  if (!endpointCount) return null;

  const label = t('service_contract_badge_hint', { count: endpointCount });

  const onClick = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    openServiceContract({ containerId, containerName, openapi });
  };

  return (
    <NodeTooltip label={label}>
      <Box as="span" display="inline-flex" data-service-contract-trigger>
        <ActionIconButton
          onClick={onClick}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label={label}
          position="relative"
        >
          <FileJson size={12} />
        </ActionIconButton>
      </Box>
    </NodeTooltip>
  );
}
