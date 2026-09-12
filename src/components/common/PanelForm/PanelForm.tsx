import { Box, chakra, Editable, HStack, Text, VStack } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { editableQuietFocus, editableQuietSurface } from '../EditableFieldStyles';

/*
 * Every field in an element panel reads as a label and its value on one line.
 *
 * A label on its own line above each control doubled the number of lines in
 * the panel and left a ragged left edge, so nothing lined up with anything and
 * a form of eight fields needed scrolling to see six of them. Side by side the
 * labels form a column you can run your eye down, and the panel is a third
 * shorter for the same content.
 *
 * Done here rather than in each field because there are fourteen of them —
 * text, select, technology, tags, group, contract — and they all render their
 * own `Field.Root`. Matched on the field parts rather than on the generated
 * class names, which change between builds.
 *
 * The helper text and the character counter are not labels, so they fall into
 * the value column under the control where they belong. Baseline alignment
 * puts the label on the first line of whatever sits opposite, which is what
 * keeps it right for a one-line input and a four-line description alike.
 */
const FIELD_ROOT = '& > [data-scope="field"][data-part="root"]';

const FIELD_ROWS = {
  [FIELD_ROOT]: {
    display: 'grid',
    /* Measured against the labels themselves: the widest of them, "Ownership"
       with its hint mark, draws 87px, so the column is as wide as it needs to
       be and no wider. */
    gridTemplateColumns: '92px minmax(0, 1fr)',
    /* Tight: the label column already ends where its longest word does, and
       the run of empty space after it was the panel's widest feature. */
    columnGap: '4px',
    /* Not `baseline`: a disabled control has no text baseline to speak of, and
       the browser synthesises one from its bottom edge — which dropped the
       label of a read-only description below its own value. Aligned to the
       top instead, with the label nudged onto the first line of whatever sits
       opposite, which does not depend on the control's state. */
    alignItems: 'start',
  },
  [`${FIELD_ROOT} > [data-part="label"]`]: {
    gridColumn: 1,
    marginBottom: 0,
    paddingTop: '10px',
  },
  [`${FIELD_ROOT} > *:not([data-part="label"])`]: {
    gridColumn: 2,
  },
} as const;

/*
 * Controls that stay out of the way until they are wanted.
 *
 * A panel of eight framed, filled inputs is eight boxes shouting at once, and
 * a card's name is something you read far more often than you change. So the
 * value is just text on the panel until the pointer reaches it: hovering lays
 * a faint ground under it and shows a text caret, and clicking gives it its
 * border back and focus. Nothing moves — the frames are made transparent
 * rather than removed, so the box a field occupies at rest is the one it
 * fills when you are typing in it.
 *
 * The chevrons go with them, since a chevron on a value nobody is pointing at
 * is the same noise as the frame around it. They come back on hover, and while
 * the list is open.
 */
const TEXT_FIELD =
  '[data-scope="field"][data-part="input"], [data-scope="field"][data-part="textarea"]';
const COMBO_CONTROL = '[data-scope="combobox"][data-part="control"]';
const COMBO_INPUT = '[data-scope="combobox"][data-part="input"]';
const SELECT_TRIGGER = '[data-scope="select"][data-part="trigger"]';
const AFFORDANCE =
  '[data-scope="select"][data-part="indicator"], [data-scope="combobox"][data-part="trigger"], [data-scope="combobox"][data-part="clear-trigger"]';

const QUIET_CONTROLS = {
  [`& :is(${COMBO_INPUT}, ${SELECT_TRIGGER})`]: {
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    /* The frames were transparent already; this is what was still drawing
       each field as a raised box floating on the panel. */
    boxShadow: 'none',
    transition: 'background-color 0.12s ease, border-color 0.12s ease',
  },
  [`& ${COMBO_INPUT}`]: {
    cursor: 'text',
  },
  [`& ${SELECT_TRIGGER}`]: {
    cursor: 'pointer',
  },
  [`& ${SELECT_TRIGGER}:hover`]: {
    backgroundColor: 'bg.muted',
  },
  /* Keyed off the wrapper, so the ground appears wherever on the row the
     pointer is — the chevron sits outside the input itself. */
  [`& ${COMBO_CONTROL}:hover ${COMBO_INPUT}`]: {
    backgroundColor: 'bg.muted',
  },
  [`& ${COMBO_INPUT}:focus`]: {
    backgroundColor: 'bg.subtle',
    borderColor: 'border.focus',
    cursor: 'text',
  },
  [`& :is(${SELECT_TRIGGER}:focus-visible, ${SELECT_TRIGGER}[data-state="open"])`]: {
    backgroundColor: 'bg.subtle',
    borderColor: 'border.focus',
  },
  [`& :is(${AFFORDANCE})`]: {
    opacity: 0,
    cursor: 'pointer',
    transition: 'opacity 0.12s ease',
  },
  [`${FIELD_ROOT}:hover :is(${AFFORDANCE})`]: { opacity: 1 },
  [`${FIELD_ROOT}:focus-within :is(${AFFORDANCE})`]: { opacity: 1 },
} as const;

/* Reading: the values keep the shape they had, without the hand cursor and
   the hover ground promising an edit that is not on offer. Kept at full
   contrast rather than let the browser grey them out, since the point of
   opening the card is to read what it says. */
const READING_CONTROLS = {
  [`& :is(${TEXT_FIELD}, ${COMBO_INPUT}, ${SELECT_TRIGGER})`]: {
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    boxShadow: 'none',
    cursor: 'default',
    opacity: 1,
    color: 'fg.default',
  },
  [`& :is(${AFFORDANCE})`]: { opacity: 0 },
} as const;

