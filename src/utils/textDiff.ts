/**
 * Line-based diff for markdown docs and PlantUML source in the version
 * comparison panel. No dependency pulled in for this — the inputs are a single
 * document's before/after, at most a few hundred lines, well inside what a
 * plain LCS handles instantly.
 */

export type DiffLine = {
  kind: 'same' | 'added' | 'removed';
  text: string;
};

/** Longest common subsequence of two line arrays, by index. */
function lcsTable(a: string[], b: string[]): number[][] {
  const table: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0)
  );
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i][j] =
        a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  return table;
}

export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split('\n');
  const b = after.split('\n');
  const table = lcsTable(a, b);

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ kind: 'same', text: a[i] });
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      out.push({ kind: 'removed', text: a[i] });
      i += 1;
    } else {
      out.push({ kind: 'added', text: b[j] });
      j += 1;
    }
  }
  while (i < a.length) {
    out.push({ kind: 'removed', text: a[i] });
    i += 1;
  }
  while (j < b.length) {
    out.push({ kind: 'added', text: b[j] });
    j += 1;
  }
  return out;
}
