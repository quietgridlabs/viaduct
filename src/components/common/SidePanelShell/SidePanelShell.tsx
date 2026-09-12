import { useGlassSurface } from '@theme/glassSurfaces';
import {
  APP_FOOTER_OFFSET,
  SIDE_PANEL_INSET,
  SIDE_PANEL_TOP,
  SIDE_PANEL_Z,
  sidePanelHeight,
} from '@theme/sidePanelLayout';
import { Box, HStack, Separator, Text, VStack } from '@chakra-ui/react';
import { ToolbarIconButton, TOOLBAR_ICON_SIZE } from '@components/common/ToolbarIconButton';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { ReactNode, Ref } from 'react';

export type SidePanelShellProps = {
  title: ReactNode;
  subtitle?: string;
  onClose: () => void;
  /** Show header action control. Default true. */
  closable?: boolean;
  /** When set, show a collapse chevron instead of close (X). */
  collapseDirection?: 'left' | 'right';
  /** Accessible label for the header action button. */
  closeLabel?: string;
  children: ReactNode;
  /** Extra chips / actions under the title row */
  headerMeta?: ReactNode;
  /** Controls that belong to the panel as a whole — sorting, filtering.
   *  Sits in the header row, left of the collapse control. */
  headerActions?: ReactNode;
  footer?: ReactNode;
  /**
   * Fixed floating inset panel (modal-from-edge). Default true.
   * Set false for inline embedding only.
   */
  overlay?: boolean;
  /** Fill a flex parent (docs/sequence split panes). Requires overlay={false}. */
  embedded?: boolean;
  /** Which edge the overlay attaches to. */
  side?: 'left' | 'right';
  /** @deprecated Use overlay — kept for callers that still pass variant. */
  variant?: 'floating' | 'docked';
  width?: string | number;
  /** Floor width when `width="full"` (embedded grow). */
  minWidth?: string | number;
  /** Overlay stacking level. Defaults to the shared side-panel layer. */
  zIndex?: number;
  panelRef?: Ref<HTMLDivElement>;
  /** data-* for outside-click exclusions */
  'data-panel'?: string;
};

/**
 * Shared chrome for all side panels — floating glass modal from the screen edge.
 */
export default function SidePanelShell({
  title,
  subtitle,
  onClose,
  closable = true,
  collapseDirection,
  closeLabel = 'Close',
  children,
  headerMeta,
  headerActions,
  footer,
  overlay = true,
  embedded = false,
  side = 'right',
  variant,
  width,
  minWidth,
  zIndex = SIDE_PANEL_Z,
  panelRef,
  'data-panel': dataPanel,
}: SidePanelShellProps) {
  const glass = useGlassSurface();
  const isOverlay = overlay || variant === 'docked' || variant === 'floating';
  const panelWidth = width ?? '320px';
  const fillEmbedded = embedded && !isOverlay;
  const panelSurface = fillEmbedded ? glass.editorPanel : glass.sidePanel;

  const shell = (
    <Box
      ref={panelRef}
      data-panel={dataPanel}
      w={isOverlay ? 'full' : fillEmbedded ? 'full' : (width ?? '380px')}
      maxW="100%"
      maxH={isOverlay ? sidePanelHeight : fillEmbedded ? 'none' : 'min(70vh, 640px)'}
      h={isOverlay || fillEmbedded ? (fillEmbedded ? 'full' : sidePanelHeight) : undefined}
      flex={fillEmbedded ? '1' : undefined}
      minH={fillEmbedded ? 0 : undefined}
      display="flex"
      flexDirection="column"
      color="fg.default"
      overflow="hidden"
      {...panelSurface}
    >
      <HStack
        px="16px"
        pt="16px"
        pb={headerMeta ? '10px' : '12px'}
        gap="8px"
        align="center"
        flexShrink={0}
      >
        <VStack align="start" gap="2px" flex="1" minW={0}>
          {typeof title === 'string' ? (
            <Text fontSize="md" fontWeight="600" letterSpacing="-0.02em" lineClamp={1}>
              {title}
            </Text>
          ) : (
            title
          )}
          {subtitle ? (
            <Text fontSize="xs" color="fg.muted" lineClamp={1}>
              {subtitle}
            </Text>
          ) : null}
        </VStack>
        {headerActions}
        <ToolbarIconButton
          onClick={onClose}
          aria-label={closeLabel}
          title={closeLabel}
          display={closable ? 'inline-flex' : 'none'}
        >
          {collapseDirection === 'left' ? (
            <ChevronLeft size={TOOLBAR_ICON_SIZE} />
          ) : collapseDirection === 'right' ? (
            <ChevronRight size={TOOLBAR_ICON_SIZE} />
          ) : (
            <X size={TOOLBAR_ICON_SIZE} />
          )}
        </ToolbarIconButton>
      </HStack>
      {headerMeta ? (
        <Box px="16px" pb="12px" flexShrink={0}>
          {headerMeta}
        </Box>
      ) : null}
      <Separator borderColor="border.glass" opacity={0.9} flexShrink={0} />
      <Box
        flex="1"
        overflow={fillEmbedded ? 'hidden' : 'auto'}
        minH={0}
        display={fillEmbedded ? 'flex' : 'block'}
        flexDirection={fillEmbedded ? 'column' : undefined}
        css={glass.scrollbar}
      >
        {children}
      </Box>
      {footer ? (
        <>
          <Separator borderColor="border.glass" opacity={0.9} flexShrink={0} />
          <Box px="16px" py="12px" flexShrink={0}>
            {footer}
          </Box>
        </>
      ) : null}
    </Box>
  );

  if (!isOverlay) {
    if (fillEmbedded) {
      const grow = width === 'full';
      return (
        <Box
          flex={grow ? '1 1 0%' : undefined}
          flexShrink={grow ? 1 : 0}
          w={grow ? undefined : (width ?? '380px')}
          maxW="100%"
          minW={grow ? (minWidth ?? '280px') : undefined}
          minH={0}
          h="full"
          display="flex"
          flexDirection="column"
          pointerEvents="auto"
        >
          {shell}
        </Box>
      );
    }
    return shell;
  }

  const edgeProps =
    side === 'left'
      ? { left: SIDE_PANEL_INSET, right: undefined }
      : { right: SIDE_PANEL_INSET, left: undefined };

  return (
    <Box
      position="fixed"
      top={SIDE_PANEL_TOP}
      bottom={`calc(${APP_FOOTER_OFFSET} + ${SIDE_PANEL_INSET})`}
      zIndex={zIndex}
      w={panelWidth}
      maxW={`calc(100vw - 24px)`}
      pointerEvents="auto"
      {...edgeProps}
    >
      {shell}
    </Box>
  );
}

