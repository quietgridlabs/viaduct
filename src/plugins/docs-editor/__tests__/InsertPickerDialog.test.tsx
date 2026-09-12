import { ColorModeProvider } from '@contexts/ColorModeContext';
import { fireEvent, render, screen } from '@testing-library/react';
import InsertPickerDialog, { PAGE_SIZE, type PickerItem } from '../InsertPickerDialog';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const items: PickerItem[] = [
  { id: 'a', badge: 'GET', label: '/api/accounts', hint: 'List accounts' },
  { id: 'b', badge: 'POST', label: '/api/payments', hint: 'Create payment' },
  { id: 'c', badge: 'POST', label: '/api/auth/login', hint: 'Login' },
];

function open(props: Partial<React.ComponentProps<typeof InsertPickerDialog>> = {}) {
  const onInsert = jest.fn();
  const onClose = jest.fn();
  render(
    <ColorModeProvider>
      <InsertPickerDialog
        open
        title="Insert endpoint"
        items={items}
        emptyLabel="nothing here"
        onInsert={onInsert}
        onClose={onClose}
        {...props}
      />
    </ColorModeProvider>
  );
  return { onInsert, onClose };
}

describe('InsertPickerDialog', () => {
  it('inserts several picks in the order they were ticked', () => {
    const { onInsert, onClose } = open();

    fireEvent.click(screen.getByText('/api/payments'));
    fireEvent.click(screen.getByText('/api/accounts'));
    fireEvent.click(screen.getByTestId('insert-picker-confirm'));

    // Ticking response before request means that order, not list order.
    expect(onInsert).toHaveBeenCalledWith(['b', 'a']);
    expect(onClose).toHaveBeenCalled();
  });

  it('un-ticks on a second click and refuses to insert nothing', () => {
    const { onInsert } = open();

    const row = screen.getByText('/api/accounts');
    fireEvent.click(row);
    fireEvent.click(row);

    expect(screen.getByTestId('insert-picker-confirm')).toHaveAttribute('disabled');
    fireEvent.click(screen.getByTestId('insert-picker-confirm'));
    expect(onInsert).not.toHaveBeenCalled();
  });

  it('says so when the kind has nothing to offer', () => {
    open({ items: [] });
    expect(screen.getByText('nothing here')).toBeInTheDocument();
    expect(screen.getByTestId('insert-picker-confirm')).toHaveAttribute('disabled');
  });

  it('filters on both the label and the hint', () => {
    open();

    fireEvent.change(screen.getByTestId('insert-picker-filter'), {
      target: { value: 'payments' },
    });
    expect(screen.getByText('/api/payments')).toBeInTheDocument();
    expect(screen.queryByText('/api/accounts')).toBeNull();

    fireEvent.change(screen.getByTestId('insert-picker-filter'), {
      target: { value: 'list accounts' },
    });
    expect(screen.getByText('/api/accounts')).toBeInTheDocument();
    expect(screen.queryByText('/api/payments')).toBeNull();

    fireEvent.change(screen.getByTestId('insert-picker-filter'), {
      target: { value: 'nothing like this' },
    });
    expect(screen.getByText('documentation_insert_no_matches')).toBeInTheDocument();
  });

  it('filters on the verb too — "post" should find the POSTs', () => {
    open();

    fireEvent.change(screen.getByTestId('insert-picker-filter'), { target: { value: 'post' } });
    expect(screen.getByText('/api/payments')).toBeInTheDocument();
    expect(screen.getByText('/api/auth/login')).toBeInTheDocument();
    expect(screen.queryByText('/api/accounts')).toBeNull();
  });

  it('shows no pager while everything fits on one page', () => {
    open();
    expect(screen.queryByTestId('insert-picker-page')).toBeNull();
  });
});

describe('InsertPickerDialog paging', () => {
  const many: PickerItem[] = Array.from({ length: 23 }, (_, i) => ({
    id: `id-${i}`,
    badge: 'GET',
    label: `/api/thing-${i}`,
    hint: i % 2 ? 'even service' : 'odd service',
  }));

  it('shows at most a page of rows at a time', () => {
    open({ items: many });

    expect(screen.getAllByRole('checkbox')).toHaveLength(PAGE_SIZE);
    expect(screen.getByTestId('insert-picker-page')).toBeInTheDocument();
    expect(screen.getByTestId('insert-picker-prev')).toHaveAttribute('disabled');
  });

  it('walks pages and lands a short last page', () => {
    open({ items: many });

    fireEvent.click(screen.getByTestId('insert-picker-next'));
    expect(screen.getByText('/api/thing-10')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(PAGE_SIZE);

    fireEvent.click(screen.getByTestId('insert-picker-next'));
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.getByTestId('insert-picker-next')).toHaveAttribute('disabled');

    fireEvent.click(screen.getByTestId('insert-picker-prev'));
    expect(screen.getByText('/api/thing-10')).toBeInTheDocument();
  });

  it('keeps ticks made on a page you have since left', () => {
    const { onInsert } = open({ items: many });

    fireEvent.click(screen.getByText('/api/thing-1'));
    fireEvent.click(screen.getByTestId('insert-picker-next'));
    fireEvent.click(screen.getByText('/api/thing-11'));
    fireEvent.click(screen.getByTestId('insert-picker-confirm'));

    expect(onInsert).toHaveBeenCalledWith(['id-1', 'id-11']);
  });

  it('goes back to the first page when the filter changes', () => {
    open({ items: many });

    fireEvent.click(screen.getByTestId('insert-picker-next'));
    fireEvent.change(screen.getByTestId('insert-picker-filter'), {
      target: { value: 'thing-1' },
    });

    // thing-1, thing-1x — a page's worth, starting from the top again.
    expect(screen.getByText('/api/thing-1')).toBeInTheDocument();
    expect(screen.getByTestId('insert-picker-prev')).toHaveAttribute('disabled');
  });
});
