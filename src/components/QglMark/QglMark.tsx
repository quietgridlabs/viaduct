import {
  QGL_ACCENT,
  QGL_LETTER_DARK,
  QGL_LETTER_LIGHT,
  QGL_OUTER,
  QGL_PATH1,
  QGL_PATH2,
  QGL_VIEWBOX,
} from '@/ico/qglMark';
import { useColorMode } from '@contexts/ColorModeContext';
import { useId } from 'react';
import type { QglMarkProps } from './types';

/** qgl wordmark — dark ink on light chrome, white on dark; turquoise accents stay. */
export default function QglMark({
  size = 32,
  mode: modeProp,
  title = 'qgl',
  className,
}: QglMarkProps) {
  const { mode: ctxMode } = useColorMode();
  const mode = modeProp ?? ctxMode;
  const letter = mode === 'dark' ? QGL_LETTER_DARK : QGL_LETTER_LIGHT;
  const uid = useId().replace(/:/g, '');

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={QGL_VIEWBOX}
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={className}
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        <mask
          id={`${uid}-ink`}
          maskUnits="userSpaceOnUse"
          x={0}
          y={0}
          width={888}
          height={782}
        >
          <rect width={888} height={782} fill="#000" />
          <g transform="translate(0,782) scale(0.1,-0.1)">
            {/* Slightly inset so AA on the old tile edge can't leave a hairline */}
            <g transform="translate(4500,4000) scale(0.985) translate(-4500,-4000)">
              <path fill="#fff" d={QGL_OUTER} />
            </g>
            <path fill="#000" d={QGL_PATH1} />
            <path fill="#000" d={QGL_PATH2} />
          </g>
        </mask>
      </defs>
      <rect width={888} height={782} fill={letter} mask={`url(#${uid}-ink)`} />
      <g mask={`url(#${uid}-ink)`}>
        <rect x={280} y={500} width={175} height={175} fill={QGL_ACCENT} />
        <rect x={445} y={575} width={265} height={145} fill={QGL_ACCENT} />
      </g>
    </svg>
  );
}
