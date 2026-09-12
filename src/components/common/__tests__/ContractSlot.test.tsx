import { ColorModeProvider } from '@contexts/ColorModeContext';
import ContractSlot from '@components/common/ContractSlot';
import { fireEvent, render, screen } from '@testing-library/react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function renderSlot(props: Partial<React.ComponentProps<typeof ContractSlot>> = {}) {
  const onOpen = jest.fn();
  const onClear = jest.fn();
  render(
    <ColorModeProvider>
      <ContractSlot
        label="Request"
        preview="No contract yet"
        hasContract={false}
        broken={false}
        brokenLabel="broken"
        onOpen={onOpen}
        onClear={onClear}
        testId="slot"
        {...props}
      />
    </ColorModeProvider>
  );
  return { onOpen, onClear };
}

describe('ContractSlot', () => {
  it('offers only a way in while there is nothing stored', () => {
    const { onOpen } = renderSlot();
    expect(screen.queryByTestId('slot-clear')).toBeNull();
    fireEvent.click(screen.getByTestId('slot-add'));
    expect(onOpen).toHaveBeenCalled();
  });

  it('shows the digest and a way to clear it once there is', () => {
    const { onOpen, onClear } = renderSlot({ hasContract: true, preview: 'Query: page' });
    expect(screen.getByTestId('slot-preview').textContent).toBe('Query: page');
    fireEvent.click(screen.getByTestId('slot-edit'));
    expect(onOpen).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('slot-clear'));
    expect(onClear).toHaveBeenCalled();
  });

  it('says so rather than showing a digest it could not read', () => {
    renderSlot({ hasContract: true, broken: true, preview: 'Query: page' });
    expect(screen.getByTestId('slot-preview').textContent).toBe('broken');
  });

  /* The rows live inside the element edit form, and a <button> with no type
     submits it. */
  it('does not submit the form it sits in', () => {
    renderSlot({ hasContract: true });
    expect(screen.getByTestId('slot-edit').getAttribute('type')).toBe('button');
    expect(screen.getByTestId('slot-clear').getAttribute('type')).toBe('button');
  });
});
