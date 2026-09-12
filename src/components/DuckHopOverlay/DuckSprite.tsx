import QuackBubble from '@components/QuackBubble';
import QuackDuck from '@components/QuackDuck';
import { Box } from '@chakra-ui/react';
import { DUCK_GLIDE_MS, DUCK_SIZE } from './constants';
import type { DuckSpriteProps } from './types';

/** The duck herself: perched, facing somewhere, occasionally saying so. */
export default function DuckSprite({
  at,
  facing,
  glide,
  hopTick,
  rubberHop,
  phase,
  quip,
}: DuckSpriteProps) {
  return (
    <Box
      position="absolute"
      top="0"
      left="0"
      lineHeight={0}
      style={{
        /* Position rides on the transform so the trip can be animated;
           `top`/`left` would repaint every frame and cannot be eased. */
        transform: `translate(${at.x}px, ${at.y}px) translate(-50%, calc(-100% - 3px))`,
        transition: glide
          ? `transform ${DUCK_GLIDE_MS}ms cubic-bezier(0.34, 0.9, 0.3, 1)`
          : 'none',
      }}
    >
      <Box
        style={{
          transform: `scaleX(${facing.flip ? -1 : 1}) rotate(${facing.rotate}deg)`,
          transition: 'transform 200ms ease',
        }}
      >
        <Box
          key={hopTick}
          className={
            rubberHop
              ? 'qk-duck-rubber-hop'
              : phase === 'playing'
                ? 'qk-duck-idle-perch'
                : undefined
          }
        >
          <QuackDuck size={DUCK_SIZE} />
        </Box>
      </Box>

      {quip ? (
        <Box
          position="absolute"
          bottom="calc(100% + 10px)"
          left="50%"
          transform="translateX(-50%)"
          pointerEvents="none"
        >
          <QuackBubble quip={quip} side="above" />
        </Box>
      ) : null}
    </Box>
  );
}
