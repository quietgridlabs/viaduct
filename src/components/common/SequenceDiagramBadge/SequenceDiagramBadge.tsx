import { Box } from '@chakra-ui/react';
import { useFlatC4Store } from '@archivisio/c4-modelizer-sdk';
import { GitBranch } from 'lucide-react';
import { useMemo, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { StoredSequenceDiagram } from '@/types/c4Extensions';
import { ActionIconButton, NodeTooltip } from '@components/common/C4BlockStyled';
import {
  listEntitySequences,
  resolveSequencesEntity,
} from '@plugins/sequence-editor/localSequences';
import { toggleSequenceDiagramsSidebar } from '@plugins/sequence-editor/uiState';

type Props = {
  ownerType: 'container' | 'component';
  ownerId: string;
  ownerName: string;
  diagrams: StoredSequenceDiagram[];
};

/** Action button (left of Edit) when the entity has sequence diagrams. */
export default function SequenceDiagramBadge({
  ownerType,
  ownerId,
  ownerName,
  diagrams,
}: Props) {
  const { t } = useTranslation();
  const model = useFlatC4Store((s) => s.model);
  const resolved = useMemo(
    () => resolveSequencesEntity(model, ownerType, ownerId),
    [model, ownerType, ownerId]
  );
  const list = diagrams.length
    ? diagrams
    : listEntitySequences(model, ownerType, ownerId);
  if (!list.length) return null;

  const label = t('sequence_badge_hint', { count: list.length });

  const onClick = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    toggleSequenceDiagramsSidebar({
      ownerType: resolved?.ownerType ?? ownerType,
      ownerId: resolved?.entity.id ?? ownerId,
      ownerName,
    });
  };

  return (
    <NodeTooltip label={label}>
      <Box as="span" display="inline-flex" data-sequence-sidebar-trigger>
        <ActionIconButton
          onClick={onClick}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label={label}
          position="relative"
        >
          <GitBranch size={12} />
        </ActionIconButton>
      </Box>
    </NodeTooltip>
  );
}
