import { TAG_PALETTE, tagColorFrom } from '../tagColors';

const hexes = TAG_PALETTE.map((entry) => entry.hex);

describe('tagColorFrom', () => {
  it('gives a tag the same colour every time', () => {
    expect(tagColorFrom({}, 'pci')).toBe(tagColorFrom({}, 'pci'));
  });

  it('ignores case and surrounding space, the way the catalogue does', () => {
    expect(tagColorFrom({}, '  PCI ')).toBe(tagColorFrom({}, 'pci'));
  });

  it('only ever answers with a colour from the palette', () => {
    for (const tag of ['core', 'pci', 'billing', 'legacy', 'edge', 'a', '', 'платежи']) {
      expect(hexes).toContain(tagColorFrom({}, tag));
    }
  });

  it('spreads a handful of tags over several colours', () => {
    const tags = ['core', 'pci', 'billing', 'legacy', 'search', 'auth', 'infra'];
    const used = new Set(tags.map((tag) => tagColorFrom({}, tag)));
    // Not all seven — collisions are fine. All one colour would not be.
    expect(used.size).toBeGreaterThan(2);
  });

  it('prefers a colour someone chose by hand', () => {
    expect(tagColorFrom({ pci: '#123456' }, 'PCI')).toBe('#123456');
  });
});
