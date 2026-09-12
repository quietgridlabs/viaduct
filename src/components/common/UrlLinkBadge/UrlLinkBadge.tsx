import { Box } from '@chakra-ui/react';
import { ExternalLink } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionIconButton, NodeTooltip } from '@components/common/C4BlockStyled';
import { getElementLinks } from '@/types/c4Extensions';
import { toggleLinksSidebar } from '@/features/links/uiState';

type Props = {
  item: unknown;
  ownerName: string;
};

/**
 * Action button when the element has links — opens the list beside the canvas.
 *
 * It used to open the one link in a new tab, which cannot survive a list: with
 * three links there is nothing a single click can sensibly do, and picking the
 * first without saying so would be the worst answer available. The panel is
 * the same one the diagrams and the documentation open, because this is the
 * same kind of thing — several of something attached to a card.
 */
export default function UrlLinkBadge({ item, ownerName }: Props) {
  const { t } = useTranslation();
  const links = getElementLinks(item);
  if (!links.length) return null;

  const label = t('element_links_count', { count: links.length });
  const id = (item as { id?: string })?.id;

  const onClick = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!id) return;
    toggleLinksSidebar({ ownerId: id, ownerName });
  };

  return (
    <NodeTooltip label={label}>
      <Box as="span" display="inline-flex" data-testid="block-url-button" data-links-sidebar-trigger>
        <ActionIconButton
          onClick={onClick}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label={label}
        >
          <ExternalLink size={12} />
        </ActionIconButton>
      </Box>
    </NodeTooltip>
  );
}
