import { parseJsonContract, summarizeJsonContract } from '../JsonContract';

describe('parseJsonContract', () => {
  it('treats blank as an intentional empty contract', () => {
    expect(parseJsonContract('')).toEqual({ ok: true, empty: true, formatted: '' });
    expect(parseJsonContract('   \n')).toEqual({ ok: true, empty: true, formatted: '' });
  });

  it('pretty-prints valid JSON', () => {
    const result = parseJsonContract('{"a":1,"b":[true]}');
    expect(result.ok).toBe(true);
    if (!result.ok || result.empty) throw new Error('expected object');
    expect(result.formatted).toBe('{\n  "a": 1,\n  "b": [\n    true\n  ]\n}');
  });

  it('rejects broken JSON with a readable error', () => {
    const result = parseJsonContract('{a:1}');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.error.length).toBeGreaterThan(0);
  });
});

describe('summarizeJsonContract', () => {
  it('summarises objects and arrays for the field preview', () => {
    expect(summarizeJsonContract('', 'none')).toBe('none');
    expect(summarizeJsonContract('{"email":"a","password":"b"}', 'none')).toBe(
      '{ email, password }'
    );
    expect(summarizeJsonContract('[1,2,3]', 'none')).toBe('Array(3)');
  });
});
