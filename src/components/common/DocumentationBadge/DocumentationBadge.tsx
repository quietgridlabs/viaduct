import { Box } from '@chakra-ui/react';
import { FileText } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { InlineDocumentation } from '@/types/c4Extensions';
import { ActionIconButton, NodeTooltip } from '@components/common/C4BlockStyled';
import {
  getDocumentationContext,
  toggleDocumentationSidebar,
} from '@plugins/docs-editor/uiState';

type Props = {
  ownerType: 'system' | 'container' | 'component' | 'code';
  ownerId: string;
  ownerName: string;
  /** Prefer count; legacy single id still works. */
  documentationCount?: number;
  documentationId?: string;
  /** Projected docs from the card (clone merge / remote original). */
  documentations?: InlineDocumentation[];
};

function documentationTooltipKey(ownerType: Props['ownerType']) {
  switch (ownerType) {
    case 'container':
      return 'documentation_open_service';
    case 'component':
      return 'documentation_open_component';
    case 'system':
      return 'documentation_open_system';
    case 'code':
      return 'documentation_open_code';
  }
}

export default function DocumentationBadge({
  ownerType,
  ownerId,
  ownerName,
  documentationCount,
  documentationId,
  documentations,
}: Props) {
  const { t } = useTranslation();

  const count =
    typeof documentationCount === 'number'
      ? documentationCount
      : documentationId
        ? 1
        : 0;
  if (count <= 0) return null;

  const tooltipKey = documentationTooltipKey(ownerType);
  const label =
    count > 1 ? t('documentation_badge_hint', { count }) : t(tooltipKey);

  const onClick = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const ctx = getDocumentationContext();
    if (!ctx) return;
    toggleDocumentationSidebar({
      ownerType,
      ownerId,
      ownerName,
      documentations,
    });
  };

  return (
    <NodeTooltip label={label}>
      <Box as="span" display="inline-flex" data-docs-sidebar-trigger>
        <ActionIconButton
          onClick={onClick}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label={label}
          position="relative"
        >
          <FileText size={12} />
        </ActionIconButton>
      </Box>
    </NodeTooltip>
  );
}
