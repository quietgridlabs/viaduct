import { quackPalette, QUACK_VIEWBOX } from '@/ico/quackDuck';
import { useColorMode } from '@contexts/ColorModeContext';
import { QuackDuckArt } from './QuackDuckArt';
import type { QuackDuckProps } from './types';

/** Quiet Grid Labs duck mark — graphite body, orange bill, both color modes. */
export default function QuackDuck({
  size = 32,
  variant = 'mono',
  mode: modeProp,
  title = 'Quiet Grid Labs',
  className,
}: QuackDuckProps) {
  const { mode: ctxMode } = useColorMode();
  const palette = quackPalette(variant, modeProp ?? ctxMode);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={QUACK_VIEWBOX}
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={className}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <QuackDuckArt palette={palette} />
    </svg>
  );
}
