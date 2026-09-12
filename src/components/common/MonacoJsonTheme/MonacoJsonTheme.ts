import type * as Monaco from 'monaco-editor';
import type { PaletteMode } from '@theme/theme';

/**
 * One JSON theme pair for every Monaco in the app.
 *
 * Monaco keeps themes globally, so registering them twice from two components
 * is harmless — but defining them twice is how the editor and the viewer end up
 * looking subtly different.
 */
export const JSON_SURFACE = { light: '#f6f8fa', dark: '#0d1117' } as const;

export function registerJsonThemes(monaco: typeof Monaco): void {
  monaco.editor.defineTheme('c4-json-light', {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': JSON_SURFACE.light,
      'editor.lineHighlightBackground': '#00000008',
    },
  });
  monaco.editor.defineTheme('c4-json-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': JSON_SURFACE.dark,
      'editor.lineHighlightBackground': '#ffffff0a',
    },
  });
}

export function jsonThemeName(mode: PaletteMode): string {
  return mode === 'light' ? 'c4-json-light' : 'c4-json-dark';
}

export function jsonSurface(mode: PaletteMode): string {
  return mode === 'light' ? JSON_SURFACE.light : JSON_SURFACE.dark;
}
