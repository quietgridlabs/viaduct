/**
 * The states a UI element can owe, and which of them to offer for which kind
 * of element.
 *
 * The full catalogue is a reference; the model holds a contract of
 * differences. A `@state` earns its line when the element draws differently in
 * it, when there is already a branch in the code for it, or when it is owed
 * regardless of what the designer drew — a control has to handle `disabled`,
 * `loading` and `error` whether or not there is a frame for them. Anything
 * else is either a gap at implementation time (`selected` quietly built as
 * `hover`) or noise in the model (twelve states on a paragraph of text).
 *
 * So the offer depends on what the element is. A select is offered `selected`
 * and `focus`; a label is offered `default` and told the rest is a click away.
 */

export type StateTier = 'core' | 'interactive' | 'data' | 'occasional';

export type StateEntry = {
  name: string;
  /** When this state is needed — the reference half of the catalogue. */
  when: string;
  tier: StateTier;
};

export const STATE_CATALOGUE: StateEntry[] = [
  { name: 'default', when: 'At rest. Every element has one.', tier: 'core' },
  { name: 'hover', when: 'A pointer over it, on desktop.', tier: 'interactive' },
  { name: 'focus', when: 'Reached from the keyboard. Accessibility owes this one.', tier: 'interactive' },
  { name: 'active', when: 'Being pressed.', tier: 'interactive' },
  { name: 'selected', when: 'Chosen, in a list, a toggle or a set of tabs.', tier: 'interactive' },
  { name: 'disabled', when: 'Cannot be used right now. Owed by every control, drawn or not.', tier: 'core' },
  { name: 'loading', when: 'Waiting for data. Owed by anything that fetches, drawn or not.', tier: 'core' },
  { name: 'empty', when: 'No data yet — the state a first-time user sees.', tier: 'data' },
  { name: 'error', when: 'A failure, or a validation message. Owed by anything that can fail.', tier: 'core' },
  { name: 'success', when: 'After an action, briefly. Rare.', tier: 'data' },
  { name: 'readonly', when: 'Shown but not editable.', tier: 'occasional' },
  { name: 'expanded', when: 'Opened — a section, a row, a tree node.', tier: 'occasional' },
  { name: 'collapsed', when: 'Closed — the other half of expanded.', tier: 'occasional' },
  { name: 'dragging', when: 'Being moved.', tier: 'occasional' },
];

export type WidgetKind = 'control' | 'choice' | 'display' | 'container' | 'text' | 'unknown';

const TEXT_RE = /\b(text|label|heading|title|caption|paragraph|copy|icon|badge|tag|chip|avatar|divider|separator)\b/i;
const CHOICE_RE =
  /\b(select|dropdown|picker|list|option|tab|tabs|toggle|switch|checkbox|radio|menu|combobox|segment|chooser|tree)\b/i;
const CONTROL_RE =
  /\b(button|btn|input|field|form|link|slider|stepper|textarea|search|upload|control|cta|action)\b/i;
const CONTAINER_RE =
  /\b(layout|frame|container|page|screen|view|section|panel|card|modal|dialog|drawer|sheet|grid|table|feed|wrapper|region|area|header|footer|sidebar|nav)\b/i;

/**
 * What kind of thing this is, read from the name.
 *
 * Names are how people already tell these apart — nobody calls a paragraph
 * "Submit" or a button "Body copy" — so a guess from the name is right far
 * more often than a flat list is useful, and it is only a guess about what to
 * *offer*. Nothing is refused because of it.
 */
export function widgetKind(name: string): WidgetKind {
  const text = String(name || '');
  if (!text.trim()) return 'unknown';
  if (CHOICE_RE.test(text)) return 'choice';
  if (CONTROL_RE.test(text)) return 'control';
  if (TEXT_RE.test(text)) return 'text';
  if (CONTAINER_RE.test(text)) return 'container';
  return 'unknown';
}

/**
 * What to put in front of somebody, and what to keep a click away.
 *
 * `offered` is the realistic minimum for this kind of element; `more` is the
 * rest of the catalogue. The split is the whole point: twelve chips on a label
 * teach people to ignore chips, and three chips on a select that leave out
 * `selected` teach them to build it as `hover`.
 */
export function suggestStates(
  name: string,
  present: string[]
): { kind: WidgetKind; offered: StateEntry[]; more: StateEntry[] } {
  const kind = widgetKind(name);
  const have = new Set(present.map((entry) => entry.trim().toLowerCase()));

  const front = new Set<string>(
    kind === 'choice'
      ? ['default', 'hover', 'focus', 'selected', 'disabled', 'loading']
      : kind === 'control'
        ? ['default', 'hover', 'focus', 'active', 'disabled', 'loading', 'error']
        : kind === 'text'
          ? ['default']
          : kind === 'container'
            ? ['default', 'loading', 'empty', 'error']
            : ['default', 'hover', 'disabled', 'loading', 'empty', 'error']
  );

  const remaining = STATE_CATALOGUE.filter((entry) => !have.has(entry.name));
  return {
    kind,
    offered: remaining.filter((entry) => front.has(entry.name)),
    more: remaining.filter((entry) => !front.has(entry.name)),
  };
}

/** The states a control owes whether or not anybody drew them. */
const OWED_BY_CONTROLS = ['disabled', 'loading', 'error'];

/**
 * What an interactive element has left out that it is going to need anyway.
 *
 * Not an error and not a blocker: the designer drew one frame, and that is
 * normal. But a control without `disabled` or `loading` in its contract is a
 * control whose implementer will decide those two on the spot, and the point
 * of writing states down is that nobody decides them on the spot.
 */
export function owedStatesMissing(name: string, present: string[]): string[] {
  const kind = widgetKind(name);
  if (kind !== 'control' && kind !== 'choice') return [];
  const have = new Set(present.map((entry) => entry.trim().toLowerCase()));
  return OWED_BY_CONTROLS.filter((state) => !have.has(state));
}
