import { describe, expect, it } from 'vitest';
import { designSourceDisplayRef } from '../DesignSourceKindIcon';

describe('designSourceDisplayRef', () => {
  it('keeps the path after /design and drops the query', () => {
    expect(
      designSourceDisplayRef(
        'figma',
        'https://www.figma.com/design/ih5yoNnPMlBJ9VvlJqMGJD/Tes-UI-Form?node-id=1-2'
      )
    ).toBe('/ih5yoNnPMlBJ9VvlJqMGJD/Tes-UI-Form');
  });

  it('leaves non-figma refs alone', () => {
    expect(designSourceDisplayRef('tokens-file', 'apps/web/tokens.json')).toBe(
      'apps/web/tokens.json'
    );
  });
});
