import { useGlassSurface } from '@theme/glassSurfaces';
import { Button, Checkbox, Dialog, HStack, Input, Portal, Text, VStack } from '@chakra-ui/react';
import { DIALOG_PAD } from '@components/common/BaseEditDialog';
import MethodChip from '@components/common/MethodChip';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export type PickerItem = {
  id: string;
  label: string;
  /** Verb or protocol, coloured and given its own column so the list scans. */
  badge?: string;
  /** Supporting detail — the endpoint's name, the broker it lives on. */
  hint?: string;
};

type Props = {
  open: boolean;
  title: string;
  items: PickerItem[];
  emptyLabel: string;
  onInsert: (ids: string[]) => void;
  onClose: () => void;
};

/** A page that fits without the dialog growing a scrollbar of its own. */
export const PAGE_SIZE = 10;

/** One row: 7px padding either side of a 20px line, plus its hairline. */
const ROW_HEIGHT = 35;

/**
 * Pick one or several things to drop into the document.
 *
 * Selection order is insertion order: whoever ticks response before request
 * meant that, and re-sorting to list order behind their back is worse than
 * honouring the clicks. Selection also survives filtering and paging — the
 * ticks are on ids, not on rows, so narrowing the list never silently drops
 * something already chosen.
 */
export default function InsertPickerDialog({
  open,
  title,
  items,
  emptyLabel,
  onInsert,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const glass = useGlassSurface();
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  /* A dialog reopened on a different kind must not carry the last one's ticks. */
  useEffect(() => {
    if (!open) return;
    setSelected([]);
    setQuery('');
    setPage(0);
  }, [open, title]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [item.label, item.hint, item.badge].some((field) =>
        (field || '').toLowerCase().includes(q)
      )
    );
  }, [items, query]);

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  /* Filtering can strip the list below the page being read; clamp rather than
     show an empty page nobody asked for. */
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = visible.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );
  };

  const confirm = () => {
    if (!selected.length) return;
    onInsert(selected);
    onClose();
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(d) => {
        if (!d.open) onClose();
      }}
      placement="center"
      size="sm"
    >
      <Portal>
        <Dialog.Backdrop bg={glass.backdrop} zIndex={1790} />
        <Dialog.Positioner zIndex={1800}>
          <Dialog.Content
            data-testid="insert-picker-dialog"
            color="fg.default"
            maxW="560px"
            w="calc(100% - 32px)"
            {...glass.dialog}
          >
            <Dialog.Header
              px={DIALOG_PAD.headerPx}
              pt={DIALOG_PAD.headerPt}
              pb={DIALOG_PAD.headerPb}
            >
              <Dialog.Title fontWeight="600">{title}</Dialog.Title>
            </Dialog.Header>

            <Dialog.Body px={DIALOG_PAD.bodyPx} py="8px">
              {items.length ? (
                <VStack align="stretch" gap="10px">
                  <Input
                    size="sm"
                    autoFocus
                    value={query}
                    data-testid="insert-picker-filter"
                    placeholder={t('documentation_insert_search')}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(0);
                    }}
                    bg="bg.dialog"
                    borderColor="border.input"
                  />

                  <VStack
                    align="stretch"
                    gap="0"
                    /* Only reserve a page's worth while there is a page to turn
                       to — a three-item picker should not open onto a void. */
                    minH={pageCount > 1 ? `${PAGE_SIZE * ROW_HEIGHT}px` : undefined}
                  >
                    {pageItems.map((item, index) => {
                      const checked = selected.includes(item.id);
                      return (
                        /* The whole row is the hit target and owns the click.
                           The checkbox is presentational — two handlers over one
                           row toggle twice and land back where they started. */
                        <HStack
                          key={item.id}
                          role="checkbox"
                          aria-checked={checked}
                          tabIndex={0}
                          gap="10px"
                          px="8px"
                          py="7px"
                          borderBottomWidth={index === pageItems.length - 1 ? '0' : '1px'}
                          borderColor="border.default"
                          bg={checked ? 'accent.subtle' : 'transparent'}
                          cursor="pointer"
                          transition="background 120ms"
                          _hover={{ bg: checked ? 'accent.subtle' : 'bg.list.hover' }}
                          onClick={() => toggle(item.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              toggle(item.id);
                            }
                          }}
                        >
                          <Checkbox.Root
                            checked={checked}
                            colorPalette="brand"
                            pointerEvents="none"
                            flexShrink={0}
                          >
                            <Checkbox.Control />
                          </Checkbox.Root>
                          {item.badge ? <MethodChip method={item.badge} minW="42px" /> : null}
                          <Text
                            fontSize="sm"
                            fontFamily="mono"
                            color="fg.default"
                            truncate
                            minW={0}
                          >
                            {item.label}
                          </Text>
                          {item.hint ? (
                            <Text
                              fontSize="xs"
                              color="fg.muted"
                              ml="auto"
                              pl="10px"
                              flexShrink={0}
                              truncate
                              maxW="45%"
                            >
                              {item.hint}
                            </Text>
                          ) : null}
                        </HStack>
                      );
                    })}

                    {!visible.length ? (
                      <Text fontSize="sm" color="fg.subtle" px="4px" py="6px">
                        {t('documentation_insert_no_matches')}
                      </Text>
                    ) : null}
                  </VStack>

                  {pageCount > 1 ? (
                    <HStack justify="space-between" align="center">
                      <Button
                        size="xs"
                        variant="ghost"
                        data-testid="insert-picker-prev"
                        aria-label={t('documentation_insert_prev_page')}
                        disabled={safePage === 0}
                        onClick={() => setPage(safePage - 1)}
                      >
                        <ChevronLeft size={14} />
                      </Button>
                      <Text fontSize="xs" color="fg.muted" data-testid="insert-picker-page">
                        {t('documentation_insert_page', {
                          page: safePage + 1,
                          pages: pageCount,
                        })}
                      </Text>
                      <Button
                        size="xs"
                        variant="ghost"
                        data-testid="insert-picker-next"
                        aria-label={t('documentation_insert_next_page')}
                        disabled={safePage >= pageCount - 1}
                        onClick={() => setPage(safePage + 1)}
                      >
                        <ChevronRight size={14} />
                      </Button>
                    </HStack>
                  ) : null}
                </VStack>
              ) : (
                <Text color="fg.muted" lineHeight="1.55">
                  {emptyLabel}
                </Text>
              )}
            </Dialog.Body>

            <Dialog.Footer
              gap="8px"
              px={DIALOG_PAD.footerPx}
              py={DIALOG_PAD.footerPy}
              justifyContent="space-between"
            >
              <Text fontSize="xs" color="fg.muted">
                {selected.length
                  ? t('documentation_insert_selected', { count: selected.length })
                  : ''}
              </Text>
              <HStack gap="8px">
                <Button
                  variant="outline"
                  onClick={onClose}
                  borderColor="border.strong"
                  color="fg.default"
                >
                  {t('cancel')}
                </Button>
                <Button
                  data-testid="insert-picker-confirm"
                  onClick={confirm}
                  disabled={!selected.length}
                  bg="bg.neutral.emphasis"
                  color="fg.onNeutral"
                  _hover={{ bg: 'bg.neutral.emphasis.hover' }}
                >
                  {t('documentation_insert')}
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
