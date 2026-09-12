import { Box } from '@chakra-ui/react';
import QuackSpinner from '@components/QuackSpinner';
import {
  getLevelTransitionServerSnapshot,
  getLevelTransitionSnapshot,
  subscribeLevelTransition,
} from '@/state/levelTransition';
import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { FADE_DELAY_MS, FADE_MS } from './constants';

/**
 * Covers the canvas while it swaps one C4 level for another — see
 * `state/levelTransition.ts` for why the flag is raised a frame early.
 *
 * The fade is deliberately delayed. Most level changes finish inside a frame
 * or two, and a spinner that flashes on every click is worse than none; by
 * starting the fade after the delay below, a quick switch mounts this, paints
 * nothing visible, and unmounts. Only a wait long enough to notice grows a
 * spinner.
 *
 * `opacity` is a compositor property, so the fade keeps running even while the
 * main thread is busy building the next level — which is the whole window this
 * exists to cover.
 */
export default function LevelTransitionOverlay() {
  const { t } = useTranslation();
  const pending = useSyncExternalStore(
    subscribeLevelTransition,
    getLevelTransitionSnapshot,
    getLevelTransitionServerSnapshot
  );

  if (!pending) return null;

  return (
    <Box
      position="absolute"
      inset="0"
      display="grid"
      placeItems="center"
      zIndex={6}
      /* The diagram underneath stays visible through it: this is a pause in
         the same view, not a new screen. */
      bg="bg.canvas/70"
      backdropFilter="blur(1.5px)"
      /* Nothing here is clickable, and the canvas below should not be either
         while it is being rebuilt. */
      pointerEvents="all"
      aria-live="polite"
      aria-busy="true"
      data-testid="level-transition-overlay"
      css={{
        opacity: 0,
        animation: `qk-level-fade ${FADE_MS}ms ease-out ${FADE_DELAY_MS}ms forwards`,
        '@media (prefers-reduced-motion: reduce)': {
          animation: `qk-level-fade 1ms linear ${FADE_DELAY_MS}ms forwards`,
        },
      }}
    >
      <QuackSpinner size="xl" label={t('level_switching')} />
    </Box>
  );
}
