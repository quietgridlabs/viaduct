import { fieldSurfaceFlatStyles } from '@theme/formStyles';
import { useColorMode } from '@contexts/ColorModeContext';
import { POPPER_LAYER_Z } from '@theme/sidePanelLayout';
import {
  Box,
  HStack,
  Field,
  Portal,
  Select,
  Text,
  createListCollection,
} from '@chakra-ui/react';
import { ReactNode, useMemo } from 'react';
import { DIALOG_PAD } from '../BaseEditDialog';


export type ThemedSelectOption = {
  value: string;
  label: string;
  /** Optional section header. Options keep their incoming order within a group. */
  group?: string;
  /**
   * A mark shown beside the label, in the list and on the closed control.
   * For a choice about shape — how a line is drawn, say — the picture is the
   * part that answers the question and the word only confirms it.
   */
  icon?: ReactNode;
};

export type ThemedSelectProps = {
  options: ThemedSelectOption[];
  value: string;
  onChange: (value: string) => void;
  label?: ReactNode;
  /** For selects that carry no visible label — the trigger still needs a name. */
  ariaLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  width?: string | number;
  /**
   * Override the trigger's height. For a select standing next to an input in
   * one row: the two come from different recipes and their default heights do
   * not agree, which reads as a misaligned field rather than as two sizes.
   */
  controlHeight?: string;
  mb?: string | number;
  flex?: string | number;
  'data-testid'?: string;
};

export default function ThemedSelect({
  options,
  value,
  onChange,
  label,
  ariaLabel,
  placeholder = 'Select…',
  disabled,
  size = 'md',
  width,
  controlHeight,
  mb = 0,
  flex,
  'data-testid': dataTestId,
}: ThemedSelectProps) {
  const { chrome } = useColorMode();

  const collection = useMemo(
    () =>
      createListCollection({
        items: options,
        itemToString: (item) => item.label,
        itemToValue: (item) => item.value,
      }),
    [options]
  );

  const groups = useMemo(() => {
    if (!options.some((option) => option.group)) return null;
    const map = new Map<string, ThemedSelectOption[]>();
    for (const option of options) {
      const key = option.group || '';
      const list = map.get(key) ?? [];
      list.push(option);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [options]);

  const controlMinH = controlHeight ?? (size === 'sm' ? '32px' : '40px');
  /* The closed control shows the chosen option's mark too, or the picture only
     exists while the list is open — which is when you least need it. */
  const selectedIcon = options.find((option) => option.value === value)?.icon;

  const renderItem = (item: ThemedSelectOption) => (
    <Select.Item item={item} key={item.value || '__empty'} _highlighted={{ bg: 'bg.list.hover' }}>
      {item.icon ? (
        <Box flexShrink={0} lineHeight={0} color="fg.muted" me="8px">
          {item.icon}
        </Box>
      ) : null}
      <Select.ItemText lineClamp={1} title={item.label}>
        {item.label}
      </Select.ItemText>
      <Select.ItemIndicator />
    </Select.Item>
  );

  const triggerStyles = {
    ...fieldSurfaceFlatStyles(chrome),
    minH: controlMinH,
    h: controlMinH,
    minW: 0,
    flex: '1',
    overflow: 'hidden',
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
        <Field.Label color="fg.muted" mb={DIALOG_PAD.labelMb} gap="5px">
          {label}
        </Field.Label>
      ) : null}
      <Select.Root
        collection={collection}
        size={size}
        disabled={disabled}
        value={value ? [value] : []}
        onValueChange={(d) => {
          const next = d.value[0] ?? '';
          if (next === value) return;
          onChange(next);
        }}
        /* Not `sameWidth`: a select in a narrow column would force its own
           options to that width and clip them, which is exactly what a
           dropdown exists to avoid. The menu is instead floored at the
           trigger's width and free to grow — see Select.Content below. */
        positioning={{ gutter: 4, strategy: 'fixed' }}
        width="100%"
      >
        <Select.HiddenSelect />
        <Select.Control display="flex" alignItems="center" minW={0} w="full">
          <Select.Trigger aria-label={ariaLabel} {...triggerStyles}>
            {/* One group, or the trigger's own space-between pushes the mark to
                one end and its label to the other, and they stop reading as one
                answer. */}
            <HStack gap="8px" minW={0} flex="1">
              {selectedIcon ? (
                <Box flexShrink={0} lineHeight={0} color="fg.muted">
                  {selectedIcon}
                </Box>
              ) : null}
              <Select.ValueText placeholder={placeholder} lineClamp={1} />
            </HStack>
          </Select.Trigger>
          <Select.IndicatorGroup flexShrink={0}>
            <Select.Indicator />
          </Select.IndicatorGroup>
        </Select.Control>
        <Portal>
          {/* Zag writes `z-index: var(--z-index)` and `--z-index: 1500` inline
              on the positioner, so a plain zIndex prop never applies and the
              menu falls behind anything above 1500. Only an !important rule
              outranks an inline declaration. */}
          <Select.Positioner
            zIndex={POPPER_LAYER_Z}
            css={{ '--z-index': `${POPPER_LAYER_Z} !important` }}
          >
            <Select.Content
              bg="bg.dialog"
              color="fg.default"
              borderWidth="1px"
              borderColor="border.default"
              /* Never narrower than the control it belongs to, never wider
                 than the space actually available, and otherwise exactly as
                 wide as the longest option needs. */
              minW="var(--reference-width)"
              w="max-content"
              maxW="min(var(--available-width, 100vw), 420px)"
              maxH="280px"
              overflowY="auto"
              overflowX="hidden"
              boxShadow="md"
            >
              {groups
                ? groups.map(([group, items]) => (
                    <Box key={group || '__ungrouped'}>
                      {group ? (
                        <Text fontSize="xs" px="10px" py="6px" color="fg.muted">
                          {group}
                        </Text>
                      ) : null}
                      {items.map(renderItem)}
                    </Box>
                  ))
                : collection.items.map(renderItem)}
            </Select.Content>
          </Select.Positioner>
        </Portal>
      </Select.Root>
    </Field.Root>
  );
}
