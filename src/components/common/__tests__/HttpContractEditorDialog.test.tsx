import { ColorModeProvider } from '@contexts/ColorModeContext';
import HttpContractEditorDialog from '@components/common/HttpContractEditorDialog';
import {
  emptyRequest,
  newParam,
  parseHttpContract,
  serializeHttpContract,
} from '@components/common/HttpContract';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const initialValue = serializeHttpContract({
  ...emptyRequest(),
  params: [newParam('query', { name: 'page', required: false })],
});

function renderDialog(path: string, onApply = jest.fn()) {
  return render(
    <ColorModeProvider>
      <HttpContractEditorDialog
        open
        side="request"
        title="Request"
        initialValue={initialValue}
        path={path}
        onApply={onApply}
        onClose={() => {}}
      />
    </ColorModeProvider>
  );
}

describe('HttpContractEditorDialog parameters', () => {
  it('persists toggling required on query parameters', async () => {
    const onApply = jest.fn();
    renderDialog('/items', onApply);

    act(() => {
      fireEvent.click(screen.getByTestId('http-query-required-0'));
    });

    await waitFor(() =>
      expect(screen.getByTestId('http-query-required-0')).toHaveAttribute('aria-pressed', 'true')
    );

    fireEvent.click(screen.getByTestId('http-contract-apply'));

    await waitFor(() => expect(onApply).toHaveBeenCalled());
    const saved = parseHttpContract(onApply.mock.calls[0][0], 'request');
    expect(saved.mode).toBe('http');
    if (saved.mode === 'http' && saved.side === 'request') {
      expect(saved.params.find((p) => p.name === 'page')?.required).toBe(true);
    }
  });

  it('does not reset parameter edits when the parent path changes', async () => {
    const onApply = jest.fn();
    const { rerender } = render(
      <ColorModeProvider>
        <HttpContractEditorDialog
          open
          side="request"
          title="Request"
          initialValue={initialValue}
          path="/users/:id"
          onApply={onApply}
          onClose={() => {}}
        />
      </ColorModeProvider>
    );

    act(() => {
      fireEvent.click(screen.getByTestId('http-query-required-0'));
    });

    await waitFor(() =>
      expect(screen.getByTestId('http-query-required-0')).toHaveAttribute('aria-pressed', 'true')
    );

    rerender(
      <ColorModeProvider>
        <HttpContractEditorDialog
          open
          side="request"
          title="Request"
          initialValue={initialValue}
          path="/users/:id/orders/:orderId"
          onApply={onApply}
          onClose={() => {}}
        />
      </ColorModeProvider>
    );

    fireEvent.click(screen.getByTestId('http-contract-apply'));
    await waitFor(() => expect(onApply).toHaveBeenCalled());
    const saved = parseHttpContract(onApply.mock.calls[0][0], 'request');
    expect(saved.mode).toBe('http');
    if (saved.mode === 'http' && saved.side === 'request') {
      expect(saved.params.find((p) => p.name === 'page')?.required).toBe(true);
    }
  });

  it('persists toggling required on header parameters', async () => {
    const onApply = jest.fn();
    render(
      <ColorModeProvider>
        <HttpContractEditorDialog
          open
          side="request"
          title="Request"
          initialValue={serializeHttpContract({
            ...emptyRequest(),
            params: [newParam('header', { name: 'X-Request-Id', required: false })],
          })}
          path="/items"
          onApply={onApply}
          onClose={() => {}}
        />
      </ColorModeProvider>
    );

    fireEvent.click(screen.getByTestId('http-request-tab-headers'));
    act(() => {
      fireEvent.click(screen.getByTestId('http-header-required-0'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('http-header-required-0')).toHaveAttribute('aria-pressed', 'true')
    );

    fireEvent.click(screen.getByTestId('http-contract-apply'));
    await waitFor(() => expect(onApply).toHaveBeenCalled());
    const saved = parseHttpContract(onApply.mock.calls[0][0], 'request');
    if (saved.mode === 'http' && saved.side === 'request') {
      expect(saved.params.find((p) => p.name === 'X-Request-Id')?.required).toBe(true);
    }
  });
});
