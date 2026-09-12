import { Box } from '@chakra-ui/react';
import QuackDuck from '@components/QuackDuck';
import QuackBubble from '@components/QuackBubble';
import { CANVAS_CHROME_Z } from '@theme/sidePanelLayout';
import { createPortal } from 'react-dom';
import {
  DROP_Y,
  OFFSCREEN_MARGIN,
  PADDLE,
  PEEK_VISIBLE,
} from './constants';
import type { EscapePhase, EscapingDuckProps } from './types';

/**
 * The runaway copy of the duck. Rendered into `body` at the spot the real one
 * occupies, so nothing in the floating bar can clip it on its way out.
 */
export default function EscapingDuck({ anchor, phase, size, quip }: EscapingDuckProps) {
  if (typeof document === 'undefined') return null;

  const offX = window.innerWidth - anchor.left + OFFSCREEN_MARGIN;
  const peekX = window.innerWidth - anchor.left - PEEK_VISIBLE;

  const motion: Record<EscapePhase, { x: number; y: number; ms: number; ease: string }> = {
    drop: { x: 0, y: DROP_Y, ms: 700, ease: 'cubic-bezier(0.3, 0.7, 0.4, 1.35)' },
    out: { x: offX, y: DROP_Y, ms: 1700, ease: PADDLE },
    gone: { x: offX, y: DROP_Y, ms: 0, ease: 'linear' },
    peek: { x: peekX, y: DROP_Y, ms: 750, ease: 'cubic-bezier(0.2, 0.9, 0.3, 1.2)' },
    retreat: { x: offX, y: DROP_Y, ms: 900, ease: 'cubic-bezier(0.45, 0.05, 0.75, 0.5)' },
    /* Same distance, duration and curve as `out`: the trip home paddles at the
       speed it left at, moment for moment, instead of snapping back. */
    back: { x: 0, y: DROP_Y, ms: 1700, ease: PADDLE },
    settle: { x: 0, y: 0, ms: 700, ease: 'cubic-bezier(0.3, 0.7, 0.4, 1.5)' },
  };

  const { x, y, ms, ease } = motion[phase];
  const swimming = phase === 'out' || phase === 'retreat' || phase === 'back';
  /* It turns around to head back — and it heckles you over its shoulder, so
     the bill (drawn facing right) points into the window while it peeks. */
  const facingLeft = phase === 'gone' || phase === 'peek' || phase === 'back';

  return createPortal(
    <Box
      position="fixed"
      top={`${anchor.top}px`}
      left={`${anchor.left}px`}
      zIndex={CANVAS_CHROME_Z}
      pointerEvents="none"
      p="3px"
      lineHeight={0}
      style={{
        transform: `translate(${x}px, ${y}px)`,
        transition: ms ? `transform ${ms}ms ${ease}` : 'none',
      }}
    >
      <Box
        style={{
          transform: `scaleX(${facingLeft ? -1 : 1})`,
          transition: 'transform 240ms ease',
        }}
      >
        <Box className={swimming ? 'qk-duck-swim' : undefined}>
          <QuackDuck size={size} />
        </Box>
      </Box>

      {quip ? (
        <Box
          position="absolute"
          top="50%"
          right="calc(100% + 9px)"
          transform="translateY(-50%)"
        >
          <QuackBubble quip={quip} side="left" />
        </Box>
      ) : null}
    </Box>,
    document.body
  );
}
