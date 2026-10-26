/**
 * Canvas keyboard shortcuts — what the modal lists, and what the handler
 * wires. Kept as data so the help dialog and the binding stay one source.
 *
 * Action chords always go through Ctrl/⌘ so a bare letter never fires while
 * someone is about to type. Space (hold to pan) and Delete are the exceptions:
 * they are held / destructive-with-selection, not letter keys.
 */

export type CanvasShortcutId =
  | 'pan'
  | 'zoom-in'
  | 'zoom-out'
  | 'fit'
  | 'arrange'
  | 'graph'
  | 'copy'
  | 'paste'
  | 'undo'
  | 'delete'
  | 'multi-select'
  | 'help';

export type CanvasShortcut = {
  id: CanvasShortcutId;
  /** Keycaps after the optional mod, left → right. */
  keys: string[];
  /** Prefix with Ctrl/⌘. */
  mod?: boolean;
  /** Also require Shift (with mod). */
  shift?: boolean;
  /** i18n key for the action label. */
  labelKey: string;
  /** Only listed when the person may edit (arrange/undo) or when the graph exists. */
  when?: 'edit' | 'graph';
};

/** Ctrl on Windows/Linux, ⌘ on Apple — what we print on the keycaps. */
export function modKeyLabel(): string {
  if (typeof navigator === 'undefined') return 'Ctrl';
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
      ?.platform || navigator.platform || '';
  return /Mac|iPhone|iPad|iPod/i.test(platform) ? '⌘' : 'Ctrl';
}

/** Keycaps for one row, resolved for the current platform. */
export function shortcutKeycaps(row: CanvasShortcut, mod = modKeyLabel()): string[] {
  const caps: string[] = [];
  if (row.mod) caps.push(mod);
  if (row.shift) caps.push('Shift');
  caps.push(...row.keys);
  return caps;
}

export const CANVAS_SHORTCUTS: CanvasShortcut[] = [
  { id: 'pan', keys: ['Space'], labelKey: 'shortcut_pan' },
  { id: 'zoom-in', keys: ['='], mod: true, labelKey: 'shortcut_zoom_in' },
  { id: 'zoom-out', keys: ['-'], mod: true, labelKey: 'shortcut_zoom_out' },
  { id: 'fit', keys: ['0'], mod: true, labelKey: 'shortcut_fit' },
  { id: 'arrange', keys: ['A'], mod: true, shift: true, labelKey: 'shortcut_arrange', when: 'edit' },
  { id: 'graph', keys: ['G'], mod: true, labelKey: 'shortcut_graph', when: 'graph' },
  { id: 'copy', keys: ['C'], mod: true, labelKey: 'shortcut_copy' },
  { id: 'paste', keys: ['V'], mod: true, labelKey: 'shortcut_paste', when: 'edit' },
  { id: 'undo', keys: ['Z'], mod: true, labelKey: 'shortcut_undo', when: 'edit' },
  { id: 'delete', keys: ['⌫', 'Del'], labelKey: 'shortcut_delete' },
  { id: 'multi-select', keys: ['Ctrl'], labelKey: 'shortcut_multi_select' },
  { id: 'help', keys: ['/'], mod: true, labelKey: 'shortcut_help' },
];
