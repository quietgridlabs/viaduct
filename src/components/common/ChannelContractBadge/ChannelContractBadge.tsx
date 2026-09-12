import { Box } from '@chakra-ui/react';
import { Radio } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionIconButton,
  NodeTooltip,
} from '@components/common/C4BlockStyled';
import { openChannelContract } from '@components/channel-contract/UiState';

type Props = {
  containerId: string;
  containerName: string;
  count: number;
};

/** Count of topics/queues on a broker card — opens the channel contract viewer. */
export default function ChannelContractBadge({
  containerId,
  containerName,
  count,
}: Props) {
  const { t } = useTranslation();
  if (!count) return null;

  const label = t('channel_badge_hint', { count });

  const onClick = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    openChannelContract({ containerId, containerName });
  };

  return (
    <NodeTooltip label={label}>
      <Box as="span" display="inline-flex" data-channel-contract-trigger>
        <ActionIconButton
          onClick={onClick}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label={label}
          position="relative"
        >
          <Radio size={12} />
        </ActionIconButton>
      </Box>
    </NodeTooltip>
  );
}
