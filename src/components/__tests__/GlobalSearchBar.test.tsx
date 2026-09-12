/**
 * The list must never disagree with the box above it.
 *
 * Typing narrows a query one character at a time, and every intermediate
 * prefix matches far more than the final query does — so a result list that
 * lags even one render behind shows rows that plainly do not match what the
 * user sees themself having typed.
 */
import { ColorModeProvider } from '@contexts/ColorModeContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import GlobalSearchBar from '../GlobalSearchBar';

const model = {
  domains: [],
  systems: [{ id: 's1', name: 'corp-gateway' }],
  containers: [
    { id: 'c1', name: 'corp-wowtax', systemId: 's1' },
    { id: 'c2', name: 'corp-tax-api', systemId: 's1' },
    { id: 'c3', name: 'corp-wowtax-ui', systemId: 's1' },
    { id: 'c4', name: 'corp-marketplace-analytics-api', systemId: 's1' },
  ],
  components: [],
  codeElements: [],
  viewLevel: 'system',
};

jest.mock('@archivisio/c4-modelizer-sdk', () => ({
  useFlatC4Store: (selector: (s: unknown) => unknown) => selector({ model }),
}));

jest.mock('@features/domains', () => ({
  fetchWorkspaceSearch: jest
    .fn()
    .mockResolvedValue({ elements: [], hasMore: false, total: 0 }),
}));

jest.mock('react-router-dom', () => ({
  useParams: () => ({ projectId: 'p1' }),
  useNavigate: () => jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@components/TechnologyIcon', () => ({
  __esModule: true,
  default: () => null,
}));

function renderBar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ColorModeProvider>
        <GlobalSearchBar projectName="alfa-seller" />
      </ColorModeProvider>
    </QueryClientProvider>
  );
  act(() => {
    fireEvent.click(screen.getByTestId('toolbar-global-search'));
  });
  return screen.getByPlaceholderText('global_search_placeholder');
}

/**
 * One native `input` event per character, the way a keyboard delivers them —
 * the bar listens on the node rather than through React's delegated onChange.
 */
function type(input: HTMLElement, text: string) {
  for (let i = 1; i <= text.length; i += 1) {
    act(() => {
      fireEvent.input(input, { target: { value: text.slice(0, i) } });
    });
  }
}

describe('GlobalSearchBar', () => {
  it('shows every prefix match while the query is still short', () => {
    const input = renderBar();
    type(input, 'corp');

    expect(screen.queryByText('corp-gateway')).toBeTruthy();
    expect(screen.queryByText('corp-wowtax')).toBeTruthy();
  });

  it('drops the prefix matches once the query no longer fits them', () => {
    const input = renderBar();
    type(input, 'corp-marketplace');

    expect((input as HTMLInputElement).value).toBe('corp-marketplace');
    expect(screen.queryByText('corp-marketplace-analytics-api')).toBeTruthy();
    expect(screen.queryByText('corp-gateway')).toBeNull();
    expect(screen.queryByText('corp-wowtax')).toBeNull();
    expect(screen.queryByText('corp-tax-api')).toBeNull();
  });

  it('says so rather than listing near misses when nothing matches', async () => {
    const input = renderBar();
    type(input, 'corp-nothing-here');

    await waitFor(() => {
      expect(screen.queryByText('global_search_empty')).toBeTruthy();
    });
    expect(screen.queryByText('corp-gateway')).toBeNull();
  });
});
