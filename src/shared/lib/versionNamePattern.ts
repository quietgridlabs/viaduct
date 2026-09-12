/**
 * Version name pattern presets and validation.
 * Keep in sync with `server/src/shared/versionNamePattern.js`.
 */
import { createNameRules } from './namePattern';

export const VERSION_NAME_PATTERN_PRESET_KEYS = [
  'none',
  'v_dot_semver_colon',
  'semver',
  'custom',
] as const;

export type VersionNamePatternPresetKey = (typeof VERSION_NAME_PATTERN_PRESET_KEYS)[number];

export const VERSION_NAME_PATTERN_PRESETS = {
  v_dot_semver_colon: /^v\.\s*\d+\.\d+(?:\.\d+)?\s*:\s*.+$/,
  semver: /^(?:v|V)?\d+\.\d+(?:\.\d+)?(?:\s*[-\u2013:]\s*.+)?$/,
} as const;

export type VersionNamePatternPresetId = keyof typeof VERSION_NAME_PATTERN_PRESETS;

const rules = createNameRules(VERSION_NAME_PATTERN_PRESETS, 'version_name_pattern_mismatch');

export const compileVersionNamePattern = rules.compile;
export const isValidVersionNamePatternConfig = rules.isValidConfig;

export function validateVersionName(
  name: string,
  stored: string | null | undefined
): { ok: true } | { ok: false; errorKey: 'version_name_pattern_mismatch' } {
  return rules.validate(name, stored) as
    | { ok: true }
    | { ok: false; errorKey: 'version_name_pattern_mismatch' };
}

export function serializeVersionNamePattern(
  key: VersionNamePatternPresetKey,
  customRegex?: string
): string | null {
  return rules.serialize(key, customRegex);
}

export function deserializeVersionNamePattern(stored: string | null | undefined): {
  key: VersionNamePatternPresetKey;
  customRegex: string;
} {
  return rules.deserialize(stored) as {
    key: VersionNamePatternPresetKey;
    customRegex: string;
  };
}

export function versionNamePatternExample(stored: string | null | undefined): string | null {
  const { key } = deserializeVersionNamePattern(stored);
  switch (key) {
    case 'v_dot_semver_colon':
      return 'v. 1.0: description';
    case 'semver':
      return '1.0.0';
    default:
      return null;
  }
}
