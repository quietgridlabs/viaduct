import {
  newDesignComposeEntry,
  type DesignComposeEntry,
} from '@components/common/DesignContract';
import { fieldSurfaceFlatStyles } from '@theme/formStyles';
import { useColorMode } from '@contexts/ColorModeContext';
import { POPPER_LAYER_Z } from '@theme/sidePanelLayout';
import {
  Box,
  Button,
  Combobox,
  HStack,
  IconButton,
  Input,
  Portal,
  Text,
  useFilter,
  useListCollection,
} from '@chakra-ui/react';
import FieldHint from '@components/common/FieldHint';
import { ArrowDown, ArrowUp, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  parts: DesignComposeEntry[];
  /** UI elements of this front end — what a part is allowed to be. */
  siblings: string[];
  onChange: (next: DesignComposeEntry[]) => void;
  /** Rows only: no adding, no moving, no removing. */
  readOnly?: boolean;
};

/**
 * One part, chosen rather than spelled.
 *
 * Free text is still accepted: a screen is often described before the elements
 * it is built from exist, and refusing a name that has no element yet would
 * make the field useless exactly when it is most useful. What it must not do
 * is let a *typo* pass silently — a misspelled name looks like a deliberate
 * reference to something that is not there, and the mistake only surfaces much
 * later, in the implementer's list of parts that resolve to nothing.
 */
function PartPicker({
  value,
  siblings,
  onChange,
}: {
  value: string;
  siblings: string[];
  onChange: (next: string) => void;
}) {
  const { t } = useTranslation();
  const { chrome } = useColorMode();
  const { contains } = useFilter({ sensitivity: 'base' });

  const items = useMemo(
    () => siblings.map((name) => ({ label: name, value: name })),
    [siblings]
  );
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

  return (
    <Combobox.Root
      collection={collection}
      openOnClick
      /* On the root, not the input: `size` is a recipe prop of the whole slot
         recipe, and the input alone does not take one. Put here it also keeps
         this control on the same scale as the plain input beside it. */
      size="sm"
      width="100%"
      value={value ? [value] : []}
      inputValue={value}
      onInputValueChange={(d) => {
        onChange(d.inputValue);
        filter(d.inputValue);
      }}
      onValueChange={(d) => {
        if (d.value[0]) onChange(d.value[0]);
      }}
      positioning={{ sameWidth: true, gutter: 4 }}
    >
      <Combobox.Control>
        <Combobox.Input
          placeholder={t('design_composes_part')}
          data-testid="design-compose-part"
          {...fieldSurfaceFlatStyles(chrome)}
        />
        <Combobox.IndicatorGroup>
          <Combobox.Trigger />
        </Combobox.IndicatorGroup>
      </Combobox.Control>
      <Portal>
        <Combobox.Positioner
          zIndex={POPPER_LAYER_Z}
          css={{ '--z-index': `${POPPER_LAYER_Z} !important` }}
        >
          <Combobox.Content
            bg="bg.dialog"
            color="fg.default"
            borderWidth="1px"
            borderColor="border.default"
            maxH="220px"
            overflowY="auto"
            boxShadow="md"
          >
            {collection.items.map((item) => (
              <Combobox.Item key={item.value} item={item} _highlighted={{ bg: 'bg.list.hover' }}>
                <Text fontSize="sm" lineClamp={1}>
                  {item.label}
                </Text>
              </Combobox.Item>
            ))}
            <Combobox.Empty>
              <Text px="12px" py="8px" color="fg.muted" fontSize="sm">
                {t('design_composes_no_match')}
              </Text>
            </Combobox.Empty>
          </Combobox.Content>
        </Combobox.Positioner>
      </Portal>
    </Combobox.Root>
  );
}

/**
 * What a screen is built from, as a list of parts rather than a block of text.
 *
 * The text form is what gets stored, and it was also what got edited — which
 * put two things on one line that behave nothing alike. The slot is a label
 * somebody invents; the part is one of a known set of elements. Typing them
 * into the same string meant no completion for the half that has an answer, no
 * way to reorder without retyping, and a comma in the wrong place quietly
 * turning one part into two.
 *
 * Rows fix all three. Order is reading order, so it is movable rather than
 * whatever the lines happened to be in; a part that matches no element is
 * marked here, where it can still be fixed, instead of surfacing much later in
 * the implementer's list of things that resolve to nothing.
 */
