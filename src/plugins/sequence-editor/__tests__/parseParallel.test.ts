/**
 * Magic flows generate `par … and … end` for parallel stages. The editor read
 * that as an unsupported keyword and reported errors on source it had itself
 * produced — the diagram drew correctly in the flow and failed in the viewer.
 */
import { parsePlantUmlSequence } from '../plantuml/parser';

const source = (branchWord: string) =>
  [
    '@startuml',
    'title Checkout',
    '',
    'participant "Payments" as Payments',
    'participant "Ledger" as Ledger',
    '',
    'par Pay card',
    '  Payments -> Ledger: charge',
    `${branchWord} Pay wallet`,
    '  Payments -> Ledger: debit',
    'end',
    '@enduml',
    '',
  ].join('\n');

describe('parallel fragments', () => {
  it('parses par with and-branches without complaining', () => {
    const result = parsePlantUmlSequence(source('and'));
    expect(result.diagnostics).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('keeps both branches rather than folding them into one', () => {
    const result = parsePlantUmlSequence(source('and'));
    if (!result.ok) throw new Error('expected a parse');
    const fragment = result.model.items.find((item) => item.type === 'fragment');
    expect(fragment).toBeDefined();
    if (fragment?.type !== 'fragment') throw new Error('expected a fragment');
    expect(fragment.kind).toBe('par');
    expect(fragment.branches).toHaveLength(2);
    expect(fragment.branches[0]?.condition).toBe('Pay card');
    expect(fragment.branches[1]?.condition).toBe('Pay wallet');
  });

  it('still accepts else under par, which older diagrams were written with', () => {
    // The generator used to emit it, so saved diagrams carry it.
    const result = parsePlantUmlSequence(source('else'));
    expect(result.diagnostics).toEqual([]);
  });

  it('leaves alt/else working as it did', () => {
    const result = parsePlantUmlSequence(
      source('and').replace('par Pay card', 'alt Pay card').replace('and Pay wallet', 'else Pay wallet')
    );
    expect(result.diagnostics).toEqual([]);
    if (!result.ok) throw new Error('expected a parse');
    const fragment = result.model.items.find((item) => item.type === 'fragment');
    if (fragment?.type !== 'fragment') throw new Error('expected a fragment');
    expect(fragment.kind).toBe('alt');
  });
});
