/**
 * Branch name presets and validation.
 *
 * A branch name is read in a list beside a dozen others and typed into a
 * review, so a project that cares about that can require a shape for it.
 *
 * Keep in sync with `server/src/shared/branchNamePattern.js`.
 */
import { createNameRules } from './namePattern';

export const BRANCH_NAME_PATTERN_PRESET_KEYS = [
  'none',
  'kebab',
  'type_slash',
  'ticket',
  'custom',
] as const;

export type BranchNamePatternPresetKey = (typeof BRANCH_NAME_PATTERN_PRESET_KEYS)[number];

export const BRANCH_NAME_PATTERN_PRESETS = {
  kebab: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  type_slash: /^(?:feat|fix|chore|spike|docs|refactor)\/[a-z0-9]+(?:-[a-z0-9]+)*$/,
  ticket: /^[A-Z][A-Z0-9]+-\d+\s+.+$/,
} as const;

const rules = createNameRules(BRANCH_NAME_PATTERN_PRESETS, 'branch_name_pattern_mismatch');

export const compileBranchNamePattern = rules.compile;
export const isValidBranchNamePatternConfig = rules.isValidConfig;

export function validateBranchName(
  name: string,
  stored: string | null | undefined
): { ok: true } | { ok: false; errorKey: 'branch_name_pattern_mismatch' } {
  return rules.validate(name, stored) as
    | { ok: true }
    | { ok: false; errorKey: 'branch_name_pattern_mismatch' };
}

export function serializeBranchNamePattern(
  key: BranchNamePatternPresetKey,
  customRegex?: string
): string | null {
  return rules.serialize(key, customRegex);
}

export function deserializeBranchNamePattern(stored: string | null | undefined): {
  key: BranchNamePatternPresetKey;
  customRegex: string;
} {
  return rules.deserialize(stored) as {
    key: BranchNamePatternPresetKey;
    customRegex: string;
  };
}

/** What a name has to look like, shown next to the field rather than a regex. */
export function branchNamePatternExample(stored: string | null | undefined): string | null {
  const { key } = deserializeBranchNamePattern(stored);
  switch (key) {
    case 'kebab':
      return 'auth-oauth';
    case 'type_slash':
      return 'feat/auth-oauth';
    case 'ticket':
      return 'ARCH-142 split billing out';
    default:
      return null;
  }
}
