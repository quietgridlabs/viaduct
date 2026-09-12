import { diffLines } from '../textDiff';

describe('diffLines', () => {
  it('marks every line same when nothing changed', () => {
    const out = diffLines('a\nb\nc', 'a\nb\nc');
    expect(out.every((l) => l.kind === 'same')).toBe(true);
    expect(out.map((l) => l.text)).toEqual(['a', 'b', 'c']);
  });

  it('finds an insertion in the middle without disturbing the rest', () => {
    const out = diffLines('a\nb\nd', 'a\nb\nc\nd');
    expect(out).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'same', text: 'b' },
      { kind: 'added', text: 'c' },
      { kind: 'same', text: 'd' },
    ]);
  });

  it('finds a deletion', () => {
    const out = diffLines('a\nb\nc', 'a\nc');
    expect(out).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'removed', text: 'b' },
      { kind: 'same', text: 'c' },
    ]);
  });

  it('a changed line reads as a removal paired with an addition, not a same', () => {
    const out = diffLines('# Title\nold body', '# Title\nnew body');
    expect(out).toEqual([
      { kind: 'same', text: '# Title' },
      { kind: 'removed', text: 'old body' },
      { kind: 'added', text: 'new body' },
    ]);
  });

  it('an empty before is one blank line removed, not zero lines', () => {
    // `''.split('\n')` is `['']`, not `[]` — a real empty string is one blank
    // line by JS's own rule, and the diff has to agree with that rule rather
    // than special-case it, or "before" and "after" stop being symmetric.
    const out = diffLines('', 'a\nb');
    expect(out).toEqual([
      { kind: 'removed', text: '' },
      { kind: 'added', text: 'a' },
      { kind: 'added', text: 'b' },
    ]);
  });

  it('handles a fully deleted document', () => {
    const out = diffLines('a\nb', '');
    expect(out.filter((l) => l.kind === 'removed').map((l) => l.text)).toEqual(['a', 'b']);
  });
});
