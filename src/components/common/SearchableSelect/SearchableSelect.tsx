import { fieldSurfaceFlatStyles } from '@theme/formStyles';
import { useColorMode } from '@contexts/ColorModeContext';
import { POPPER_LAYER_Z } from '@theme/sidePanelLayout';
import {
  Combobox,
  Field,
  Portal,
  Text,
  VStack,
  useFilter,
  useListCollection,
} from '@chakra-ui/react';
import { ReactNode, memo, useEffect, useMemo, useRef, useState } from 'react';


export type SearchableSelectOption = {
  value: string;
  label: string;
  detail?: string;
  group?: string;
};

type CollectionItem = SearchableSelectOption;

const EMPTY_VALUE: string[] = [];
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

function groupRank(group: string) {
  if (group === 'Systems') return 0;
  if (group === 'Containers') return 1;
  if (group === 'Databases') return 2;
  if (group.startsWith('Code')) return 20;
  return 10;
}

function groupCollectionItems(items: CollectionItem[]): [string, CollectionItem[]][] {
  const map = new Map<string, CollectionItem[]>();
  for (const item of items) {
    const group = item.group || '';
    const list = map.get(group) ?? [];
    list.push(item);
    map.set(group, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => collator.compare(a.label, b.label));
  }
  return [...map.entries()].sort(([a], [b]) => {
    const diff = groupRank(a) - groupRank(b);
    if (diff) return diff;
    return collator.compare(a, b);
  });
}

function optionsEqual(a: SearchableSelectOption[], b: SearchableSelectOption[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.value !== y.value ||
      x.label !== y.label ||
      x.detail !== y.detail ||
      x.group !== y.group
    ) {
      return false;
    }
  }
  return true;
}

export type SearchableSelectProps = {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  label?: ReactNode;
  placeholder?: string;
  disabled?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  width?: string | number;
  mb?: string | number;
  flex?: string | number;
  'data-testid'?: string;
  emptyText?: string;
};

