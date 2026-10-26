import { useColorMode } from '@contexts/ColorModeContext';
import { useGlassSurface } from '@theme/glassSurfaces';
import { Box, HStack, Text, VStack } from '@chakra-ui/react';
import { X } from 'lucide-react';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { CANVAS_SHORTCUTS, modKeyLabel, shortcutKeycaps } from '../shortcuts';
import {
  closeCanvasShortcuts,
  isCanvasShortcutsOpen,
  subscribeCanvasShortcuts,
} from '../shortcutsModal';

type Props = {
  /** Hide the rows that only an editor can use (paste) on a read-only canvas. */
  canEdit?: boolean;
  /** Hide graph when this canvas has no service-graph toggle. */
  canGraph?: boolean;
};

function KeyCap({ label }: { label: string }) {
  const { chrome } = useColorMode();
  return (
    <Box
      as="kbd"
      px="7px"
      py="2px"
      minW="28px"
      textAlign="center"
      fontSize="12px"
      fontWeight="600"
      fontFamily="mono"
      borderRadius="6px"
      borderWidth="1px"
      borderColor="border.default"
      bg="bg.subtle"
      color={chrome.textPrimary}
      boxShadow="0 1px 0 var(--chakra-colors-border-default)"
      lineHeight="1.4"
      whiteSpace="nowrap"
    >
      {label}
    </Box>
  );
}

export default function CanvasShortcutsModal({
  canEdit = true,
  canGraph = true,
}: Props) {
  const open = useSyncExternalStore(
    subscribeCanvasShortcuts,
    isCanvasShortcutsOpen,
    () => false
  );
  const glass = useGlassSurface();
  const { chrome } = useColorMode();
  const { t } = useTranslation();

  const mod = useMemo(() => modKeyLabel(), []);
  const rows = useMemo(
    () =>
      CANVAS_SHORTCUTS.filter((row) => {
        if (row.when === 'edit' && !canEdit) return false;
        if (row.when === 'graph' && !canGraph) return false;
        return true;
      }).map((row) => ({ ...row, keycaps: shortcutKeycaps(row, mod) })),
    [canEdit, canGraph, mod]
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCanvasShortcuts();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!open) return null;

  return (
    <Box
      position="fixed"
      inset={0}
      zIndex={9999}
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="rgba(0,0,0,0.45)"
      style={{ backdropFilter: 'blur(4px)' }}
      onClick={closeCanvasShortcuts}
      data-testid="canvas-shortcuts-modal"
      role="dialog"
      aria-modal="true"
      aria-label={t('shortcuts_title')}
    >
      <Box
        {...glass.sidePanel}
        borderRadius="16px"
        p="28px"
        w="420px"
        maxW="calc(100vw - 32px)"
        maxH="calc(100dvh - 48px)"
        overflowY="auto"
        position="relative"
        onClick={(e) => e.stopPropagation()}
        style={{ color: chrome.textPrimary }}
      >
        <Box
          as="button"
          position="absolute"
          top="14px"
          right="14px"
          display="inline-flex"
          style={{ color: chrome.textMuted, cursor: 'pointer' }}
          aria-label={t('close')}
          data-testid="canvas-shortcuts-modal-close"
          onClick={closeCanvasShortcuts}
        >
          <X size={16} />
        </Box>

        <Text fontWeight="700" fontSize="lg" mb="4px" textWrap="balance">
          {t('shortcuts_title')}
        </Text>
        <Text fontSize="sm" mb="18px" color="fg.muted" textWrap="pretty">
          {t('shortcuts_intro')}
        </Text>

        <VStack gap="6px" align="stretch">
          {rows.map((row) => (
            <HStack
              key={row.id}
              justify="space-between"
              align="center"
              gap="12px"
              px="10px"
              py="8px"
              borderRadius="10px"
              _hover={{ bg: 'bg.list.hover' }}
            >
              <Text fontSize="sm" fontWeight="500" flex="1" minW={0}>
                {t(row.labelKey)}
              </Text>
              <HStack gap="4px" flexShrink={0}>
                {row.keycaps.map((key) => (
                  <KeyCap key={`${row.id}-${key}`} label={key} />
                ))}
              </HStack>
            </HStack>
          ))}
        </VStack>
      </Box>
    </Box>
  );
}
