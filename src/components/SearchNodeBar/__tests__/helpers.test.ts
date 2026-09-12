import { describe, expect, it } from 'vitest';
import { mirrorTargetHandleFromSource } from '../helpers';

describe('mirrorTargetHandleFromSource', () => {
  it('maps each source side to the facing target handle id that actually exists', () => {
    expect(mirrorTargetHandleFromSource('source-right-0')).toBe('target-left-0');
    expect(mirrorTargetHandleFromSource('source-bottom-1')).toBe('target-top-1');
    expect(mirrorTargetHandleFromSource('source-left-2')).toBe('target-right-3');
    expect(mirrorTargetHandleFromSource('source-top-3')).toBe('target-bottom-2');
  });

  it('does not keep the source index on left/top (those target ids do not exist)', () => {
    expect(mirrorTargetHandleFromSource('source-left-2')).not.toBe('target-right-2');
    expect(mirrorTargetHandleFromSource('source-top-3')).not.toBe('target-bottom-3');
  });

  it('returns undefined when there is no handle to mirror', () => {
    expect(mirrorTargetHandleFromSource(null)).toBeUndefined();
    expect(mirrorTargetHandleFromSource(undefined)).toBeUndefined();
    expect(mirrorTargetHandleFromSource('nonsense')).toBeUndefined();
  });
});
