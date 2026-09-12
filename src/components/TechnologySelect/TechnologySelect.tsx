import { fieldSurfaceFlatStyles } from '@theme/formStyles';
import { useColorMode } from '@contexts/ColorModeContext';
import { getIconComponent } from '@icons/TechnologyIcons';
import {
  Box,
  Combobox,
  Field,
  HStack,
  Portal,
  Text,
  useFilter,
  useListCollection,
} from '@chakra-ui/react';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MENU_MAX_HEIGHT, TRIGGER_MIN_H } from './constants';
import {
  resolveIconColor,
  technologiesForSelect,
  toOptionItems,
} from './helpers';
import type { TechnologySelectProps } from './types';

export default function TechnologySelect({
  fullWidth = false,
  level,
  value,
  onChange,
  label,
  placeholder,
}: TechnologySelectProps) {
  const { t } = useTranslation();
  const { chrome } = useColorMode();

  const options = useMemo(() => technologiesForSelect(level, value), [level, value]);
  const items = useMemo(() => toOptionItems(options), [options]);

  const { contains } = useFilter({ sensitivity: 'base' });
  const { collection, filter, set } = useListCollection({
    initialItems: items,
    filter: contains,
    itemToString: (item) => item.label,
    itemToValue: (item) => item.value,
  });

  useEffect(() => {
    set(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const selectedLabel = items.find((i) => i.value === value)?.label || '';
  const selectedItem = items.find((i) => i.value === value) || null;
  const [inputValue, setInputValue] = useState(selectedLabel);

  useEffect(() => {
    setInputValue(selectedLabel);
  }, [selectedLabel]);

  return (
    <Field.Root
      w={fullWidth ? '100%' : undefined}
      minW={0}
      mb="0"
      data-testid="input_technology"
    >
      <Field.Label color="fg.muted" mb="6px">
        {label || t('technology')}
      </Field.Label>
      <Combobox.Root
        collection={collection}
        value={value ? [value] : []}
        inputValue={inputValue}
        onInputValueChange={(d) => {
          setInputValue(d.inputValue);
          filter(d.inputValue);
        }}
        onValueChange={(d) => {
          const next = d.value[0] || '';
          if (next === value) return;
          onChange(next);
        }}
        openOnClick
        width="100%"
        size="md"
        positioning={{ sameWidth: true, gutter: 4 }}
      >
        <Combobox.Control position="relative" minW={0} w="full">
          {selectedItem ? (
            <Box
              position="absolute"
              left="10px"
              top="50%"
              transform="translateY(-50%)"
              w="20px"
              h="20px"
              borderRadius="6px"
              bg="bg.subtle"
              borderWidth="1px"
              borderColor="border.default"
              display="grid"
              placeItems="center"
              zIndex={1}
              pointerEvents="none"
            >
              {(() => {
                const Icon = getIconComponent(selectedItem.icon || selectedItem.value);
                const color = resolveIconColor(selectedItem.color);
                return (
                  <Icon
                    size={13}
                    style={
                      {
                        color,
                      } as CSSProperties
                    }
                  />
                );
              })()}
            </Box>
          ) : null}
          <Combobox.Input
            placeholder={placeholder || t('select_technology')}
            /* The shared field recipe rather than this one written out again:
               written out, it was missing the corner radius and fell back to
               the browser's 4px, which is how one control on the panel came to
               be squarer than every other. */
            {...fieldSurfaceFlatStyles(chrome)}
            minH={TRIGGER_MIN_H}
            ps={selectedItem ? '40px' : '12px'}
            _hover={{ borderColor: 'border.strong' }}
            _focus={{
              borderColor: 'border.focus',
              boxShadow: `0 0 0 1px ${chrome.borderFocus}`,
            }}
          />
          <Combobox.IndicatorGroup>
            <Combobox.ClearTrigger />
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
              maxH={MENU_MAX_HEIGHT}
              overflowY="auto"
              boxShadow="md"
            >
              {collection.items.map((item) => (
                <Combobox.Item
                  key={item.value}
                  item={item}
                  data-testid={`technology_option_${item.value}`}
                  _highlighted={{ bg: 'bg.list.hover' }}
                >
                  <HStack gap="8px">
                    <Box
                      w="22px"
                      h="22px"
                      borderRadius="6px"
                      bg="bg.subtle"
                      borderWidth="1px"
                      borderColor="border.default"
                      display="grid"
                      placeItems="center"
                      flexShrink={0}
                    >
                      {(() => {
                        const Icon = getIconComponent(item.icon || item.value);
                        const color = resolveIconColor(item.color);
                        return (
                          <Icon
                            size={14}
                            style={
                              {
                                color,
                              } as CSSProperties
                            }
                          />
                        );
                      })()}
                    </Box>
                    <Text fontSize="sm">{item.label}</Text>
                  </HStack>
                  <Combobox.ItemIndicator />
                </Combobox.Item>
              ))}
              <Combobox.Empty>
                <Text px="12px" py="8px" color={chrome.textMuted} fontSize="sm">
                  No technologies
                </Text>
              </Combobox.Empty>
            </Combobox.Content>
          </Combobox.Positioner>
        </Portal>
      </Combobox.Root>
    </Field.Root>
  );
}