export type PanelListItemProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  /** Trailing controls (edit, etc.). Clicks do not trigger `onClick`. */
  actions?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
};

/** Uniform row for audit issues, sequence diagrams, project lists, etc. */
export function PanelListItem({
  title,
  subtitle,
  meta,
  actions,
  onClick,
  disabled,
  active,
}: PanelListItemProps) {
  const interactive = Boolean(onClick) && !disabled;
  const body = (
    <>
      {meta ? (
        <HStack gap="8px" alignItems="center" mb="4px" minH="18px">
          {meta}
        </HStack>
      ) : null}
      {typeof title === 'string' ? (
        <Text fontSize="sm" fontWeight="600" color="fg.default" lineClamp={2}>
          {title}
        </Text>
      ) : (
        title
      )}
      {subtitle ? (
        typeof subtitle === 'string' ? (
          <Text fontSize="xs" color="fg.muted" mt="2px" lineClamp={2}>
            {subtitle}
          </Text>
        ) : (
          subtitle
        )
      ) : null}
    </>
  );
  const stopRow = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
  };
  return (
    <Box
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      textAlign="left"
      w="full"
      px="14px"
      py="12px"
      borderBottomWidth="1px"
      borderColor="border.glass"
      bg={active ? 'bg.list.selected' : 'transparent'}
      color="inherit"
      cursor={disabled ? 'not-allowed' : interactive ? 'pointer' : 'default'}
      opacity={disabled ? 0.55 : 1}
      transition="background 0.12s ease"
      _hover={
        interactive
          ? { bg: active ? 'bg.list.selected' : 'bg.list.hover' }
          : undefined
      }
      onClick={interactive ? onClick : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      {actions ? (
        <HStack align="center" gap="8px">
          <Box flex="1" minW={0}>
            {body}
          </Box>
          <Box
            flexShrink={0}
            onClick={stopRow}
            onPointerDown={stopRow}
            onKeyDown={stopRow}
          >
            {actions}
          </Box>
        </HStack>
      ) : (
        body
      )}
    </Box>
  );
}

export function PanelEmptyState({ children }: { children: ReactNode }) {
  return (
    <Box px="16px" py="28px">
      <Text fontSize="sm" color="fg.muted" lineHeight="1.55">
        {children}
      </Text>
    </Box>
  );
}
