import { Box, chakra } from '@chakra-ui/react';
import QuackDuck from '@components/QuackDuck';
import QuackBubble, { rollQuackTilt } from '@components/QuackBubble';
import {
  isDuckHopActive,
  subscribeDuckHop,
} from '@/state/duckHopGame';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  BUBBLE_MS,
  ESCAPE_ODDS,
  ESCAPE_STEPS,
  PEEK_LINE,
  QUACK_ERRANDS,
  RETURN_LINE,
} from './constants';
import EscapingDuck from './EscapingDuck';
import { prefersReducedMotion } from './helpers';
import type { Anchor, EscapePhase, NavDuckProps, Quip } from './types';

const DuckButton = chakra('button');

/**
 * The brand duck, but squeezable: it hops on hover and blurts out a cartoon
 * speech bubble when clicked, tilted at a fresh angle every time. Every so
 * often it instead bails out of the navbar entirely, swims off screen, and
 * comes back to nag you about the donate button.
 */
export default function NavDuck({ size = 22 }: NavDuckProps) {
  const [quip, setQuip] = useState<Quip | null>(null);
  const [phase, setPhase] = useState<EscapePhase | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const steps = useRef<ReturnType<typeof setTimeout>[]>([]);
  const seq = useRef(0);

  const clearSteps = useCallback(() => {
    steps.current.forEach(clearTimeout);
    steps.current = [];
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      clearSteps();
    },
    [clearSteps]
  );

  const say = useCallback((text: string, ms = BUBBLE_MS) => {
    seq.current += 1;
    setQuip({ id: seq.current, text, tilt: rollQuackTilt() });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setQuip(null), ms);
  }, []);

  const errand = useCallback(() => {
    setQuip((prev) => {
      const pool = QUACK_ERRANDS.filter((e) => `quack quack, ${e}!` !== prev?.text);
      seq.current += 1;
      return {
        id: seq.current,
        text: `quack quack, ${pool[Math.floor(Math.random() * pool.length)]}!`,
        tilt: rollQuackTilt(),
      };
    });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setQuip(null), BUBBLE_MS);
  }, []);

  /** Walk the escapade one step at a time, cueing the lines as they land. */
  const escape = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return errand();

    setQuip(null);
    if (timer.current) clearTimeout(timer.current);
    setAnchor({ top: rect.top, left: rect.left });

    let at = 0;
    ESCAPE_STEPS.forEach((step) => {
      steps.current.push(
        setTimeout(() => {
          setPhase(step.phase);
          if (step.phase === 'peek') say(PEEK_LINE, step.move + step.hold);
          if (step.phase === 'settle') say(RETURN_LINE);
          if (step.phase === 'settle') {
            steps.current.push(
              setTimeout(() => {
                setPhase(null);
                setAnchor(null);
              }, step.move)
            );
          }
        }, at)
      );
      at += step.move + step.hold;
    });
  }, [errand, say]);

  const quack = useCallback(() => {
    if (phase) return;
    if (!prefersReducedMotion() && Math.random() < ESCAPE_ODDS) return escape();
    errand();
  }, [errand, escape, phase]);

  const away = phase !== null && phase !== 'settle';
  const duckHopAway = useSyncExternalStore(subscribeDuckHop, () => isDuckHopActive());

  return (
    <Box position="relative" flexShrink={0} display={{ base: 'none', sm: 'block' }}>
      <DuckButton
        ref={buttonRef}
        type="button"
        className="qk-navduck"
        data-nav-duck
        aria-label="Quiet Grid Labs"
        onClick={quack}
        lineHeight={0}
        p="3px"
        borderRadius="8px"
        bg="transparent"
        cursor="pointer"
        _hover={{ bg: 'bg.list.hover' }}
      >
        <Box className="qk-navduck-hop" visibility={phase || duckHopAway ? 'hidden' : 'visible'}>
          <QuackDuck size={size} />
        </Box>
      </DuckButton>

      {quip && !away ? (
        <Box
          position="absolute"
          top="calc(100% + 9px)"
          left="50%"
          transform="translateX(-50%)"
          zIndex={1}
          pointerEvents="none"
        >
          <QuackBubble quip={quip} side="below" />
        </Box>
      ) : null}

      {phase && anchor ? (
        <EscapingDuck anchor={anchor} phase={phase} size={size} quip={away ? quip : null} />
      ) : null}
    </Box>
  );
}
