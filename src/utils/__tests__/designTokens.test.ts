import { describe, expect, it } from 'vitest';
import {
  inferTokenType,
  mergeReadValues,
  mergeTokens,
  parsePastedTokens,
} from '../designTokens';

describe('pasted design tokens', () => {
  it('reads plain lines, with either separator and either comment mark', () => {
    const tokens = parsePastedTokens(
      [
        'bg.dialog: #1a1d24    # panel background',
        'space.card = 12px',
        '// a comment on its own',
        '',
        'radius.card: 10px',
      ].join('\n')
    );
    expect(tokens).toEqual([
      { name: 'bg.dialog', value: '#1a1d24', type: 'color', description: 'panel background' },
      { name: 'space.card', value: '12px', type: 'space' },
      { name: 'radius.card', value: '10px', type: 'radius' },
    ]);
  });

  it('reads a flat JSON map', () => {
    expect(parsePastedTokens('{ "fg.default": "#e8edf5" }')).toEqual([
      { name: 'fg.default', value: '#e8edf5', type: 'color' },
    ]);
  });

  /* The W3C shape: a leaf carries its own type, which beats any guess. */
  it('reads nested design tokens and flattens them on dots', () => {
    const tokens = parsePastedTokens(
      JSON.stringify({
        bg: { dialog: { $value: '#1a1d24', $type: 'color', $description: 'panel' } },
        space: { card: { $value: '12', $type: 'dimension' } },
      })
    );
    expect(tokens).toEqual([
      { name: 'bg.dialog', value: '#1a1d24', type: 'color', description: 'panel' },
      { name: 'space.card', value: '12', type: 'space' },
    ]);
  });

  it('skips what cannot be read as a value rather than storing it blank', () => {
    expect(parsePastedTokens('just some prose\n\n   ')).toEqual([]);
  });

  it('guesses a type only where the value or the name says so', () => {
    expect(inferTokenType('bg.x', 'oklch(0.2 0.02 250)')).toBe('color');
    expect(inferTokenType('radius.card', '10px')).toBe('radius');
    expect(inferTokenType('shadow.float', '0 6px 20px rgba(0,0,0,.32)')).toBe('shadow');
    expect(inferTokenType('font.body', 'IBM Plex Sans')).toBe('type');
    expect(inferTokenType('gap.row', '8px')).toBe('space');
    expect(inferTokenType('duration.fast', '120ms')).toBe('other');
  });

  /* Pasting again over the same names updates rather than doubles. */
  it('merges by name, later winning', () => {
    const merged = mergeTokens(
      [{ name: 'bg.dialog', value: '#1a1d24', type: 'color', description: 'panel' }],
      [{ name: 'bg.dialog', value: '#101318', type: 'color' }]
    );
    expect(merged).toEqual([
      { name: 'bg.dialog', value: '#101318', type: 'color', description: 'panel' },
    ]);
  });
});

describe('values read out of a design file', () => {
  const existing = [{ name: 'bg.dialog', value: '#111111', type: 'color' as const }];

  it('lets a name from the file win, and appends what nobody named', () => {
    const out = mergeReadValues(
      existing,
      [{ name: 'bg.dialog', value: '#1a1d24', type: 'color' }],
      [{ name: 'button.bg', value: '#7828c8', type: 'color', uses: 3, where: ['Button', 'Badge'] }],
      (uses, where) => `used on ${uses} layers: ${where.join(', ')}`
    );
    expect(out.tokens).toEqual([
      { name: 'bg.dialog', value: '#1a1d24', type: 'color' },
      {
        name: 'button.bg',
        value: '#7828c8',
        type: 'color',
        description: 'used on 3 layers: Button, Badge',
      },
    ]);
    expect(out).toMatchObject({ named: 1, guessed: 1 });
  });

  /* A guessed name must never overwrite one somebody chose. */
  it('drops a suggestion whose guessed name is already taken', () => {
    const out = mergeReadValues(
      existing,
      [],
      [{ name: 'bg.dialog', value: '#ff0000', type: 'color' }]
    );
    expect(out.tokens).toEqual(existing);
    expect(out.guessed).toBe(0);
  });

  it('keeps the first of two suggestions sharing a name, and skips nameless ones', () => {
    const out = mergeReadValues(
      [],
      [],
      [
        { name: 'card.bg', value: '#aaaaaa', type: 'color' },
        { name: 'card.bg', value: '#bbbbbb', type: 'color' },
        { name: '', value: '#cccccc', type: 'color' },
      ]
    );
    expect(out.tokens).toEqual([{ name: 'card.bg', value: '#aaaaaa', type: 'color' }]);
  });
});