function SearchableSelect({
  options,
  value,
  onChange,
  label,
  placeholder = 'Select…',
  disabled,
  size = 'md',
  width,
  mb = 0,
  flex,
  'data-testid': dataTestId,
  emptyText = 'No matches',
}: SearchableSelectProps) {
  const { chrome } = useColorMode();
  const { contains } = useFilter({ sensitivity: 'base' });
  const [open, setOpen] = useState(false);

  const itemsRef = useRef(options);
  const items = useMemo(() => {
    if (optionsEqual(itemsRef.current, options)) return itemsRef.current;
    itemsRef.current = options;
    return options;
  }, [options]);

  const { collection, filter, set } = useListCollection({
    initialItems: items,
    filter: contains,
    itemToString: (item) =>
      [item.group, item.label, item.detail].filter(Boolean).join(' '),
    itemToValue: (item) => item.value,
  });

  useEffect(() => {
    set(items);
    if (open) filter('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const selectedLabel = useMemo(
    () => items.find((i) => i.value === value)?.label || '',
    [items, value]
  );
  const valueArr = useMemo(() => (value ? [value] : EMPTY_VALUE), [value]);

  const [inputValue, setInputValue] = useState(selectedLabel);
  const typingRef = useRef(false);

  useEffect(() => {
    if (open) return;
    setInputValue(selectedLabel);
    typingRef.current = false;
  }, [selectedLabel, open]);

  const showGroups = items.some((item) => item.group);
  const groupedItems = useMemo(
    () => (open && showGroups ? groupCollectionItems(collection.items) : []),
    [open, showGroups, collection.items]
  );
  const ungroupedItems = useMemo(() => {
    if (!open || showGroups) return [];
    return [...collection.items].sort((a, b) => collator.compare(a.label, b.label));
  }, [open, showGroups, collection.items]);

  const controlMinH = size === 'sm' ? '32px' : '40px';
  const tooltipText = selectedLabel || inputValue || undefined;

  const inputStyles = {
    ...fieldSurfaceFlatStyles(chrome),
    minH: controlMinH,
    h: controlMinH,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
    title: tooltipText,
  };

  return (
    <Field.Root
      disabled={disabled}
      mb={mb}
      flex={flex}
      w={width ?? 'full'}
      minW={0}
      data-testid={dataTestId}
    >
      {label ? (
        <Field.Label color="fg.muted" mb="6px">
          {label}
        </Field.Label>
      ) : null}
      <Combobox.Root
        collection={collection}
        size={size}
        disabled={disabled}
        openOnClick
        lazyMount
        unmountOnExit
        open={open}
        width="100%"
        value={valueArr}
        inputValue={inputValue}
        onOpenChange={(d) => {
          setOpen(d.open);
          if (d.open) {
            typingRef.current = false;
            filter('');
            return;
          }
          typingRef.current = false;
          setInputValue(selectedLabel);
        }}
        onInputValueChange={(d) => {
          setInputValue(d.inputValue);
          if (typingRef.current) filter(d.inputValue);
          else if (open) filter('');
        }}
        onValueChange={(d) => {
          const next = d.value[0] ?? '';
          if (next === value) return;
          onChange(next);
          typingRef.current = false;
          if (!next) {
            setInputValue('');
            if (open) filter('');
          }
        }}
        positioning={{ sameWidth: true, gutter: 4, strategy: 'fixed' }}
      >
        <Combobox.Control>
          <Combobox.Input
            placeholder={placeholder}
            {...inputStyles}
            onInput={() => {
              typingRef.current = true;
            }}
          />
          <Combobox.IndicatorGroup>
            <Combobox.ClearTrigger />
            <Combobox.Trigger />
          </Combobox.IndicatorGroup>
        </Combobox.Control>
        <Portal>
          {/* Zag sets its own inline --z-index, so zIndex alone is ignored.
              Keep searchable menus above dialogs and workspace overlays. */}
          <Combobox.Positioner
            zIndex={POPPER_LAYER_Z}
            css={{ '--z-index': `${POPPER_LAYER_Z} !important` }}
          >
            <Combobox.Content
              bg="bg.dialog"
              color="fg.default"
              borderWidth="1px"
              borderColor="border.default"
              maxH="280px"
              overflowY="auto"
              overflowX="hidden"
              boxShadow="md"
            >
              {open && showGroups
                ? groupedItems.map(([group, groupItems]) => (
                    <Combobox.ItemGroup key={group || '__ungrouped'}>
                      {group ? (
                        <Combobox.ItemGroupLabel
                          px="12px"
                          py="6px"
                          fontWeight="700"
                          fontSize="xs"
                          color="fg.muted"
                          bg="bg.list.hover"
                        >
                          {group}
                        </Combobox.ItemGroupLabel>
                      ) : null}
                      {groupItems.map((item) => {
                        const full = item.detail
                          ? `${item.label} · ${item.detail}`
                          : item.label;
                        return (
                          <Combobox.Item
                            key={item.value || '__empty'}
                            item={item}
                            title={full}
                            _highlighted={{ bg: 'bg.list.hover' }}
                          >
                            <VStack align="flex-start" gap="0" minW={0}>
                              <Text fontSize="sm" lineClamp={1} title={full}>
                                {item.label}
                              </Text>
                              {item.detail ? (
                                <Text fontSize="xs" color="fg.muted" lineClamp={1}>
                                  {item.detail}
                                </Text>
                              ) : null}
                            </VStack>
                            <Combobox.ItemIndicator />
                          </Combobox.Item>
                        );
                      })}
                    </Combobox.ItemGroup>
                  ))
                : open
                  ? ungroupedItems.map((item) => {
                      const full = item.detail
                        ? `${item.label} · ${item.detail}`
                        : item.label;
                      return (
                        <Combobox.Item
                          key={item.value || '__empty'}
                          item={item}
                          title={full}
                          _highlighted={{ bg: 'bg.list.hover' }}
                        >
                          <Text fontSize="sm" lineClamp={1} title={full}>
                            {item.label}
                            {item.detail ? ` · ${item.detail}` : ''}
                          </Text>
                          <Combobox.ItemIndicator />
                        </Combobox.Item>
                      );
                    })
                  : null}
              <Combobox.Empty>
                <Text px="12px" py="8px" color="fg.muted" fontSize="sm">
                  {emptyText}
                </Text>
              </Combobox.Empty>
            </Combobox.Content>
          </Combobox.Positioner>
        </Portal>
      </Combobox.Root>
    </Field.Root>
  );
}

export default memo(SearchableSelect);
