import { owedStatesMissing, suggestStates, widgetKind, STATE_CATALOGUE } from '../designStates';

const names = (entries: { name: string }[]) => entries.map((entry) => entry.name);

describe('what kind of thing an element is, from its name', () => {
  it('tells controls, choices, text and containers apart', () => {
    expect(widgetKind('OK Button')).toBe('control');
    expect(widgetKind('Cities Select')).toBe('choice');
    expect(widgetKind('Temperature Badge')).toBe('text');
    expect(widgetKind('Body text')).toBe('text');
    expect(widgetKind('Layout')).toBe('container');
    expect(widgetKind('Region Form')).toBe('control');
    expect(widgetKind('Something Else')).toBe('unknown');
    expect(widgetKind('')).toBe('unknown');
  });

  /* A "Tab list" is a choice before it is a container; a "Search field" is a
     control before it is text. The more specific word wins. */
  it('lets the more specific word win', () => {
    expect(widgetKind('Sidebar tabs')).toBe('choice');
    expect(widgetKind('Search field')).toBe('control');
  });
});

describe('which states to put in front of somebody', () => {
  it('offers a select the states it is actually built with, selected included', () => {
    const { offered } = suggestStates('Cities Select', ['default']);
    expect(names(offered)).toEqual(['hover', 'focus', 'selected', 'disabled', 'loading']);
  });

  it('offers a button the press and the three it owes', () => {
    const { offered } = suggestStates('Button click', ['hover']);
    expect(names(offered)).toEqual(['default', 'focus', 'active', 'disabled', 'loading', 'error']);
  });

  /* Twelve chips on a paragraph teach people to ignore chips. */
  it('offers text only its resting state, and keeps the rest a click away', () => {
    const { offered, more } = suggestStates('Text', []);
    expect(names(offered)).toEqual(['default']);
    expect(names(more)).toContain('hover');
    expect(names(more)).toContain('dragging');
    expect(offered.length + more.length).toBe(STATE_CATALOGUE.length);
  });

  it('offers a container what a container can be in', () => {
    const { offered } = suggestStates('Layout', ['default']);
    expect(names(offered)).toEqual(['loading', 'empty', 'error']);
  });

  it('never offers what is already there', () => {
    const { offered, more } = suggestStates('OK Button', ['default', 'Hover ', 'DISABLED']);
    expect(names(offered)).not.toContain('default');
    expect(names(offered)).not.toContain('hover');
    expect(names(more)).not.toContain('disabled');
  });

  it('carries a reason with every state', () => {
    for (const entry of STATE_CATALOGUE) expect(entry.when.length).toBeGreaterThan(8);
  });
});

describe('what a control has left out', () => {
  /* The rule from the review: owed whether or not the designer drew them. */
  it('names disabled, loading and error on a control that lacks them', () => {
    expect(owedStatesMissing('OK Button', ['default', 'hover'])).toEqual(['disabled', 'loading', 'error']);
    expect(owedStatesMissing('Cities Select', ['default', 'selected', 'loading'])).toEqual([
      'disabled',
      'error',
    ]);
    expect(owedStatesMissing('OK Button', ['disabled', 'loading', 'error'])).toEqual([]);
  });

  it('asks nothing of text or layout', () => {
    expect(owedStatesMissing('Text', [])).toEqual([]);
    expect(owedStatesMissing('Layout', ['default'])).toEqual([]);
  });
});
