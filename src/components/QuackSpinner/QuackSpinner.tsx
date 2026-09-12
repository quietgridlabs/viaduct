import { QUACK_ACCENT, quackPalette } from '@/ico/quackDuck';
import { QuackDuckArt } from '@components/QuackDuck';
import { useColorMode } from '@contexts/ColorModeContext';
import { chakra } from '@chakra-ui/react';
import { SPINNER_SIZES } from './constants';
import type { QuackSpinnerProps } from './types';

const ChakraSvg = chakra('svg');

/**
 * Loading spinner: the brand duck bobs inside a sweeping orange arc.
 *
 * Drop-in for chakra's `<Spinner>`. The duck is painted from the same palette
 * as the brand mark rather than in `currentColor`, so it is the same yellow
 * duck everywhere; the amber ring is what carries it on any background. It
 * holds still under `prefers-reduced-motion`.
 *
 * The `.qk-ring` / `.qk-bob` keyframes live in `src/index.css`: a per-instance
 * <style> restarted every other spinner's animation whenever one mounted.
 */
export default function QuackSpinner({
  size = 'md',
  speed,
  label = 'Loading',
  accent = QUACK_ACCENT,
  ...rest
}: QuackSpinnerProps) {
  const px = typeof size === 'number' ? size : SPINNER_SIZES[size];
  const { mode } = useColorMode();
  const palette = quackPalette('mono', mode);

  return (
    <ChakraSvg
      viewBox="0 0 100 100"
      width={`${px}px`}
      height={`${px}px`}
      role="status"
      aria-label={label}
      display="block"
      flexShrink={0}
      style={speed ? ({ '--qk-speed': speed } as React.CSSProperties) : undefined}
      {...rest}
    >
      <circle
        cx={50}
        cy={50}
        r={42}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.16}
        strokeWidth={7}
      />
      <circle
        className="qk-ring"
        cx={50}
        cy={50}
        r={42}
        fill="none"
        stroke={accent}
        strokeWidth={7}
        strokeLinecap="round"
        strokeDasharray="66 198"
      />
      <g className="qk-bob">
        <g transform="translate(17.8 20.9) scale(0.62)">
          <QuackDuckArt palette={palette} />
        </g>
      </g>
    </ChakraSvg>
  );
}
