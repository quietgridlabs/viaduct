import type { ChromeColors } from './theme';

/**
 * One recipe for every text field, select and combobox in the app.
 *
 * Focus is deliberately neutral: a dialog belongs to a C4 level, but the field
 * inside it does not — colouring the outline by level made the same control
 * look different depending on where it was opened from.
 */
export function fieldSurfaceStyles(chrome: ChromeColors) {
  return {
    bg: 'bg.dialog',
    color: 'fg.default',
    borderColor: 'border.input',
    borderRadius: '10px',
    boxShadow: chrome.shadowSm,
    transition: 'border-color 0.12s ease, box-shadow 0.12s ease',
    _hover: { borderColor: 'border.strong', boxShadow: chrome.shadowSm },
    _focus: {
      borderColor: 'border.focus',
      boxShadow: `0 0 0 1px ${chrome.borderFocus}, ${chrome.shadowSm}`,
    },
    _focusVisible: {
      borderColor: 'border.focus',
      boxShadow: `0 0 0 1px ${chrome.borderFocus}, ${chrome.shadowSm}`,
    },
  };
}

/** Same recipe without the raised shadow — for controls sitting inside a field. */
export function fieldSurfaceFlatStyles(chrome: ChromeColors) {
  return {
    ...fieldSurfaceStyles(chrome),
    boxShadow: 'none',
    _hover: { borderColor: 'border.strong' },
    _focus: {
      borderColor: 'border.focus',
      boxShadow: `0 0 0 1px ${chrome.borderFocus}`,
    },
    _focusVisible: {
      borderColor: 'border.focus',
      boxShadow: `0 0 0 1px ${chrome.borderFocus}`,
    },
  };
}
