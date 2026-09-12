import { fieldSurfaceFlatStyles } from '@theme/formStyles';
import {
  MAX_ELEMENT_TAGS,
  normalizeTag,
  sanitizeTags,
} from '@/types/c4Extensions';
import { useColorMode } from '@contexts/ColorModeContext';
import {
  Combobox,
  Field,
  Portal,
  Tag,
  Text,
  HStack,
  useFilter,
  useListCollection,
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import FieldHint from '@components/common/FieldHint';
import ElementTag from '@components/common/ElementTag';
import { useTranslation } from 'react-i18next';

type TagItem = {
  label: string;
  value: string;
};

export type ElementTagsFieldProps = {
  tags: string[];
  catalog: string[];
  onChange: (tags: string[]) => void;
};

export default function ElementTagsField({
  tags,
  catalog,
  onChange,
}: ElementTagsFieldProps) {
  const { t } = useTranslation();
  const { chrome } = useColorMode();
  const selected = useMemo(() => sanitizeTags(tags), [tags]);
  const atMax = selected.length >= MAX_ELEMENT_TAGS;
  const [inputValue, setInputValue] = useState('');

  const selectedKeys = useMemo(
    () => new Set(selected.map((tag) => tag.toLowerCase())),
    [selected]
  );

  const unusedCatalog = useMemo(
    () => catalog.filter((tag) => !selectedKeys.has(tag.toLowerCase())),
    [catalog, selectedKeys]
  );

  const items = useMemo(
    () =>
      unusedCatalog.map((tag) => ({
        label: tag,
        value: tag,
      })),
    [unusedCatalog]
  );

  const { contains } = useFilter({ sensitivity: 'base' });
  const { collection, filter, set } = useListCollection({
    initialItems: items,
    filter: contains,
    itemToString: (item: TagItem) => item.label,
    itemToValue: (item: TagItem) => item.value,
  });

  useEffect(() => {
    set(items);
    filter(inputValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const addTag = (raw: string) => {
    if (atMax) return;
    const key = normalizeTag(raw).toLowerCase();
    const fromCatalog = catalog.find((tag) => tag.toLowerCase() === key);
    if (!fromCatalog || selectedKeys.has(key)) return;
    onChange([...selected, fromCatalog]);
    setInputValue('');
    filter('');
  };

  const removeTag = (tag: string) => {
    onChange(selected.filter((item) => item.toLowerCase() !== tag.toLowerCase()));
  };

  const inputStyles = {
    ...fieldSurfaceFlatStyles(chrome),
    minH: '40px',
    h: '40px',
  };

  const pickerDisabled = atMax || unusedCatalog.length === 0;

  return (
    <Field.Root w="full" data-testid="input_tags">
      <Field.Label color="fg.muted" mb="6px" gap="5px">
        {t('tags')}
        <FieldHint text={t('tags_hint')} />
      </Field.Label>
      {selected.length > 0 && (
        <HStack gap="6px" flexWrap="wrap" mb="8px">
          {selected.map((tag) => (
            <ElementTag
              key={tag}
              tag={tag}
              tagSize="field"
              end={
                <Tag.CloseTrigger
                  aria-label={t('delete')}
                  onClick={() => removeTag(tag)}
                  minW="14px"
                  w="14px"
                  h="14px"
                  color="inherit"
                  cursor="pointer"
                />
              }
            />
          ))}
        </HStack>
      )}
      <Combobox.Root
        collection={collection}
        disabled={pickerDisabled}
        openOnClick
        width="100%"
        value={[]}
        inputValue={inputValue}
        selectionBehavior="clear"
        onInputValueChange={(d) => {
          if (d.reason === 'item-select') {
            setInputValue('');
            filter('');
            return;
          }
          setInputValue(d.inputValue);
          filter(d.inputValue);
        }}
        onValueChange={(d) => {
          const next = d.value[0];
          if (next) addTag(next);
        }}
        positioning={{ sameWidth: true, gutter: 4 }}
      >
        <Combobox.Control>
          <Combobox.Input
            placeholder={
              atMax
                ? t('tags_max')
                : unusedCatalog.length === 0
                  ? t('tags_empty')
                  : t('tags_placeholder')
            }
            {...inputStyles}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || !inputValue.trim() || pickerDisabled) return;
              e.preventDefault();
              addTag(inputValue);
            }}
          />
          <Combobox.IndicatorGroup>
            <Combobox.Trigger />
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
                  {t('tags_empty')}
                </Text>
              </Combobox.Empty>
            </Combobox.Content>
          </Combobox.Positioner>
        </Portal>
      </Combobox.Root>
      <Field.HelperText color="fg.muted" mt="6px">
        {atMax ? t('tags_max') : `${selected.length}/${MAX_ELEMENT_TAGS}`}
      </Field.HelperText>
    </Field.Root>
  );
}
