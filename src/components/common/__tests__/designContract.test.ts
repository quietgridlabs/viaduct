import {
  designContractLooksBroken,
  parseDesignContract,
  serializeDesignContract,
  summarizeDesignContract,
  validateDesignContract,
  newDesignState,
  parseComposition,
  parseProps,
  serializeComposition,
  serializeProps,
} from '../DesignContract';

const NODE = 'https://figma.com/design/8Kd2/Weather?node-id=12-345';

const stored = [
  `@design ${NODE}`,
  '@version 2026-09-06T09:12:00Z',
  '',
  '@props',
  'plan: Plan!            # what is rendered',
  'selected: boolean = false',
  '',
  '@state default',
  '@state loading  # skeleton, width must not jump',
  '',
  '@tokens',
  'bg.dialog, border.strong',
  '',
  '@a11y',
  'role=button',
].join('\n');

describe('design contract', () => {
  it('reads what the API stores', () => {
    const contract = parseDesignContract(stored);
    expect(contract.node).toBe(NODE);
    expect(contract.version).toBe('2026-09-06T09:12:00Z');
    expect(contract.props.map((p) => [p.name, p.type, p.required, p.default])).toEqual([
      ['plan', 'Plan', true, ''],
      ['selected', 'boolean', false, 'false'],
    ]);
    expect(contract.states.map((s) => [s.name, s.note])).toEqual([
      ['default', ''],
      ['loading', 'skeleton, width must not jump'],
    ]);
    expect(contract.tokens).toEqual(['bg.dialog', 'border.strong']);
    expect(contract.a11y).toBe('role=button');
  });

  /* The editor writes the same text the server would accept from an agent —
     canonically spaced, so hand-aligned padding comes back normalised. */
  it('writes back what it read', () => {
    const canonical = stored.replace('plan: Plan!            #', 'plan: Plan!  #');
    expect(serializeDesignContract(parseDesignContract(stored))).toBe(canonical);
    expect(serializeDesignContract(parseDesignContract(canonical))).toBe(canonical);
  });

  it('reads a bare link, which is what a pasted one becomes', () => {
    expect(parseDesignContract(NODE).node).toBe(NODE);
    expect(serializeDesignContract(parseDesignContract(NODE))).toBe(`@design ${NODE}`);
  });

  it('refuses a node that points nowhere, and a state described twice', () => {
    const contract = parseDesignContract(stored);
    expect(validateDesignContract(contract).ok).toBe(true);

    expect(validateDesignContract({ ...contract, node: 'the third frame' })).toEqual({
      ok: false,
      error: 'design_node_invalid',
    });

    expect(
      validateDesignContract({
        ...contract,
        states: [...contract.states, newDesignState({ name: 'Loading' })],
      })
    ).toEqual({ ok: false, error: 'design_state_duplicate' });
  });

  /* A project without a design tool describes components in states and props;
     calling that broken would put a warning on everything it owns. */
  it('calls a contract broken only when it says nothing at all', () => {
    expect(designContractLooksBroken('@state loading')).toBe(false);
    expect(designContractLooksBroken('@version 2026-09-06T09:12:00Z')).toBe(true);
    expect(designContractLooksBroken(stored)).toBe(false);
    expect(designContractLooksBroken('')).toBe(false);
  });

  /* Names and reading order — never coordinates: where the parts sit is the
     node's business, and a second source of truth for it would rot. */
  it('reads what a screen is composed of, slots and all', () => {
    const entries = parseComposition(
      ['header:  NavBar', 'content: RegionPicker, PlanCard', 'SupportLink'].join('\n')
    );
    expect(entries.map((e) => [e.slot, e.name])).toEqual([
      ['header', 'NavBar'],
      ['content', 'RegionPicker'],
      ['content', 'PlanCard'],
      ['', 'SupportLink'],
    ]);
  });

  it('writes the composition back one line per slot', () => {
    const text = 'header: NavBar\ncontent: RegionPicker, PlanCard\nSupportLink';
    expect(serializeComposition(parseComposition(text))).toBe(text);
  });

  it('carries the composition through the whole contract', () => {
    const text = `@design ${NODE}\n\n@composes\ncontent: PlanCard`;
    const contract = parseDesignContract(text);
    expect(contract.composes.map((e) => e.name)).toEqual(['PlanCard']);
    expect(serializeDesignContract(contract)).toBe(text);
  });

  /* A half-written line has to survive being typed: `header:` holds no names
     yet, and a field that renders itself back through the parser wipes on the
     colon. Both blocks are edited as text and parsed once, on Apply. */
  it('keeps a half-written line as text', () => {
    expect(parseComposition('header:')).toEqual([]);
    expect(serializeComposition(parseComposition('header:'))).toBe('');
    expect(parseProps('plan:')).toEqual([
      expect.objectContaining({ name: 'plan', type: '' }),
    ]);
  });

  it('writes props back the way they were typed', () => {
    const text = 'plan: Plan!  # what is rendered\nselected: boolean = false';
    expect(serializeProps(parseProps(text))).toBe(text);
  });

  it('summarises a collapsed slot by what is bound and how much is described', () => {
    expect(summarizeDesignContract(stored, 'none')).toBe('node 12:345 · 2 states · 2 props');
    expect(summarizeDesignContract('', 'none')).toBe('none');
  });
});
