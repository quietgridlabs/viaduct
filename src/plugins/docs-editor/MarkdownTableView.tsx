import { Box, Button, HStack, Input, Menu, Portal, Text } from '@chakra-ui/react';
import GlassMenuContent from '@components/common/GlassMenuContent';
import { pointAnchorRect } from '@utils/menuAnchor';
import { Columns3, Rows3 } from 'lucide-react';
import { useEffect, useState, type ComponentProps, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { MarkdownTable } from './markdown';

type Props = {
  table: MarkdownTable;
  readOnly?: boolean;
  onChange?: (next: MarkdownTable) => void;
};

type CellTarget = {
  row: number | null; // null = header
  col: number;
  x: number;
  y: number;
};

function normalize(table: MarkdownTable): MarkdownTable {
  const width = Math.max(table.headers.length, ...table.rows.map((r) => r.length), 1);
  const pad = (row: string[]) => {
    const next = row.slice(0, width);
    while (next.length < width) next.push('');
    return next;
  };
  return {
    headers: pad(
      table.headers.length
        ? table.headers
        : Array.from({ length: width }, (_, i) => `Column ${i + 1}`)
    ),
    rows: table.rows.map(pad),
  };
}

const cellBorder = {
  borderWidth: '1px',
  borderColor: 'border.default',
} as const;

/**
 * A cell that keeps what was typed while it is being typed.
 *
 * Every change goes through the markdown source, and a table cell is trimmed
 * when the source is parsed back — so a controlled input showing the parsed
 * value drops a trailing space the moment it is typed, and "two words" can
 * never be written. The draft holds the text as typed while the cell has
 * focus; the parsed value wins again once focus leaves.
 */
function CellInput({
  value,
  onCommit,
  ...rest
}: Omit<ComponentProps<typeof Input>, 'value' | 'onChange'> & {
  value: string;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(value);
  }, [value, focused]);
  return (
    <Input
      {...rest}
      value={focused ? draft : value}
      onFocus={() => {
        setDraft(value);
        setFocused(true);
      }}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        setDraft(e.target.value);
        onCommit(e.target.value);
      }}
    />
  );
}