export default function DesignComposeField({ parts, siblings, onChange, readOnly = false }: Props) {
  const { t } = useTranslation();
  const { chrome } = useColorMode();
  const known = useMemo(
    () => new Set(siblings.map((name) => name.toLowerCase())),
    [siblings]
  );

  const patch = (index: number, next: Partial<DesignComposeEntry>) =>
    onChange(parts.map((entry, i) => (i === index ? { ...entry, ...next } : entry)));

  const remove = (index: number) => onChange(parts.filter((_, i) => i !== index));

  const move = (index: number, by: number) => {
    const to = index + by;
    if (to < 0 || to >= parts.length) return;
    const next = [...parts];
    [next[index], next[to]] = [next[to], next[index]];
    onChange(next);
  };

  const add = (name = '') =>
    onChange([
      ...parts,
      /* A new row inherits the slot above it: parts of one slot are normally
         listed together, and retyping `content` for each is the tax the text
         field used to charge. */
      newDesignComposeEntry({ name, slot: parts[parts.length - 1]?.slot ?? '' }),
    ]);

  const used = new Set(parts.map((entry) => entry.name.trim().toLowerCase()));
  const unused = siblings.filter((name) => !used.has(name.toLowerCase()));

  return (
    <Box>
      {parts.length ? (
        <>
          {/* Two columns that are nothing alike, so they are named. "Region"
              is the word that stops `slot` being a term people have to guess
              at — the hint says the rest. */}
          <HStack gap="6px" mb="4px" px="2px">
            <HStack gap="4px" flex="0 0 110px">
              <Text fontSize="xs" color="fg.subtle">
                {t('design_composes_slot_label')}
              </Text>
              <FieldHint text={t('design_composes_slot_help')} />
            </HStack>
            <Text fontSize="xs" color="fg.subtle" flex="1">
              {t('design_composes_part_label')}
            </Text>
          </HStack>
        <Box
          display="grid"
          gap="6px"
          mb="8px"
          data-testid="design-composes"
          /* Kept for whoever reads the contract as text elsewhere: the same
             value, one line per part. */
        >
          {parts.map((entry, index) => {
            const name = entry.name.trim();
            const unresolved = Boolean(name) && siblings.length > 0 && !known.has(name.toLowerCase());
            return (
              <HStack key={entry.id} gap="6px" align="center">
                <Input
                  size="sm"
                  flex="0 0 110px"
                  value={entry.slot}
                  placeholder={t('design_composes_slot')}
                  data-testid="design-compose-slot"
                  onChange={(e) => patch(index, { slot: e.target.value })}
                  {...fieldSurfaceFlatStyles(chrome)}
                />
                <Box flex="1" minW={0}>
                  <PartPicker
                    value={entry.name}
                    siblings={siblings}
                    onChange={(next) => patch(index, { name: next })}
                  />
                </Box>
                {/* Marked where it can still be fixed. Not an error: naming a
                    part that does not exist yet is a legitimate way to
                    describe a screen before building it. */}
                <Box w="16px" flexShrink={0} lineHeight={0} color="orange.400">
                  {unresolved ? (
                    <Box as="span" title={t('design_composes_unknown_part')}>
                      <TriangleAlert size={14} />
                    </Box>
                  ) : null}
                </Box>
                {readOnly ? null : (
                <>
                <IconButton
                  size="xs"
                  variant="ghost"
                  aria-label={t('design_composes_move_up')}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp size={13} />
                </IconButton>
                <IconButton
                  size="xs"
                  variant="ghost"
                  aria-label={t('design_composes_move_down')}
                  disabled={index === parts.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown size={13} />
                </IconButton>
                <IconButton
                  size="xs"
                  variant="ghost"
                  aria-label={t('delete')}
                  data-testid="design-compose-remove"
                  onClick={() => remove(index)}
                >
                  <Trash2 size={13} />
                </IconButton>
                </>
                )}
              </HStack>
            );
          })}
        </Box>
        </>
      ) : null}

      {readOnly ? null : (
      <HStack gap="6px" flexWrap="wrap">
        <Button
          size="xs"
          variant="outline"
          borderRadius="full"
          data-testid="design-compose-add"
          onClick={() => add()}
        >
          <Plus size={12} />
          {t('design_composes_add')}
        </Button>
        {/* The elements not used yet, one click each — the fastest path when
            the screen is built from what is already on the canvas. */}
        {unused.slice(0, 10).map((name) => (
          <Button
            key={name}
            size="xs"
            variant="ghost"
            borderRadius="full"
            data-testid={`design-compose-add-${name}`}
            onClick={() => add(name)}
          >
            <Plus size={12} />
            {name}
          </Button>
        ))}
      </HStack>
      )}
      {readOnly && !parts.length ? (
        <Text fontSize="xs" color="fg.subtle">
          —
        </Text>
      ) : null}
    </Box>
  );
}