export function panelFormCss(readOnly: boolean) {
  return readOnly ? { ...FIELD_ROWS, ...READING_CONTROLS } : { ...FIELD_ROWS, ...QUIET_CONTROLS };
}

const FRAMED =
  `${TEXT_FIELD}, ${COMBO_INPUT}, ${SELECT_TRIGGER}` as const;

/**
 * Framed controls that sit flush with the panel: same ground as the surface
 * they live on, with a border and radius so they still read as fields.
 */
export const panelFlushFieldCss = {
  [`& :is(${FRAMED})`]: {
    bg: 'transparent',
    boxShadow: 'none',
  },
  [`& :is(${FRAMED}):hover`]: {
    bg: 'transparent',
    boxShadow: 'none',
  },
  [`& :is(${FRAMED}):focus, & :is(${FRAMED}):focus-visible, & ${SELECT_TRIGGER}[data-state="open"]`]:
    {
      bg: 'transparent',
    },
} as const;

/* A real <fieldset>, so `disabled` reaches every control inside it — the
   browser's own way of saying "look, do not touch", and one nothing in here
   can forget to honour. Stripped of its default frame and spacing. */
const Fieldset = chakra('fieldset');

/* Laid out as if it were not there, so wrapping a run of rows in one does not
   move any of them. */
const sealed = (readOnly: boolean) => ({
  disabled: readOnly,
  display: 'contents' as const,
  border: '0',
  p: '0',
  m: '0',
  minW: 0,
});

export function PanelFieldset({
  readOnly,
  children,
}: {
  readOnly: boolean;
  children: ReactNode;
}) {
  return <Fieldset {...sealed(readOnly)}>{children}</Fieldset>;
}

/** The name field's inset, shared with the line under it so both start together. */
export const PANEL_NAME_PAD = '6px';

/**
 * The element's name, edited where it is read. Quiet like every other control
 * on the panel: text until the pointer arrives, a frame once it has focus.
 */
export function PanelNameInput({
  value,
  onChange,
  placeholder,
  testId = 'input_name',
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  testId?: string;
}) {
  const nameStyles = {
    ...editableQuietSurface,
    borderRadius: 'md',
    h: '28px',
    px: PANEL_NAME_PAD,
    minW: 0,
    fontSize: 'md',
    fontWeight: '600',
    color: 'fg.default',
    _focus: editableQuietFocus,
    _focusVisible: editableQuietFocus,
  };

  return (
    <Editable.Root
      value={value}
      onValueChange={(details) => onChange(details.value)}
      activationMode="click"
      selectOnFocus
      /*
       * Not "none": zag's Editable treats an outside click as CANCEL unless
       * the mode submits on blur, and CANCEL reverts to the value from
       * before typing started — then fires onValueChange with that reverted
       * value. Clicking the panel's own Save button is an outside click, so
       * the revert fired first and Save read the old name. "blur" makes an
       * outside click SUBMIT instead, which keeps the live value and does
       * not touch it further. Escape still cancels, as it should.
       */
      submitMode="blur"
      placeholder={placeholder}
      flex="1"
      minW={0}
      size="sm"
    >
      <Editable.Preview truncate data-testid={testId} {...nameStyles} />
      <Editable.Input data-testid={testId} {...nameStyles} />
    </Editable.Root>
  );
}

export type PanelIdentity = {
  icon?: ReactNode;
  name: string;
  meta?: string;
  onNameChange?: (next: string) => void;
  placeholder?: string;
};

/**
 * Name and mark in one column beside the icon, so the two share a left edge.
 * The name is already the head of the panel, so that is where it is edited.
 */
export function PanelIdentityHead({
  identity,
  title,
  readOnly = false,
  actions,
}: {
  identity: PanelIdentity;
  title: string;
  readOnly?: boolean;
  /** Sits on the name row — open, history, and the like. */
  actions?: ReactNode;
}) {
  const name = identity.onNameChange && !readOnly ? (
    <PanelNameInput
      value={identity.name}
      onChange={identity.onNameChange}
      placeholder={identity.placeholder || title}
    />
  ) : (
    <Text
      fontSize="md"
      fontWeight="600"
      truncate
      flex="1"
      minW={0}
      px={PANEL_NAME_PAD}
      /* Unnamed, and read-only, so there is no field to hold a
         placeholder: the hint stands in as the heading, and is
         muted so it reads as "not named" rather than as a name
         someone chose. */
      color={identity.name ? 'fg.default' : 'fg.subtle'}
      title={identity.name}
    >
      {identity.name || identity.placeholder || title}
    </Text>
  );

  return (
    <HStack gap="8px" minW={0} w="full" align="center">
      {identity.icon ? (
        <Box flexShrink={0} lineHeight={0}>
          {identity.icon}
        </Box>
      ) : null}
      <VStack align="stretch" gap="0" minW={0} flex="1">
        <HStack gap="8px" minW={0} w="full" align="center">
          {name}
          {actions ? <Box flexShrink={0}>{actions}</Box> : null}
        </HStack>
        {identity.meta ? (
          /* The same inset as the field above it: the input's own
             padding is what its text starts at. */
          <Text fontSize="xs" color="fg.muted" truncate px={PANEL_NAME_PAD}>
            {identity.meta}
          </Text>
        ) : null}
      </VStack>
    </HStack>
  );
}
