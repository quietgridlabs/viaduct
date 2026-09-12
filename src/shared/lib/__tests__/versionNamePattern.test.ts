import { describe, expect, it } from 'vitest';
import {
  compileVersionNamePattern,
  deserializeVersionNamePattern,
  isValidVersionNamePatternConfig,
  serializeVersionNamePattern,
  validateVersionName,
  versionNamePatternExample,
} from '../versionNamePattern';

describe('versionNamePattern', () => {
  it('accepts v_dot_semver_colon preset', () => {
    const pattern = 'v_dot_semver_colon';
    expect(validateVersionName('v. 1.0: release', pattern).ok).toBe(true);
    expect(validateVersionName('1.0: release', pattern).ok).toBe(false);
    expect(versionNamePatternExample(pattern)).toBe('v. 1.0: description');
  });

  it('accepts semver preset', () => {
    const pattern = 'semver';
    expect(validateVersionName('1.0.0', pattern).ok).toBe(true);
    expect(validateVersionName('v2.1-beta', pattern).ok).toBe(true);
    expect(validateVersionName('v. 1.0: x', pattern).ok).toBe(false);
  });

  it('supports custom regex prefix', () => {
    const pattern = 'regex:^hotfix-\\d+$';
    expect(validateVersionName('hotfix-42', pattern).ok).toBe(true);
    expect(validateVersionName('v1', pattern).ok).toBe(false);
    expect(isValidVersionNamePatternConfig(pattern)).toBe(true);
    expect(isValidVersionNamePatternConfig('regex:[')).toBe(false);
  });

  it('skips validation when pattern is unset', () => {
    expect(validateVersionName('anything goes', null).ok).toBe(true);
    expect(compileVersionNamePattern(null)).toBeNull();
  });

  it('round-trips serialize/deserialize', () => {
    expect(deserializeVersionNamePattern(null)).toEqual({ key: 'none', customRegex: '' });
    expect(deserializeVersionNamePattern('semver')).toEqual({ key: 'semver', customRegex: '' });
    expect(deserializeVersionNamePattern('regex:^a+$')).toEqual({
      key: 'custom',
      customRegex: '^a+$',
    });
    expect(serializeVersionNamePattern('custom', '^a+$')).toBe('regex:^a+$');
    expect(serializeVersionNamePattern('none')).toBeNull();
  });
});
