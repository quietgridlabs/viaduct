import { fieldSurfaceFlatStyles } from '@theme/formStyles';
import { resolveCatalogGroup } from '@/types/c4Extensions';
import { useColorMode } from '@contexts/ColorModeContext';
import {
  Combobox,
  Field,
  IconButton,
  Portal,
  Text,
  useFilter,
  useListCollection,
} from '@chakra-ui/react';
import { X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import FieldHint from '@components/common/FieldHint';
import { useTranslation } from 'react-i18next';


type GroupItem = {
  label: string;
  value: string;
  create?: boolean;
};

export type ElementGroupFieldProps = {
  group: string;
  catalog: string[];
  onChange: (group: string) => void;
};

export default function ElementGroupField({
  group,
  catalog,
  onChange,
}: ElementGroupFieldProps) {
  const { t } = useTranslation();
  const { chrome } = useColorMode();
  const current = resolveCatalogGroup(group, catalog) || '';
  const [inputValue, setInputValue] = useState(current);

  useEffect(() => {
    setInputValue(current);
  }, [current]);

  const items = useMemo(() => {
    const list: GroupItem[] = catalog.map((name) => ({
      label: name,
      value: name,
    }));
    const typed = resolveCatalogGroup(inputValue, catalog);
    if (
      typed &&
      !catalog.some((name) => name.toLowerCase() === typed.toLowerCase())
    ) {
      list.unshift({
        label: t('group_create', { name: typed }),
        value: typed,
        create: true,
      });
    }
    return list;
  }, [catalog, inputValue, t]);

  const { contains } = useFilter({ sensitivity: 'base' });
  const { collection, filter, set } = useListCollection({
    initialItems: items,
    filter: contains,
    itemToString: (item) => item.label,
    itemToValue: (item) => item.value,
  });

  useEffect(() => {
    set(items);
    filter(inputValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const apply = (raw: string) => {
    const next = resolveCatalogGroup(raw, catalog) || '';
    onChange(next);
    setInputValue(next);
    filter(next);
  };

  const inputStyles = {
    ...fieldSurfaceFlatStyles(chrome),
    minH: '40px',
    h: '40px',
  };

  return (
    <Field.Root w="full" data-testid="input_group">
      <Field.Label color="fg.muted" mb="6px" gap="5px">
        {t('group')}
        <FieldHint text={t('group_hint')} />
      </Field.Label>
      <Combobox.Root
        collection={collection}
        openOnClick
        width="100%"
        value={current ? [current] : []}
        inputValue={inputValue}
        onInputValueChange={(d) => {
          setInputValue(d.inputValue);
          filter(d.inputValue);
        }}
        onValueChange={(d) => {
          const next = d.value[0];
          if (next) apply(next);
        }}
        positioning={{ sameWidth: true, gutter: 4 }}
      >
        <Combobox.Control>
          <Combobox.Input
            placeholder={t('group_placeholder')}
            {...inputStyles}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || !inputValue.trim()) return;
              e.preventDefault();
              apply(inputValue);
            }}
          />
          <Combobox.IndicatorGroup>
            {current ? (
              <IconButton
                size="xs"
                variant="ghost"
                aria-label={t('delete')}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange('');
                  setInputValue('');
                  filter('');
                }}
              >
                <X size={12} />
              </IconButton>
            ) : (
              <Combobox.Trigger />
            )}
          </Combobox.IndicatorGroup>
        </Combobox.Control>
        <Portal>
          <Combobox.Positioner zIndex="popover">
            <Combobox.Content
              bg="bg.dialog"
              color="fg.default"
              borderWidth="1px"
              borderColor="border.default"
              maxH="240px"
              overflowY="auto"
              boxShadow="md"
            >
              {collection.items.map((item) => (
                <Combobox.Item
                  key={item.value}
                  item={item}
                  _highlighted={{ bg: 'bg.list.hover' }}
                >
                  <Text fontSize="sm" lineClamp={1}>
                    {item.label}
                  </Text>
                </Combobox.Item>
              ))}
              <Combobox.Empty>
                <Text px="12px" py="8px" color="fg.muted" fontSize="sm">
                  {t('group_empty')}
                </Text>
              </Combobox.Empty>
            </Combobox.Content>
          </Combobox.Positioner>
        </Portal>
      </Combobox.Root>
    </Field.Root>
  );
}
