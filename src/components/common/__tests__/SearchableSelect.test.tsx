import { ColorModeProvider } from '@contexts/ColorModeContext';
import { act, render, screen } from '@testing-library/react';
import SearchableSelect from '../SearchableSelect';

const options = Array.from({ length: 40 }, (_, i) => ({
  value: `id-${i}`,
  label: `Service ${i}`,
  group: 'Containers',
}));

describe('SearchableSelect', () => {
  it('does not mount option rows while the list is closed', () => {
    render(
      <ColorModeProvider>
        <SearchableSelect options={options} value="id-1" onChange={() => undefined} />
      </ColorModeProvider>
    );

    expect(screen.getByDisplayValue('Service 1')).toBeTruthy();
    expect(screen.queryByText('Service 20')).toBeNull();
    expect(screen.queryByText('Containers')).toBeNull();
  });

  it('keeps the list unmounted when only the selected value changes', () => {
    const { rerender } = render(
      <ColorModeProvider>
        <SearchableSelect options={options} value="id-1" onChange={() => undefined} />
      </ColorModeProvider>
    );

    act(() => {
      rerender(
        <ColorModeProvider>
          <SearchableSelect options={options} value="id-7" onChange={() => undefined} />
        </ColorModeProvider>
      );
    });

    expect(screen.getByDisplayValue('Service 7')).toBeTruthy();
    expect(screen.queryByText('Service 20')).toBeNull();
  });
});
