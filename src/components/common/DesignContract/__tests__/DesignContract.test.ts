import {
  canonicalDesignRef,
  emptyDesignContract,
  parseDesignContract,
  parseProps,
  serializeDesignContract,
  serializeProps,
} from '../DesignContract';

describe('the node spelled one way', () => {
  it('folds the URL dash into the API colon for a short ref', () => {
    expect(canonicalDesignRef('public-web#12-345')).toBe('public-web#12:345');
    expect(canonicalDesignRef('public-web#I12-345;67-890')).toBe('public-web#I12:345;67:890');
    expect(canonicalDesignRef('https://figma.com/design/8Kd2/W?node-id=12-345')).toBe(
      'https://figma.com/design/8Kd2/W?node-id=12-345'
    );
  });

  it('writes the contract with the canonical spelling', () => {
    const text = serializeDesignContract({ ...emptyDesignContract(), node: 'public-web#12-345' });
    expect(text).toMatch(/^@design public-web#12:345$/m);
  });
});

describe('design contract props', () => {
  it('does not read the arrow of a function type as a default value', () => {
    const props = parseProps('onSubmit: () => void!\ncompact: boolean = false');
    expect(props.map((p) => [p.name, p.type, p.required, p.default])).toEqual([
      ['onSubmit', '() => void', true, ''],
      ['compact', 'boolean', false, 'false'],
    ]);
  });

  it('round-trips a function type unchanged', () => {
    const text = 'onSubmit: () => void!';
    expect(serializeProps(parseProps(text))).toBe(text);
  });

  it('reads the same props out of a whole contract', () => {
    const parsed = parseDesignContract(
      ['@props', 'onChange: (value: string) => void', ''].join('\n')
    );
    expect(parsed.props[0].type).toBe('(value: string) => void');
  });
});
