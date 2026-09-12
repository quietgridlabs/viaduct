import type { ReactNode } from 'react';
import { DIALOG_PAD } from '@components/common/BaseEditDialog';
import { Box, chakra, Field, HStack, Text } from '@chakra-ui/react';
import { Braces, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * One contract slot in an element's edit panel: what is stored, in a line, and
 * the way in to change it.
 *
 * Four fields — HTTP request and response, protobuf messages, channel schemas —
 * drew this themselves, in the same forty lines each, as a padded box holding
 * an icon, a two-line digest and a row of labelled buttons underneath. That is
 * seventy-odd pixels to say "no contract yet", and an endpoint panel shows two
 * of them, so the fields a person actually fills in were pushed off the bottom
 * of the panel by the two that are usually empty.
 *
 * It is a row now: the digest reads as the value of the label above it, the
 * whole row opens the editor, and clearing appears on hover rather than
 * standing there permanently as a second button. Roughly half the height, and
 * one copy instead of four.
 */
/* A real <button>: `Box as="button"` drops the button props in Chakra v3, and
   `type` is one of them — without it these rows submit the dialog. */
const SlotButton = chakra('button');
/* Not a <button>, on purpose: a read-only panel sits inside a disabled
   fieldset, which silences every form control under it — and a row that
   opens a contract for *reading* is the one thing in that panel that should
   still answer. A div with a button role is outside the fieldset's reach. */
const SlotRow = chakra('div');

export type ContractSlotProps = {
  label: string;
  /** The mark for what this row stands for. Braces, for a contract, by default. */
  icon?: ReactNode;
  /** One-line digest of what is stored, or the empty-state wording. */
  preview: string;
  hasContract: boolean;
  broken: boolean;
  /** Shown in place of the digest when the stored value will not parse. */
  brokenLabel: string;
  onOpen: () => void;
  onClear: () => void;
  testId: string;
  /**
   * The panel is for reading. The row still opens the contract — a viewer
   * wants to follow the design link as much as an editor does — but there is
   * nothing to clear and nothing to add.
   */
  readOnly?: boolean;
};

export default function ContractSlot({
  label,
  icon,
  preview,
  hasContract,
  broken,
  brokenLabel,
  onOpen,
  onClear,
  testId,
  readOnly = false,
}: ContractSlotProps) {
  const { t } = useTranslation();

  const digest = (
    <HStack gap="8px" minW={0}>
      <Box
        flexShrink={0}
        lineHeight={0}
        color={broken ? 'red.fg' : hasContract ? 'brand.text' : 'fg.subtle'}
      >
        {icon ?? <Braces size={14} />}
      </Box>
      <Text
        fontSize="xs"
        fontFamily="mono"
        truncate
        color={broken ? 'red.fg' : hasContract ? 'fg.default' : 'fg.subtle'}
        data-testid={`${testId}-preview`}
      >
        {broken ? brokenLabel : preview}
      </Text>
      <Box flex="1" />
      {hasContract || readOnly ? null : (
        <Box flexShrink={0} lineHeight={0} color="fg.subtle">
          <Plus size={13} />
        </Box>
      )}
    </HStack>
  );

  if (readOnly) {
    return (
      <Field.Root w="full" minW={0}>
        <Field.Label color="fg.muted" mb={DIALOG_PAD.labelMb}>
          {label}
        </Field.Label>
        <HStack
          w="full"
          h="34px"
          gap="0"
          borderWidth="1px"
          borderColor={broken ? 'red.solid' : 'transparent'}
          borderRadius="md"
          overflow="hidden"
          transition="background-color 0.12s ease, border-color 0.12s ease"
          _hover={hasContract ? { bg: 'bg.muted', borderColor: 'border.strong' } : undefined}
        >
          {hasContract ? (
            <SlotRow
              role="button"
              tabIndex={0}
              flex="1"
              minW={0}
              h="full"
              px="10px"
              display="flex"
              alignItems="center"
              cursor="pointer"
              onClick={onOpen}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onOpen();
                }
              }}
              data-testid={`${testId}-view`}
            >
              {digest}
            </SlotRow>
          ) : (
            <Box flex="1" minW={0} px="10px" display="flex" alignItems="center">
              {digest}
            </Box>
          )}
        </HStack>
      </Field.Root>
    );
  }

  return (
    <Field.Root w="full" minW={0}>
      <Field.Label color="fg.muted" mb={DIALOG_PAD.labelMb}>
        {label}
      </Field.Label>

      <HStack
        w="full"
        h="34px"
        gap="0"
        borderWidth="1px"
        /* Quiet at rest like the inputs around it, for the same reason: a
           contract you are only reading does not need a frame. */
        borderColor={broken ? 'red.solid' : 'transparent'}
        borderRadius="md"
        bg="transparent"
        overflow="hidden"
        transition="background-color 0.12s ease, border-color 0.12s ease"
        _hover={{
          bg: 'bg.muted',
          borderColor: broken ? 'red.solid' : 'border.strong',
          '& [data-contract-clear]': { opacity: 1 },
        }}
      >
        <SlotButton
          type="button"
          flex="1"
          minW={0}
          h="full"
          px="10px"
          textAlign="left"
          cursor="pointer"
          onClick={onOpen}
          /* The row is the edit control, so it carries the id the buttons used
             to — which of the two depends on whether there is anything yet. */
          data-testid={`${testId}-${hasContract ? 'edit' : 'add'}`}
        >
          {digest}
        </SlotButton>

        {hasContract ? (
          <SlotButton
            type="button"
            data-contract-clear=""
            aria-label={t('json_contract_clear')}
            title={t('json_contract_clear')}
            h="full"
            px="9px"
            cursor="pointer"
            lineHeight={0}
            color="fg.muted"
            opacity={0}
            _hover={{ color: 'red.400' }}
            _focusVisible={{ opacity: 1 }}
            onClick={onClear}
            data-testid={`${testId}-clear`}
          >
            <Trash2 size={13} />
          </SlotButton>
        ) : null}
      </HStack>
    </Field.Root>
  );
}