export default function MarkdownTableView({ table, readOnly, onChange }: Props) {
  const { t } = useTranslation();
  const data = normalize(table);
  const editable = Boolean(onChange) && !readOnly;
  const [menu, setMenu] = useState<CellTarget | null>(null);

  const patch = (next: MarkdownTable) => onChange?.(normalize(next));

  const setHeader = (col: number, value: string) => {
    const headers = [...data.headers];
    headers[col] = value;
    patch({ ...data, headers });
  };

  const setCell = (row: number, col: number, value: string) => {
    const rows = data.rows.map((r) => [...r]);
    rows[row]![col] = value;
    patch({ ...data, rows });
  };

  const addRow = () => {
    patch({
      ...data,
      rows: [...data.rows, Array.from({ length: data.headers.length }, () => '')],
    });
  };

  const addColumn = () => {
    const col = data.headers.length + 1;
    patch({
      headers: [...data.headers, `Column ${col}`],
      rows: data.rows.map((r) => [...r, '']),
    });
  };

  const removeRow = (rowIdx: number) => {
    if (data.rows.length <= 1) return;
    patch({
      ...data,
      rows: data.rows.filter((_, i) => i !== rowIdx),
    });
  };

  const removeColumn = (colIdx: number) => {
    if (data.headers.length <= 1) return;
    patch({
      headers: data.headers.filter((_, i) => i !== colIdx),
      rows: data.rows.map((r) => r.filter((_, i) => i !== colIdx)),
    });
  };

  const openCellMenu = (e: MouseEvent, row: number | null, col: number) => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    setMenu({ row, col, x: e.clientX, y: e.clientY });
  };

  const closeMenu = () => setMenu(null);

  return (
    <Box
      my="10px"
      borderWidth="1px"
      borderColor="border.default"
      borderRadius="10px"
      overflow="hidden"
      bg="bg.dialog"
    >
      <Box overflowX="auto">
        <Box as="table" w="100%" borderCollapse="collapse" fontSize="sm">
          <Box as="thead">
            <Box as="tr" bg="bg.muted">
              {data.headers.map((header, col) => (
                <Box
                  as="th"
                  key={`h-${col}`}
                  minW="120px"
                  px="8px"
                  py="6px"
                  textAlign="left"
                  fontWeight="700"
                  onContextMenu={(e) => openCellMenu(e, null, col)}
                  {...cellBorder}
                >
                  {editable ? (
                    <CellInput
                      size="xs"
                      value={header}
                      onCommit={(next) => setHeader(col, next)}
                      onContextMenu={(e) => openCellMenu(e, null, col)}
                      fontWeight="700"
                      bg="transparent"
                      border="none"
                      px="0"
                      _focusVisible={{ outline: 'none', boxShadow: 'none' }}
                    />
                  ) : (
                    <Text fontSize="xs" fontWeight="700">
                      {header || ' '}
                    </Text>
                  )}
                </Box>
              ))}
            </Box>
          </Box>
          <Box as="tbody">
            {data.rows.map((row, rowIdx) => (
              <Box as="tr" key={`r-${rowIdx}`}>
                {row.map((cell, col) => (
                  <Box
                    as="td"
                    key={`c-${rowIdx}-${col}`}
                    px="8px"
                    py="4px"
                    verticalAlign="top"
                    onContextMenu={(e) => openCellMenu(e, rowIdx, col)}
                    {...cellBorder}
                  >
                    {editable ? (
                      <CellInput
                        size="xs"
                        value={cell}
                        onCommit={(next) => setCell(rowIdx, col, next)}
                        onContextMenu={(e) => openCellMenu(e, rowIdx, col)}
                        bg="transparent"
                        border="none"
                        px="0"
                        _focusVisible={{ outline: 'none', boxShadow: 'none' }}
                      />
                    ) : (
                      <Text fontSize="sm">{cell || ' '}</Text>
                    )}
                  </Box>
                ))}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
      {editable ? (
        <HStack
          px="8px"
          py="6px"
          gap="6px"
          borderTopWidth="1px"
          borderColor="border.default"
          bg="bg.drawer"
          flexWrap="wrap"
        >
          <Button size="xs" variant="ghost" onClick={addRow}>
            <Rows3 size={12} />
            {t('documentation_table_add_row')}
          </Button>
          <Button size="xs" variant="ghost" onClick={addColumn}>
            <Columns3 size={12} />
            {t('documentation_table_add_column')}
          </Button>
        </HStack>
      ) : null}

      <Menu.Root
        open={Boolean(menu)}
        onOpenChange={(d) => {
          if (!d.open) closeMenu();
        }}
        positioning={{
          gutter: 0,
          getAnchorRect: () =>
            menu ? pointAnchorRect(menu.x, menu.y) : null,
        }}
      >
        <Portal>
          <Menu.Positioner>
            <GlassMenuContent minW="180px">
              {menu && menu.row !== null ? (
                <Menu.Item
                  value="delete-row"
                  cursor="pointer"
                  disabled={data.rows.length <= 1}
                  onClick={() => {
                    const row = menu.row;
                    closeMenu();
                    if (row !== null) removeRow(row);
                  }}
                >
                  {t('documentation_table_delete_row')}
                </Menu.Item>
              ) : null}
              <Menu.Item
                value="delete-column"
                cursor="pointer"
                disabled={data.headers.length <= 1}
                onClick={() => {
                  const col = menu?.col;
                  closeMenu();
                  if (col != null) removeColumn(col);
                }}
              >
                {t('documentation_table_delete_column')}
              </Menu.Item>
            </GlassMenuContent>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
    </Box>
  );
}
