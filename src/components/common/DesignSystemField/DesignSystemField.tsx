import { fieldSurfaceFlatStyles } from '@theme/formStyles';
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
import DesignSourceKindIcon from '@components/common/DesignSourceKindIcon';
import { Box, HStack } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';

type Item = { label: string; value: string; kind?: string; create?: boolean };

/**
 * A name, and where that system reads its values from — `figma`,
 * `tokens-file`, `code`, or nothing when the name is in use somewhere but was
 * never recorded as a system.
 */
export type DesignSystemChoice = { name: string; kind?: string };

type Props = {
  value: string;
  /** Systems recorded in the project, plus names other containers already use. */
  catalog: DesignSystemChoice[];
  onChange: (next: string) => void;
};

/**
 * Which design system a front end is built in.
 *
 * A name, like a technology, not a record: the catalog is what the project
 * already holds, offered rather than enforced — the first container to name a
 * system is by definition typing something new, so the field takes a new name
 * as readily as an existing one.
 */
export default function DesignSystemField({ value, catalog, onChange }: Props) {
  const { t } = useTranslation();
  const { chrome } = useColorMode();
  const current = value.trim();
  const [inputValue, setInputValue] = useState(current);

  useEffect(() => {
    setInputValue(current);
  }, [current]);

  const items = useMemo(() => {
    const list: Item[] = catalog.map((entry) => ({
      label: entry.name,
      value: entry.name,
      kind: entry.kind,
    }));
    const typed = inputValue.trim();
    if (typed && !catalog.some((entry) => entry.name.toLowerCase() === typed.toLowerCase())) {
      list.unshift({ label: t('design_system_create', { name: typed }), value: typed, create: true });
    }
    return list;
  }, [catalog, inputValue, t]);

  /* The mark for whatever is chosen, so the closed field says where this
     system reads from without opening it — which is the question people
     actually have here: is there a Figma file behind this name. */
  const chosen = catalog.find(
    (entry) => entry.name.trim().toLowerCase() === current.toLowerCase()
  );

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
    const next = raw.trim();
    onChange(next);
    setInputValue(next);
    filter(next);
  };

  const inputStyles = { ...fieldSurfaceFlatStyles(chrome), minH: '40px', h: '40px' };

  return (
    <Field.Root w="full">
      <Field.Label color="fg.muted" mb="6px" gap="5px">
        {t('design_system_label')}
        <FieldHint text={t('design_system_hint')} />
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
        <Combobox.Control position="relative">
          {chosen ? (
            <Box
              position="absolute"
              insetStart="10px"
              top="50%"
              transform="translateY(-50%)"
              lineHeight={0}
              pointerEvents="none"
              zIndex={1}
            >
              <DesignSourceKindIcon kind={chosen.kind} size={14} />
            </Box>
          ) : null}
          <Combobox.Input
            placeholder={t('design_system_placeholder')}
            data-testid="container-design-system"
            {...inputStyles}
            ps={chosen ? '32px' : undefined}
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
                <Combobox.Item key={item.value} item={item} _highlighted={{ bg: 'bg.list.hover' }}>
                  <HStack gap="8px" minW={0}>
                    {/* A name being typed for the first time has no source
                        yet — no mark rather than a wrong one. */}
                    {item.create ? null : <DesignSourceKindIcon kind={item.kind} size={14} />}
                    <Text fontSize="sm" lineClamp={1}>
                      {item.label}
                    </Text>
                  </HStack>
                </Combobox.Item>
              ))}
              <Combobox.Empty>
                <Text px="12px" py="8px" color="fg.muted" fontSize="sm">
                  {t('design_system_empty')}
                </Text>
              </Combobox.Empty>
            </Combobox.Content>
          </Combobox.Positioner>
        </Portal>
      </Combobox.Root>
    </Field.Root>
  );
}
