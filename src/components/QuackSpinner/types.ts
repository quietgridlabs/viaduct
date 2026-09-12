import type { HTMLChakraProps } from '@chakra-ui/react';
import type { SPINNER_SIZES } from './constants';

export type QuackSpinnerSize = keyof typeof SPINNER_SIZES | number;

export type QuackSpinnerProps = Omit<HTMLChakraProps<'svg'>, 'size'> & {
  size?: QuackSpinnerSize;
  /** One full turn of the ring, as a CSS time. */
  speed?: string;
  label?: string;
  /** Ring colour; defaults to the brand amber. The duck keeps its own. */
  accent?: string;
};
