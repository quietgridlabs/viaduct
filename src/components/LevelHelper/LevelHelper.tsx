import QuackDuck from '@components/QuackDuck';
import { useColorMode } from '@contexts/ColorModeContext';
import { useGlassSurface } from '@theme/glassSurfaces';
import { Box, Button, HStack, Text, VStack } from '@chakra-ui/react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { trackProductEvent } from '@/metrics';
import {
  HELPER_BUTTON_SIZE,
  HELPER_DUCK_SIZE,
  HELPER_ICON_SIZE,
  HELPER_PANEL_WIDTH,
  HELPER_TIP_MIN_HEIGHT,
} from './constants';
import { stepTip, tipKeys } from './helpers';
import type { LevelHelperProps } from './types';

/**
 * The duck, in its paperclip years: a small panel explaining what the current
 * C4 level is for, with one short tip at a time.
 */
export default function LevelHelper({ level }: LevelHelperProps) {
  const { t } = useTranslation();
  const glass = useGlassSurface();
  /* React Flow stamps a `light` class on its container, and chakra's semantic
     tokens read that as the light theme — inside the canvas they resolve to the
     wrong palette. The canvas chrome uses these JS colours for the same reason. */
  const { chrome } = useColorMode();
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const tips = useMemo(() => tipKeys(level).map((key) => t(key)), [level, t]);

  /* A tip index from another level would point at nothing. */
  useEffect(() => {
    setTip(0);
  }, [level]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (target instanceof Element && panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [open]);

  const step = (delta: number) => setTip((i) => stepTip(i, delta, tips.length));

  return (
    <Box ref={panelRef} className="nopan nodrag" display="flex" flexDirection="column" alignItems="flex-end" gap="8px">
      {open ? (
        <VStack
          align="stretch"
          gap="8px"
          w={HELPER_PANEL_WIDTH}
          px="14px"
          py="12px"
          data-testid="level-helper-panel"
          color={chrome.textPrimary}
          {...glass.dialog}
        >
          <HStack justify="space-between" align="flex-start" gap="8px">
            <Text fontWeight="700" fontSize="sm" color={chrome.textPrimary}>
              {t(`helper_${level}_title`)}
            </Text>
            <Button
              size="xs"
              variant="ghost"
              color={chrome.textMuted}
              /* An explicit `color` overrides what the ghost variant would do on
                 hover, so the feedback has to be spelled out — without it the
                 control looks dead, which is hardest to spot on the dark board. */
              _hover={{ bg: 'bg.list.hover', color: 'fg.default' }}
              aria-label={t('close')}
              onClick={() => setOpen(false)}
              mt="-4px"
              mr="-6px"
            >
              <X size={HELPER_ICON_SIZE} />
            </Button>
          </HStack>

          <Text fontSize="xs" color={chrome.textSecondary} lineHeight="1.5">
            {t(`helper_${level}_purpose`)}
          </Text>

          <Box
            borderTopWidth="1px"
            borderColor={chrome.border}
            pt="10px"
            /* Fixed height: tips differ in length and the panel must not jump
               as you page through them. */
            minH={HELPER_TIP_MIN_HEIGHT}
          >
            <Text fontSize="sm" lineHeight="1.5" color={chrome.textPrimary}>
              {tips[tip]}
            </Text>
          </Box>

          <HStack justify="space-between" gap="8px">
            <Button
              size="xs"
              variant="ghost"
              color={chrome.textSecondary}
              _hover={{ bg: 'bg.list.hover', color: 'fg.default' }}
              aria-label={t('helper_prev')}
              onClick={() => step(-1)}
            >
              <ChevronLeft size={HELPER_ICON_SIZE} />
            </Button>
            <Text fontSize="xs" color={chrome.textMuted}>
              {tip + 1} / {tips.length}
            </Text>
            <Button
              size="xs"
              variant="ghost"
              color={chrome.textSecondary}
              _hover={{ bg: 'bg.list.hover', color: 'fg.default' }}
              aria-label={t('helper_next')}
              onClick={() => step(1)}
            >
              <ChevronRight size={HELPER_ICON_SIZE} />
            </Button>
          </HStack>
        </VStack>
      ) : null}

      <Button
        data-testid="level-helper-button"
        aria-label={t('helper_button')}
        title={t('helper_button')}
        onClick={() =>
          setOpen((v) => {
            if (!v) trackProductEvent('helper.opened', { level });
            return !v;
          })
        }
        h={HELPER_BUTTON_SIZE}
        minW={HELPER_BUTTON_SIZE}
        px="0"
        cursor="pointer"
        {...glass.floatBar}
        borderRadius="full"
        _hover={{ bg: 'bg.list.hover' }}
      >
        <QuackDuck size={HELPER_DUCK_SIZE} />
      </Button>
    </Box>
  );
}
