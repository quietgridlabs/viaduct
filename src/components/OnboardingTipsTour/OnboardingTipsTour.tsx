import { useColorMode } from '@contexts/ColorModeContext';
import { Box, Button, HStack, Portal, Text, VStack } from '@chakra-ui/react';
import { CANVAS_CHROME_Z } from '@theme/sidePanelLayout';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  GUEST_TIPS_TOUR_STEPS,
  TIPS_TOUR_CARD_GAP,
  TIPS_TOUR_CARD_WIDTH,
} from './constants';
import { clamp, markTipsTourSeen, queryTourTarget } from './helpers';
import type { OnboardingTipsTourProps, SpotlightRect } from './types';

export default function OnboardingTipsTour({
  open,
  steps = GUEST_TIPS_TOUR_STEPS,
  onClose,
}: OnboardingTipsTourProps) {
  const { t } = useTranslation();
  const { chrome, mode } = useColorMode();
  const [index, setIndex] = useState(0);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);

  const step = steps[index] ?? null;
  const total = steps.length;

  const finish = useCallback(() => {
    markTipsTourSeen();
    onClose();
  }, [onClose]);

  const findNextIndex = useCallback(
    (from: number) => {
      let next = from + 1;
      while (next < steps.length) {
        const s = steps[next];
        if (!s.target || queryTourTarget(s.target)) return next;
        next += 1;
      }
      return null;
    },
    [steps]
  );

  const findPrevIndex = useCallback(
    (from: number) => {
      let prev = from - 1;
      while (prev >= 0) {
        const s = steps[prev];
        if (!s.target || queryTourTarget(s.target)) return prev;
        prev -= 1;
      }
      return null;
    },
    [steps]
  );

  const isLast = findNextIndex(index) === null;

  const goNext = useCallback(() => {
    const next = findNextIndex(index);
    if (next === null) finish();
    else setIndex(next);
  }, [findNextIndex, index, finish]);

  const goBack = useCallback(() => {
    const prev = findPrevIndex(index);
    if (prev !== null) setIndex(prev);
  }, [findPrevIndex, index]);

  useEffect(() => {
    if (!open) {
      setIndex(0);
      setSpotlight(null);
      return;
    }
    let start = 0;
    while (start < steps.length) {
      const s = steps[start];
      if (!s.target || queryTourTarget(s.target)) break;
      start += 1;
    }
    setIndex(start >= steps.length ? 0 : start);
  }, [open, steps]);

  // If current targeted step vanished, jump forward or finish.
  useEffect(() => {
    if (!open || !step) return;
    if (step.target && !queryTourTarget(step.target)) {
      goNext();
    }
  }, [open, step, goNext]);

  const measure = useCallback(() => {
    if (!open || !step?.target) {
      setSpotlight(null);
      return;
    }
    const el = queryTourTarget(step.target);
    if (!el) {
      setSpotlight(null);
      return;
    }
    const navPill = el.closest('[data-nav-pill]') as HTMLElement | null;
    if (navPill) {
      const navRect = navPill.getBoundingClientRect();
      const parsedRadius = Number.parseFloat(window.getComputedStyle(navPill).borderTopLeftRadius || '18');
      setSpotlight({
        rect: navRect,
        pad: 0,
        radius: Number.isFinite(parsedRadius) ? parsedRadius : 18,
      });
      return;
    }
    setSpotlight({
      rect: el.getBoundingClientRect(),
      pad: 8,
      radius: 14,
    });
  }, [open, step]);

  useLayoutEffect(() => {
    measure();
  }, [measure, index]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        finish();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goBack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, finish, goNext, goBack]);

  if (!open || !step || total === 0) return null;

  const hasHole = Boolean(step.target && spotlight?.rect && spotlight.rect.width > 0);
  const hole = hasHole && spotlight
    ? {
        top: spotlight.rect.top - spotlight.pad,
        left: spotlight.rect.left - spotlight.pad,
        width: spotlight.rect.width + spotlight.pad * 2,
        height: spotlight.rect.height + spotlight.pad * 2,
        radius: spotlight.radius,
      }
    : null;

  const cardW = TIPS_TOUR_CARD_WIDTH;
  let cardTop = window.innerHeight / 2 - 80;
  let cardLeft = window.innerWidth / 2 - cardW / 2;
  const gap = TIPS_TOUR_CARD_GAP;
  const placement = step.placement ?? 'bottom';

  if (hole) {
    switch (placement) {
      case 'right':
        cardLeft = hole.left + hole.width + gap;
        cardTop = hole.top + hole.height / 2 - 60;
        break;
      case 'left':
        cardLeft = hole.left - cardW - gap;
        cardTop = hole.top + hole.height / 2 - 60;
        break;
      case 'top':
        cardLeft = hole.left + hole.width / 2 - cardW / 2;
        cardTop = hole.top - 140 - gap;
        break;
      case 'bottom':
      default:
        cardLeft = hole.left + hole.width / 2 - cardW / 2;
        cardTop = hole.top + hole.height + gap;
        break;
    }
  }

  cardLeft = clamp(cardLeft, 12, window.innerWidth - cardW - 12);
  cardTop = clamp(cardTop, 12, window.innerHeight - 160);

  const dim = mode === 'dark' ? 'rgba(0, 0, 0, 0.62)' : 'rgba(15, 39, 68, 0.48)';
  const visibleOrdinal =
    steps.slice(0, index + 1).filter((s) => !s.target || queryTourTarget(s.target)).length;
  const visibleTotal = steps.filter((s) => !s.target || queryTourTarget(s.target)).length;

  return (
    <Portal>
      <Box
        position="fixed"
        inset={0}
        zIndex={CANVAS_CHROME_Z + 100}
        pointerEvents="auto"
        aria-modal="true"
        role="dialog"
        aria-labelledby="tips-tour-title"
      >
        {hole ? (
          <Box
            position="fixed"
            top={`${hole.top}px`}
            left={`${hole.left}px`}
            w={`${hole.width}px`}
            h={`${hole.height}px`}
            borderRadius={`${hole.radius}px`}
            boxShadow={`0 0 0 9999px ${dim}`}
            borderWidth="2px"
            borderColor="brand.emphasis"
            pointerEvents="auto"
            transition="top 0.2s ease, left 0.2s ease, width 0.2s ease, height 0.2s ease"
          />
        ) : (
          <Box position="fixed" inset={0} bg={dim} />
        )}

        <Box
          position="fixed"
          top={`${cardTop}px`}
          left={`${cardLeft}px`}
          w={`${cardW}px`}
          maxW="calc(100vw - 24px)"
          bg="bg.dialog"
          color="fg.default"
          borderWidth="1px"
          borderColor="border.default"
          borderRadius="10px"
          boxShadow={chrome.shadow}
          p="16px"
          zIndex={1}
        >
          <VStack align="stretch" gap="10px">
            <HStack justify="space-between" align="center">
              <Text
                fontSize="10px"
                fontWeight="700"
                letterSpacing="0.08em"
                textTransform="uppercase"
                color="fg.brand.emphasis"
              >
                {t('tips_tour_badge', {
                  current: visibleOrdinal,
                  total: Math.max(visibleTotal, 1),
                })}
              </Text>
              <Button
                variant="ghost"
                size="xs"
                color="fg.subtle"
                onClick={finish}
                _hover={{ color: 'fg.muted', bg: 'bg.list.hover' }}
              >
                {t('tips_tour_skip')}
              </Button>
            </HStack>

            <Text id="tips-tour-title" fontWeight="600" fontSize="md" lineHeight="1.35">
              {t(step.titleKey)}
            </Text>
            <Text fontSize="sm" color="fg.muted" lineHeight="1.55">
              {t(step.bodyKey)}
            </Text>

            <HStack justify="space-between" pt="4px">
              <Button
                variant="ghost"
                size="sm"
                disabled={index === 0}
                onClick={goBack}
                color="fg.muted"
                _hover={{ bg: 'bg.list.hover' }}
              >
                {t('tips_tour_back')}
              </Button>
              <Button
                size="sm"
                bg="brand.emphasis"
                color="white"
                fontWeight="600"
                _hover={{ opacity: 0.92 }}
                onClick={goNext}
              >
                {isLast ? t('tips_tour_finish') : t('tips_tour_next')}
              </Button>
            </HStack>
          </VStack>
        </Box>
      </Box>
    </Portal>
  );
}
