import { readFileSync } from 'fs';
import { join } from 'path';

/*
 * A repeated key in a translation file is silent: JSON.parse keeps the last
 * one and drops the first without a word. That is how a new label called
 * `change_set_title` took over the "Change sets" heading — the menu item and
 * the page title started reading "Title (optional)", and nothing failed.
 *
 * Parsing the file cannot see it, so the raw text is what gets read here.
 */
const raw = readFileSync(join(__dirname, '..', 'en', 'translation.json'), 'utf8');

describe('translations', () => {
  it('declares every key once', () => {
    const keys = [...raw.matchAll(/^ {2}"([^"]+)":/gm)].map((m) => m[1]);
    const seen = new Set<string>();
    const duplicates = keys.filter((key) => (seen.has(key) ? true : (seen.add(key), false)));
    expect(duplicates).toEqual([]);
  });

  it('is valid JSON', () => {
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});
