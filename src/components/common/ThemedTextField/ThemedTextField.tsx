import { useColorMode } from '@contexts/ColorModeContext';
import { fieldSurfaceStyles } from '@theme/formStyles';
import { Editable, Field, Input, Text, Textarea } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import {
  ChangeEvent,
  ReactNode,
  Ref,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { DIALOG_PAD } from '../BaseEditDialog';
import { editableQuietFocus, editableQuietSurface } from '../EditableFieldStyles';
import { usePanelFieldMode } from '../PanelFieldContext';

export type ThemedTextFieldProps = {
  label?: ReactNode;
  value?: string;
  defaultValue?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  fullWidth?: boolean;
  multiline?: boolean;
  minRows?: number;
  autoFocus?: boolean;
  margin?: 'none' | 'dense' | 'normal';
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  'data-testid'?: string;
  select?: boolean;
  children?: ReactNode;
  InputProps?: unknown;
  SelectProps?: unknown;
  size?: 'small' | 'medium';
  helperText?: ReactNode;
  error?: boolean;
  /** Hard cap; shows `n/max` under the field when set. */
  maxLength?: number;
  /** Override bottom margin (default matches dialog field rhythm). */
  mb?: string | number;
};

function panelFieldPadding(compact: boolean) {
  return compact
    ? { px: '8px', py: '4px', fontSize: 'sm', minH: '32px' }
    : { px: '12px', py: '8px', minH: '40px' };
}

export default function ThemedTextField({
  label,
  value,
  defaultValue,
  onChange,
  multiline,
  minRows = 3,
  autoFocus,
  placeholder,
  type = 'text',
  disabled,
  required,
  name,
  id,
  'data-testid': dataTestId,
  helperText,
  error,
  maxLength,
  mb = 0,
  size = 'medium',
}: ThemedTextFieldProps) {
  const { chrome } = useColorMode();
  const panelMode = usePanelFieldMode();
  const compact = size === 'small';

  const inputStyles = fieldSurfaceStyles(chrome);
  const { t } = useTranslation();
  /* An empty field with no frame around it is indistinguishable from no field
     at all, so it says what is missing — "No description", "No url". That is
     also the invitation to click, which is the only affordance a control
     without a border has left. */
  /*
   * A description grows to fit what is in it.
   *
   * At a fixed three rows the field was mostly empty for a one-line note and
   * scrolled for a full one, so the only way to read all 120 characters the
   * field accepts was to scroll a box with no visible frame — a scrollbar
   * appearing inside what looks like plain text. Height is set from the
   * content instead: reset to auto so the box shrinks back when text is
   * deleted, then measured. `rows` stays the floor, since `auto` falls back
   * to it.
   */
  const areaRef = useRef<HTMLTextAreaElement>(null);
  /* The textarea is display:none until the field is opened, so it can only be
     measured once it is on screen — the value has not changed at that moment,
     which is why this is tracked rather than left to `value` alone. */
  const [editing, setEditing] = useState(false);
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    /* Zero while an ancestor is display:none — a hidden panel would otherwise
       collapse the field and keep that height when it came back. */
    if (el.scrollHeight <= 0) return;
    /* `scrollHeight` is content plus padding and stops there, while the height
       we set is a border-box: without the two border pixels back the field is
       two short and scrolls by exactly that. */
    const style = window.getComputedStyle(el);
    const border =
      style.boxSizing === 'border-box'
        ? parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth)
        : 0;
    el.style.height = `${el.scrollHeight + border}px`;
  }, [value, multiline, panelMode, editing]);

  const emptyHint =
    placeholder ??
    (typeof label === 'string' && label
      ? t('field_empty', { label: label.toLowerCase() })
      : undefined);
  const length = typeof value === 'string' ? value.length : undefined;
  const atLimit = maxLength != null && length != null && length >= maxLength;

  const emitValue = useCallback(
    (next: string) => {
      onChange?.({
        target: { value: next },
        currentTarget: { value: next },
      } as ChangeEvent<HTMLInputElement | HTMLTextAreaElement>);
    },
    [onChange]
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (maxLength != null && e.target.value.length > maxLength) {
        const sliced = e.target.value.slice(0, maxLength);
        const target = e.target;
        const next = {
          ...e,
          target: { ...target, value: sliced },
          currentTarget: { ...e.currentTarget, value: sliced },
        } as ChangeEvent<HTMLInputElement | HTMLTextAreaElement>;
        onChange?.(next);
        return;
      }
      onChange?.(e);
    },
    [maxLength, onChange]
  );

  /* Both halves of the multiline field stand on the same floor, so opening it
     changes what you can do with the text and nothing about the layout. */
  const multilineMinH = compact ? '32px' : `${minRows * 1.4}em`;

  const quietStyles = {
    ...editableQuietSurface,
    borderRadius: 'md',
    ...panelFieldPadding(compact),
    color: 'fg.default',
    _placeholder: { color: 'fg.subtle' },
    _focus: editableQuietFocus,
    _focusVisible: editableQuietFocus,
  };

  const labelNode = label ? (
    <Field.Label
      color="fg.muted"
      mb={DIALOG_PAD.labelMb}
      ps={0}
      ms={0}
      w="full"
      display="block"
      lineHeight="1.2"
      _focusWithin={{ color: 'fg.default' }}
    >
      {label}
    </Field.Label>
  ) : null;

  const helperNode =
    helperText || maxLength != null ? (
      <Field.HelperText
        mt="6px"
        display="flex"
        justifyContent="space-between"
        gap="8px"
        color={error ? 'red.400' : chrome.textMuted}
      >
        <Text as="span" flex="1" minW={0}>
          {helperText}
        </Text>
        {maxLength != null && length != null ? (
          <Text
            as="span"
            flexShrink={0}
            fontSize="xs"
            color={atLimit ? 'brand.text' : 'fg.subtle'}
          >
            {length}/{maxLength}
          </Text>
        ) : null}
      </Field.HelperText>
    ) : null;

  if (panelMode && !disabled) {
    const placeholderProp = emptyHint
      ? { preview: emptyHint, edit: emptyHint }
      : undefined;

    return (
      <Field.Root
        invalid={error}
        required={required}
        mb={mb}
        w="full"
        alignItems="stretch"
      >
        {labelNode}
        <Editable.Root
          value={value ?? ''}
          onValueChange={(details) => {
            let next = details.value;
            if (maxLength != null) next = next.slice(0, maxLength);
            emitValue(next);
          }}
          activationMode="click"
          selectOnFocus
          /* See panelForm.tsx's PanelNameInput: "none" makes zag treat an
             outside click (e.g. the panel's own Save button) as CANCEL, which
             reverts to the pre-edit value and re-fires onValueChange with
             it — discarding whatever was just typed before Save ever reads
             it. "blur" submits instead of cancelling on an outside click. */
          submitMode="blur"
          defaultEdit={autoFocus}
          onEditChange={(details) => setEditing(details.edit)}
          placeholder={placeholderProp}
          maxLength={maxLength}
          name={name}
          w="full"
          size={compact ? 'sm' : 'md'}
        >
          {multiline ? (
            /*
             * No `autoResize` here, deliberately.
             *
             * It makes zag lay the preview and the textarea over each other in
             * one grid cell, and to size that cell it puts `white-space: pre`
             * on the preview as an *inline* style — which no class can beat.
             * A description then sat on one endless clipped line at rest and
             * wrapped into five the moment it was clicked. Without it the two
             * swap places instead of overlapping, and the height comes from
             * the measurement above, which is what it was always for.
             */
            <Editable.Area w="full">
              <Editable.Preview
                w="full"
                whiteSpace="pre-wrap"
                wordBreak="break-word"
                /* The preview is a flex box with a min-height, so a single
                   line sat centred in it while the textarea underneath starts
                   its text at the padding — the placeholder dropped twelve
                   pixels at rest and jumped back up on click. Measured both:
                   text at y=162 against y=150 in the same 58px box. */
                alignItems="flex-start"
                data-testid={dataTestId}
                {...quietStyles}
                minH={multilineMinH}
              />
              <Editable.Textarea
                ref={areaRef as Ref<HTMLInputElement>}
                id={id}
                w="full"
                resize="none"
                overflow="hidden"
                /* One row, floored by the same min-height the preview carries.
                   `rows` used to be the floor, and it is a different unit from
                   the preview's — an empty field grew nineteen pixels the
                   moment it was clicked and pushed the rest of the panel down
                   with it. Measured 39 against 58. */
                rows={1}
                data-testid={dataTestId}
                {...quietStyles}
                minH={multilineMinH}
              />
            </Editable.Area>
          ) : (
            <>
              <Editable.Preview
                w="full"
                truncate
                data-testid={dataTestId}
                {...quietStyles}
              />
              <Editable.Input
                id={id}
                type={type}
                w="full"
                data-testid={dataTestId}
                {...quietStyles}
              />
            </>
          )}
        </Editable.Root>
        {helperNode}
      </Field.Root>
    );
  }

  return (
    <Field.Root
      invalid={error}
      required={required}
      disabled={disabled}
      mb={mb}
      w="full"
      alignItems="stretch"
    >
      {labelNode}
      {multiline ? (
        <Textarea
          ref={areaRef}
          id={id}
          name={name}
          value={value ?? ''}
          defaultValue={defaultValue}
          onChange={handleChange}
          placeholder={emptyHint}
          autoFocus={autoFocus}
          rows={minRows}
          maxLength={maxLength}
          w="full"
          /* Both of these are the manual resize handle's doing: dragging a
             height only to have the next keystroke recompute it is a control
             that fights back, and its corner was the one mark left on an
             otherwise frameless field. */
          resize="none"
          overflow="hidden"
          data-testid={dataTestId}
          {...inputStyles}
        />
      ) : (
        <Input
          id={id}
          name={name}
          type={type}
          value={value ?? ''}
          defaultValue={defaultValue}
          onChange={handleChange}
          placeholder={emptyHint}
          autoFocus={autoFocus}
          maxLength={maxLength}
          data-testid={dataTestId}
          size="md"
          {...inputStyles}
        />
      )}
      {helperNode}
    </Field.Root>
  );
}
