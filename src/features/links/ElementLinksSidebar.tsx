import { useFlatC4Store } from '@archivisio/c4-modelizer-sdk';
import SidePanelShell, {
  PanelEmptyState,
  PanelListItem,
} from '@components/common/SidePanelShell';
import { getElementLinks } from '@/types/c4Extensions';
import { findById } from '@utils/dataFlows';
import { Box, HStack, Text } from '@chakra-ui/react';
import { ExternalLink } from 'lucide-react';
import LinkKindIcon, { linkKindOf } from '@components/common/LinkKindIcon';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import {
  closeLinksSidebar,
  getLinksSidebar,
  subscribeLinksSidebar,
} from './uiState';

/**
 * The element's links, listed where its diagrams and its documentation are
 * listed — same panel, same list rows, same way of closing.
 *
 * A card used to offer its one link as a button that opened a tab. With
 * several there is nothing sensible for a single button to do, and picking one
 * of them silently would be the worst of the options.
 */
export default function ElementLinksSidebar() {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const sidebar = useSyncExternalStore(subscribeLinksSidebar, getLinksSidebar, () => null);
  const model = useFlatC4Store((s) => s.model);

  const links = useMemo(() => {
    if (!sidebar) return [];
    const found = findById(model, sidebar.ownerId);
    return found ? getElementLinks(found.item) : [];
  }, [sidebar, model]);

  /* Capture phase, like the other two: React Flow stops pane events bubbling,
     so a bubble-phase listener never sees a click on the canvas. */
  useEffect(() => {
    if (!sidebar) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (panelRef.current?.contains(target)) return;
      if (target.closest('[data-links-sidebar-trigger]')) return;
      closeLinksSidebar();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeLinksSidebar();
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [sidebar]);

  if (!sidebar) return null;

  return (
    <SidePanelShell
      panelRef={panelRef}
      data-panel="element-links-list"
      width="300px"
      title={t('element_links')}
      subtitle={sidebar.ownerName}
      onClose={closeLinksSidebar}
    >
      {links.length === 0 ? (
        <PanelEmptyState>{t('element_links_empty')}</PanelEmptyState>
      ) : (
        links.map((link) => (
          <PanelListItem
            key={`${link.url}|${link.label}`}
            title={
              <HStack gap="8px" minW={0}>
                {/* The mark is what somebody scans this list for: the
                    repository among five links on one host. */}
                <Box flexShrink={0} lineHeight={0} color="fg.muted" title={t(`link_kind_${linkKindOf(link)}`)}>
                  <LinkKindIcon kind={linkKindOf(link)} url={link.url} size={14} />
                </Box>
                <Text fontSize="sm" fontWeight="600" color="fg.default" lineClamp={2}>
                  {link.label}
                </Text>
              </HStack>
            }
            subtitle={link.url}
            actions={<ExternalLink size={14} />}
            onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')}
          />
        ))
      )}
    </SidePanelShell>
  );
}
