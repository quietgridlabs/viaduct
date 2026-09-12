import { ColorModeProvider } from '@contexts/ColorModeContext';
import HttpParamRows from '@components/common/HttpParamRows';
import { newParam } from '@components/common/HttpContract';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function Harness({
  initialRequired,
  where = 'query' as const,
}: {
  initialRequired: boolean;
  where?: 'query' | 'header' | 'path';
}) {
  const [params, setParams] = useState(() => [
    newParam(where, { name: 'page', required: initialRequired }),
  ]);
  return (
    <ColorModeProvider>
      <HttpParamRows where={where} params={params} onChange={setParams} testId="p" />
      <div data-testid="required">{String(params[0]?.required)}</div>
    </ColorModeProvider>
  );
}

describe('HttpParamRows required toggle', () => {
  it('calls onChange when required is toggled on query parameters', async () => {
    const onChange = jest.fn();
    const params = [newParam('query', { name: 'page', required: false })];
    render(
      <ColorModeProvider>
        <HttpParamRows where="query" params={params} onChange={onChange} testId="p" />
      </ColorModeProvider>
    );

    fireEvent.click(screen.getByTestId('p-required-0'));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls.at(-1)?.[0][0].required).toBe(true);
  });

  it('calls onChange when required is toggled on header parameters', async () => {
    const onChange = jest.fn();
    const params = [newParam('header', { name: 'X-Trace', required: false })];
    render(
      <ColorModeProvider>
        <HttpParamRows where="header" params={params} onChange={onChange} testId="p" />
      </ColorModeProvider>
    );

    fireEvent.click(screen.getByTestId('p-required-0'));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls.at(-1)?.[0][0].required).toBe(true);
  });

  it('toggles required on and off in query rows', async () => {
    render(<Harness initialRequired={false} />);
    expect(screen.getByTestId('required').textContent).toBe('false');

    fireEvent.click(screen.getByTestId('p-required-0'));
    await waitFor(() => expect(screen.getByTestId('required').textContent).toBe('true'));

    fireEvent.click(screen.getByTestId('p-required-0'));
    await waitFor(() => expect(screen.getByTestId('required').textContent).toBe('false'));
  });

  it('toggles required on header rows', async () => {
    render(<Harness initialRequired={false} where="header" />);
    fireEvent.click(screen.getByTestId('p-required-0'));
    await waitFor(() => expect(screen.getByTestId('required').textContent).toBe('true'));
  });
});
