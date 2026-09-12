import {
  branchNamePatternExample,
  deserializeBranchNamePattern,
  isValidBranchNamePatternConfig,
  serializeBranchNamePattern,
  validateBranchName,
} from '../branchNamePattern';

describe('validateBranchName', () => {
  it('accepts anything when the project asks for nothing', () => {
    expect(validateBranchName('My Branch', null).ok).toBe(true);
    expect(validateBranchName('My Branch', '').ok).toBe(true);
  });

  it('holds kebab names to lowercase and dashes', () => {
    expect(validateBranchName('auth-oauth', 'kebab').ok).toBe(true);
    expect(validateBranchName('auth', 'kebab').ok).toBe(true);
    expect(validateBranchName('My Branch', 'kebab').ok).toBe(false);
    expect(validateBranchName('auth_oauth', 'kebab').ok).toBe(false);
    expect(validateBranchName('auth-', 'kebab').ok).toBe(false);
  });

  it('wants a known type before the slash', () => {
    expect(validateBranchName('feat/auth-oauth', 'type_slash').ok).toBe(true);
    expect(validateBranchName('spike/events', 'type_slash').ok).toBe(true);
    expect(validateBranchName('stuff/events', 'type_slash').ok).toBe(false);
    expect(validateBranchName('feat/Auth', 'type_slash').ok).toBe(false);
  });

  it('wants a ticket and something to read after it', () => {
    expect(validateBranchName('ARCH-142 split billing out', 'ticket').ok).toBe(true);
    expect(validateBranchName('ARCH-142', 'ticket').ok).toBe(false);
    expect(validateBranchName('arch-142 split', 'ticket').ok).toBe(false);
  });

  it('takes a custom expression', () => {
    expect(validateBranchName('rfc-7', 'regex:^rfc-\\d+$').ok).toBe(true);
    expect(validateBranchName('rfc-x', 'regex:^rfc-\\d+$').ok).toBe(false);
  });

  /* A stored pattern that no longer compiles must not lock the project out of
     making branches — the rule is a convention, not a gate on the data. */
  it('lets a broken stored pattern through rather than blocking everything', () => {
    expect(validateBranchName('anything', 'regex:([').ok).toBe(true);
    expect(validateBranchName('anything', 'no_such_preset').ok).toBe(true);
  });

  it('trims before judging', () => {
    expect(validateBranchName('  auth-oauth  ', 'kebab').ok).toBe(true);
    expect(validateBranchName('   ', 'kebab').ok).toBe(false);
  });
});

describe('the stored form', () => {
  it('round-trips a preset', () => {
    expect(serializeBranchNamePattern('kebab')).toBe('kebab');
    expect(deserializeBranchNamePattern('kebab')).toEqual({ key: 'kebab', customRegex: '' });
  });

  it('round-trips a custom expression', () => {
    const stored = serializeBranchNamePattern('custom', '^rfc-\\d+$');
    expect(stored).toBe('regex:^rfc-\\d+$');
    expect(deserializeBranchNamePattern(stored)).toEqual({
      key: 'custom',
      customRegex: '^rfc-\\d+$',
    });
  });

  it('stores nothing for "no format", and for an empty custom box', () => {
    expect(serializeBranchNamePattern('none')).toBeNull();
    expect(serializeBranchNamePattern('custom', '   ')).toBeNull();
  });

  it('refuses to store an expression that does not compile', () => {
    expect(isValidBranchNamePatternConfig('regex:^ok$')).toBe(true);
    expect(isValidBranchNamePatternConfig('regex:([')).toBe(false);
    expect(isValidBranchNamePatternConfig(`regex:${'a'.repeat(201)}`)).toBe(false);
  });
});

describe('branchNamePatternExample', () => {
  it('shows the shape rather than the expression', () => {
    expect(branchNamePatternExample('kebab')).toBe('auth-oauth');
    expect(branchNamePatternExample('type_slash')).toBe('feat/auth-oauth');
    expect(branchNamePatternExample('ticket')).toBe('ARCH-142 split billing out');
  });

  /* Nothing honest to show for a raw expression, and none is better than a
     wrong one. */
  it('has nothing to show for a custom one', () => {
    expect(branchNamePatternExample('regex:^rfc-\\d+$')).toBeNull();
    expect(branchNamePatternExample(null)).toBeNull();
  });
});
