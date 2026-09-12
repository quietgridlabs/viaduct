import type { QuackPalette, QuackVariant } from '@/ico/quackDuck';
import type { PaletteMode } from '@theme/theme';

export type QuackDuckArtProps = {
  palette: QuackPalette;
};

export type QuackDuckProps = {
  size?: number | string;
  /** `mono` = ink body + orange bill; `solid` = all-orange mark. */
  variant?: QuackVariant;
  mode?: PaletteMode;
  title?: string;
  className?: string;
};
