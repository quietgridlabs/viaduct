import { describe, expect, it } from 'vitest';
import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import { readEditorNav, withPreservedEditorNav } from '../editorNav';

const base = {
  systems: [],
  containers: [],
  components: [],
  codeElements: [],
} as unknown as FlatC4Model;

describe('withPreservedEditorNav', () => {
  it('keeps the deeper view when re-hydrating a system snapshot', () => {
    const incoming = { ...base, viewLevel: 'system' as const };
    const prev = readEditorNav({
      ...base,
      viewLevel: 'component',
      activeSystemId: 'sys',
      activeContainerId: 'api',
      activeComponentId: 'svc',
    });
    expect(withPreservedEditorNav(incoming, prev)).toMatchObject({
      viewLevel: 'component',
      activeSystemId: 'sys',
      activeContainerId: 'api',
      activeComponentId: 'svc',
    });
  });

  it('leaves the snapshot alone when there is no prior nav', () => {
    const incoming = { ...base, viewLevel: 'system' as const, activeSystemId: 'x' };
    expect(withPreservedEditorNav(incoming, null)).toBe(incoming);
  });
});
