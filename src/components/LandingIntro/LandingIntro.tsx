import { Box, Text } from '@chakra-ui/react';
import QuackDuck from '@components/QuackDuck';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import {
  DUCK_LETTER,
  DUCK_OVERLAP_PX,
  DUCK_SIZE,
  FADE_MS,
  HOLD_MS,
  HOP_MS,
  HOPS,
  LETTER_MS,
  LETTER_STAGGER_MS,
  WIDTH_RATIO,
  WORD,
} from './constants';
import { alreadySeen, prefersReducedMotion, remember } from './helpers';

/**
 * First-visit title card.
 *
 * The wordmark is measured to fill most of the window and assembles letter by
 * letter from left to right while the whole line drifts the same way. Shown
 * once per browser: a splash you cannot skip is charming exactly once, and a
 * nuisance every time after.
 */
export default function LandingIntro() {
  const [state, setState] = useState<'hidden' | 'playing' | 'leaving'>(() =>
    alreadySeen() ? 'hidden' : 'playing'
  );
  const overlayRef = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLDivElement>(null);
  const letterRef = useRef<HTMLSpanElement>(null);
  /* Where the duck perches, in card coordinates. */
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);
  /* `scale` is a transform, so it changes what you see and not what the flex
     column measures — the byline has to be given the scaled height, or it lands
     on top of the letters. */
  const [fit, setFit] = useState({ scale: 0, height: 0 });
  const [landed, setLanded] = useState(false);
  const [quacked, setQuacked] = useState(false);

  /* Measured, not guessed: the ratio has to hold at any window width and for
     whatever font actually loaded. */
  useLayoutEffect(() => {
    if (state === 'hidden') return;
    const element = wordRef.current;
    if (!element) return;
    const measure = () => {
      const natural = element.scrollWidth;
      if (!natural) return;
      /* Measured against the card itself, which is the box the word is centred
         in. `innerWidth` is a different number under zoom, a scrollbar or
         device emulation, and fitting to the wrong one puts a letter over the
         edge. */
      const available = overlayRef.current?.clientWidth ?? window.innerWidth;
      const scale = (available * WIDTH_RATIO) / natural;
      setFit({ scale, height: element.offsetHeight * scale });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [state]);

  useEffect(() => {
    if (!landed || !fit.scale) return;
    const perch = () => {
      const letter = letterRef.current;
      const card = overlayRef.current;
      if (!letter || !card) return;
      const l = letter.getBoundingClientRect();
      const c = card.getBoundingClientRect();
      setSpot({ x: l.left + l.width / 2 - c.left, y: l.top - c.top });
    };
    perch();
    window.addEventListener('resize', perch);
    return () => window.removeEventListener('resize', perch);
  }, [landed, fit.scale]);

  /* The duck waits for the letters, hops, and only then says its piece. */
  useEffect(() => {
    if (state !== 'playing' || prefersReducedMotion()) {
      setLanded(true);
      setQuacked(true);
      return;
    }
    const sweep = WORD.length * LETTER_STAGGER_MS + LETTER_MS;
    const perch = window.setTimeout(() => setLanded(true), sweep);
    const quack = window.setTimeout(() => setQuacked(true), sweep + HOP_MS * HOPS);
    return () => {
      window.clearTimeout(perch);
      window.clearTimeout(quack);
    };
  }, [state]);

  useEffect(() => {
    if (state !== 'playing') return;
    const total = prefersReducedMotion()
      ? HOLD_MS
      : WORD.length * LETTER_STAGGER_MS + LETTER_MS + HOLD_MS;
    const leave = window.setTimeout(() => setState('leaving'), total);
    return () => window.clearTimeout(leave);
  }, [state]);

  /* Separate from the one above on purpose: entering `leaving` re-runs that
     effect, and a cleanup there would cancel the very timer that unmounts the
     card — which left it sitting invisibly over the page forever. */
  useEffect(() => {
    if (state !== 'leaving') return;
    const done = window.setTimeout(() => {
      setState('hidden');
      remember();
    }, FADE_MS);
    return () => window.clearTimeout(done);
  }, [state]);

  if (state === 'hidden') return null;

  const reduced = prefersReducedMotion();
  const sweepMs = WORD.length * LETTER_STAGGER_MS + LETTER_MS;

  return (
    <Box
      ref={overlayRef}
      position="fixed"
      inset="0"
      zIndex={4000}
      bg="bg.canvas"
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      overflow="hidden"
      pointerEvents={state === 'leaving' ? 'none' : 'auto'}
      opacity={state === 'leaving' ? 0 : 1}
      transition={`opacity ${FADE_MS}ms ease`}
      cursor="pointer"
      /* Two seconds is short, but not when you came back for one link. */
      onClick={() => setState('leaving')}
      aria-hidden
      data-testid="landing-intro"
    >
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        flexShrink={0}
        w="full"
        style={{ height: fit.height ? `${fit.height}px` : undefined }}
      >
        <Box
          ref={wordRef}
          className={reduced ? undefined : 'qk-intro-sweep'}
          display="flex"
          flexShrink={0}
          whiteSpace="nowrap"
          fontWeight="800"
          letterSpacing="-0.04em"
          lineHeight="1"
          color="fg.default"
          style={{
            fontSize: '18vw',
            /* Hidden until measured — a frame at the wrong size is a jump. */
            transform: fit.scale ? `scale(${fit.scale})` : 'scale(0.001)',
            opacity: fit.scale ? 1 : 0,
            animationDuration: `${sweepMs}ms`,
          }}
        >
          {WORD.split('').map((letter, index) => (
            <Box
              as="span"
              key={`${letter}-${index}`}
              ref={index === DUCK_LETTER ? letterRef : undefined}
              className={reduced ? undefined : 'qk-intro-letter'}
              style={{
                animationDelay: `${index * LETTER_STAGGER_MS}ms`,
                animationDuration: `${LETTER_MS}ms`,
              }}
            >
              {letter}
            </Box>
          ))}
        </Box>
      </Box>

      {/* Outside the wordmark on purpose: inside it, every offset would be
          measured against the unscaled letter box and the duck would sit beside
          the U rather than on it. */}
      {landed && spot ? (
        <Box
          position="absolute"
          left={`${spot.x}px`}
          /* Overlapping the cap slightly: a duck floating above the word looks
             pasted on, one touching it looks perched. */
          top={`${spot.y + DUCK_OVERLAP_PX}px`}
          transform="translate(-50%, -100%)"
          pointerEvents="none"
        >
          <Box position="relative" display="flex" justifyContent="center" pb="6px">
            <Box className={reduced ? undefined : 'qk-intro-duck'}>
              <QuackDuck size={DUCK_SIZE} />
            </Box>

            {quacked ? (
              <Box
                position="absolute"
                bottom="calc(100% + 4px)"
                left="50%"
                transform="translateX(-50%)"
              >
                <Box
                  className="qk-bubble qk-bubble-below"
                  style={{ '--qk-tilt': '-5deg' } as CSSProperties}
                  position="relative"
                  px="12px"
                  py="7px"
                  borderRadius="12px"
                  borderWidth="1.5px"
                  borderColor="border.strong"
                  bg="bg.dialog"
                  color="fg.default"
                  fontSize="sm"
                  fontWeight="700"
                  whiteSpace="nowrap"
                  boxShadow="float"
                >
                  quack quack
                </Box>
              </Box>
            ) : null}
          </Box>
        </Box>
      ) : null}

      <Text
        className={reduced ? undefined : 'qk-intro-byline'}
        fontFamily="mono"
        fontSize={{ base: '10px', md: 'xs' }}
        letterSpacing="0.42em"
        textTransform="uppercase"
        color="fg.subtle"
        mt={{ base: '20px', md: '34px' }}
        style={{ animationDelay: `${sweepMs - 260}ms` }}
      >
        by Quiet Grid Labs
      </Text>
    </Box>
  );
}
