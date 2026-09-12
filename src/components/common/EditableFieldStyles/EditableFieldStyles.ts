import type { SystemStyleObject } from '@chakra-ui/react';

/** Quiet panel field at rest: plain text with a text caret, not a hand. */
export const editableQuietSurface: SystemStyleObject = {
  w: 'full',
  minW: 0,
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'transparent',
  bg: 'transparent',
  boxShadow: 'none',
  cursor: 'text',
  transition: 'background-color 0.12s ease, border-color 0.12s ease',
  _hover: { bg: 'bg.muted' },
  /* Zag marks the preview when it is standing in for an empty value. Without
     this the placeholder is drawn in the same ink as a real one, so "No
     description" reads as the description. Matches the empty hints on the
     rows around it. */
  '&[data-placeholder-shown]': { color: 'fg.subtle' },
};

export const editableQuietFocus: SystemStyleObject = {
  bg: 'bg.subtle',
  borderColor: 'border.focus',
  cursor: 'text',
};
