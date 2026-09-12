import { describe, expect, it } from 'vitest';
import { componentTakesDesign, containerTakesDesign, isUiTechnology } from '../uiTech';

describe('isUiTechnology', () => {
  it('recognises front-end stacks', () => {
    expect(isUiTechnology('react')).toBe(true);
    expect(isUiTechnology('Python')).toBe(false);
  });
});

describe('componentTakesDesign', () => {
  it('hides Design on non-UI tech even inside a UI container', () => {
    expect(componentTakesDesign({ technology: 'python' }, true)).toBe(false);
    expect(componentTakesDesign({ technology: 'java' }, true)).toBe(false);
  });

  it('shows Design for UI tech and existing UI elements', () => {
    expect(componentTakesDesign({ technology: 'react' }, false)).toBe(true);
    expect(componentTakesDesign({ kind: 'ui' }, false)).toBe(true);
    expect(componentTakesDesign({ design: '@state hover: …' }, false)).toBe(true);
  });

  it('allows blank tech only inside a UI container', () => {
    expect(componentTakesDesign({ technology: '' }, true)).toBe(true);
    expect(componentTakesDesign({}, false)).toBe(false);
  });
});

describe('containerTakesDesign', () => {
  it('offers the field on UI tech containers', () => {
    expect(containerTakesDesign({ technology: 'react' })).toBe(true);
    expect(containerTakesDesign({ technology: 'python' })).toBe(false);
  });
});
