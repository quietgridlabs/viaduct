import {
  QUACK_BILL,
  QUACK_BODY,
  QUACK_EYE,
  QUACK_HEAD,
  QUACK_PUPIL,
  QUACK_TAIL,
  QUACK_WING,
} from '@/ico/quackDuck';
import type { QuackDuckArtProps } from './types';

/** Duck silhouette only — no <svg> wrapper, so the spinner can reuse it. */
export function QuackDuckArt({ palette }: QuackDuckArtProps) {
  return (
    <>
      {/* Outline first, fill second. SVG strokes every shape in full, so a
          stroked group draws the seams where tail, body and head overlap —
          an arc across the duck's neck. Painting the fills afterwards buries
          the inner half of each stroke and leaves only the outer silhouette. */}
      {palette.outline ? (
        <g fill="none" stroke={palette.outline} strokeWidth={6} strokeLinejoin="round">
          <path d={QUACK_TAIL} />
          <path d={QUACK_BODY} />
          <circle {...QUACK_HEAD} />
        </g>
      ) : null}
      <g fill={palette.body}>
        <path d={QUACK_TAIL} />
        <path d={QUACK_BODY} />
        <circle {...QUACK_HEAD} />
      </g>
      <path d={QUACK_BILL} fill={palette.bill} />
      <path d={QUACK_WING} fill={palette.wing} />
      <circle {...QUACK_EYE} fill={palette.eye} />
      <circle {...QUACK_PUPIL} fill={palette.pupil} />
    </>
  );
}
