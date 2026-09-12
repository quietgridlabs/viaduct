import { render } from '@testing-library/react';
import { syncPageScroll, usePageScroll } from '@hooks/usePageScroll';

function PublicPage() {
  usePageScroll();
  return <div>public</div>;
}

const flag = () => document.documentElement.getAttribute('data-page-scroll');

describe('page scroll flag', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-page-scroll');
  });

  it('is set while a public page is mounted and dropped on unmount', () => {
    const view = render(<PublicPage />);
    expect(flag()).toBe('true');
    view.unmount();
    expect(flag()).toBeNull();
  });

  it('survives a sync while a public page still claims it', () => {
    render(<PublicPage />);
    syncPageScroll();
    expect(flag()).toBe('true');
  });

  it('drops a flag inherited from prerendered HTML', () => {
    // Every unknown route falls back to the prerendered landing document, so
    // the editor can boot with the flag already on <html>.
    document.documentElement.setAttribute('data-page-scroll', 'true');
    syncPageScroll();
    expect(flag()).toBeNull();
  });
});
