import { Box } from '@chakra-ui/react';
import { Frame } from 'lucide-react';
import { useMemo, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionIconButton, NodeTooltip } from '@components/common/C4BlockStyled';
import { parseDesignContract } from '@components/common/DesignContract';

type Props = {
  /** Stored tagged text; nothing is drawn when there is none. */
  design?: string;
  /** Resolved from the container when the element does not disagree. */
  designSystem?: string;
  /** Opens the element's panel, where the design is edited. */
  onEdit?: () => void;
};

/**
 * A card that answers to a design says so, and says which states it owes.
 */
export default function DesignBadge({ design, designSystem, onEdit }: Props) {
  const { t } = useTranslation();
  const contract = useMemo(() => parseDesignContract(design || ''), [design]);
  if (!design?.trim()) return null;

  const states = contract.states.map((s) => s.name).join(', ');
  const label = [
    designSystem || t('design_contract_label'),
    contract.states.length ? t('design_states_count', { count: contract.states.length }) : null,
    states || null,
  ]
    .filter(Boolean)
    .join(' · ');

  const onClick = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onEdit?.();
  };

  return (
    <NodeTooltip label={label}>
      <Box as="span" display="inline-flex" data-design-trigger>
        <ActionIconButton
          onClick={onClick}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label={label}
          cursor="pointer"
        >
          <Frame size={12} />
        </ActionIconButton>
      </Box>
    </NodeTooltip>
  );
}
