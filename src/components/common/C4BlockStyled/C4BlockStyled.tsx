import { useColorMode } from '@contexts/ColorModeContext';
import type { ColorStyle } from '@theme/theme';
import {
  CANVAS_NODE_RADIUS,
  CANVAS_NODE_WIDTH,
  getNodeSurface,
  resolveNodeAccent,
  withAlpha,
  type PlainRole,
} from '@theme/canvasSurfaces';
import { DIFF_COLORS, type DiffStatus } from '@theme/diffColors';
import {
  Badge,
  Box,
  IconButton,
  Portal,
  Text,
  Tooltip,
  type BoxProps,
  type IconButtonProps,
} from '@chakra-ui/react';
import { LocateFixed, User, ZoomIn } from 'lucide-react';
import { forwardRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/** Compact tooltip for canvas node action buttons. */
export function NodeTooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip.Root openDelay={350} closeDelay={80} positioning={{ placement: 'top' }}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Portal>
        <Tooltip.Positioner>
          <Tooltip.Content
            bg="bg.dialog"
            color="fg.default"
            borderWidth="1px"
            borderColor="border.default"
            px="8px"
            py="4px"
            fontSize="xs"
            borderRadius="md"
            boxShadow="md"
          >
            {label}
          </Tooltip.Content>
        </Tooltip.Positioner>
      </Portal>
    </Tooltip.Root>
  );
}

export function BlockContainer({
  children,
  opacity,
  ...rest
}: BoxProps & { children?: ReactNode }) {
  return (
    <Box bg="transparent" borderRadius={CANVAS_NODE_RADIUS} opacity={opacity} {...rest}>
      {children}
    </Box>
  );
}

export type NodeShape = 'card' | 'cylinder';

type StyledCardProps = BoxProps & {
  colorstyles: ColorStyle;
  selected: boolean;
  /** Paint with the neutral accent (third-party systems, people). */
  neutralAccent?: boolean;
  /** Set when colours are off; picks the ours / theirs panel. */
  plainRole?: PlainRole;
  traceHighlight?: boolean;
  /** Sits at one end of the currently selected connection. */
  linkedHighlight?: boolean;
  /** Set while comparing two versions — overrides the technology accent. */
  diffStatus?: DiffStatus;
  /** At the end of someone else's change — the same colour, much quieter. */
  diffTouch?: DiffStatus;
  hasDescription?: boolean;
  /** Datastores are drawn as cylinders, the way C4 draws them on paper. */
  shape?: NodeShape;
  children?: ReactNode;
};

/** Height of the elliptical cap that turns a card into a cylinder. */
export const CYLINDER_CAP = 20;

/** Glyph tile plus its gap — the space a person card adds above the rectangle. */
export const PERSON_GLYPH_SIZE = 60;
export const PERSON_GLYPH_GAP = 10;
export const PERSON_GLYPH_BLOCK = PERSON_GLYPH_SIZE + PERSON_GLYPH_GAP;

export function StyledCard({
  colorstyles,
  selected,
  neutralAccent,
  plainRole,
  traceHighlight,
  linkedHighlight,
  diffStatus,
  diffTouch,
  hasDescription,
  shape = 'card',
  children,
  ...rest
}: StyledCardProps) {
  const { mode } = useColorMode();

  /* Comparison colour overrides everything else about the card's accent —
     deliberately bypassing `resolveNodeAccent`'s external/neutral fallback.
     Without this an added or changed *external* system would fall back to
     the plain neutral grey and lose the one signal the diff view exists to
     show; "this changed" has to outrank "this is someone else's system". */
  const diffAccent = diffStatus ? DIFF_COLORS[mode][diffStatus] : null;
  /*
   * The quiet half of the diff palette. An element that did not change but is
   * one end of a connection that did still has to be findable — at full
   * strength it would claim to be new work, which is the reading this view
   * exists to keep honest.
   */
  const touchAccent =
    !diffAccent && diffTouch ? withAlpha(DIFF_COLORS[mode][diffTouch], 0.55) : null;
  const accent =
    diffAccent ?? touchAccent ?? resolveNodeAccent(colorstyles.border, mode, neutralAccent);
  const gone = diffStatus === 'gone';

  const state =
    diffStatus === 'added' || diffStatus === 'changed'
      ? 'highlight'
      : traceHighlight
        ? 'highlight'
        : selected
          ? 'selected'
          : linkedHighlight
            ? 'linked'
            : 'idle';
  const surface = getNodeSurface(accent, mode, state, plainRole);
  /* Hover is the quietest state there is, so it only speaks when nothing
     louder already has. It used to be applied on top of whatever the card was
     doing, which meant pointing at a selected card swapped its ring for the
     faint hover one and taking the pointer away snapped the strong one back —
     the card looked like it thickened as you left it alone. */
  const hoverSurface =
    state === 'idle' ? getNodeSurface(accent, mode, 'hover', plainRole) : surface;
  const cylinder = shape === 'cylinder';
  const emphasized =
    Boolean(diffAccent) || Boolean(touchAccent) || selected || traceHighlight || linkedHighlight;
  const borderColor = gone ? accent : emphasized ? accent : surface.border;
  /* Two pixels is "this changed"; the touched card keeps the thin border and
     only borrows the colour. */
  const borderW = diffAccent || selected || traceHighlight ? '2px' : '1px';

  return (
    <Box
      className="tech-card"
      w={`${CANVAS_NODE_WIDTH}px`}
      position="relative"
      pt={cylinder ? `${CYLINDER_CAP / 2}px` : undefined}
      borderRadius={CANVAS_NODE_RADIUS}
      transition="box-shadow 0.15s ease"
      /* Fading a dimmed or ghosted element happens one level up, on the
         wrapper — a person's glyph stands outside this card and has to fade
         with it, or an actor stays bright while its own name goes grey. */
      boxShadow={gone || cylinder ? undefined : surface.shadow}
      _hover={gone || cylinder ? undefined : { boxShadow: hoverSurface.shadow }}
      css={{
        '--node-accent': accent,
        '--node-chip-bg': surface.chipBg,
        '--node-chip-border': surface.chipBorder,
        '--node-tint': gone ? 'transparent' : surface.tint,
      }}
      {...rest}
    >
      {cylinder ? (
        /*
         * Top cap of the cylinder — the lid you look down on.
         *
         * It reads as a lid because it is washed a shade apart from the face
         * below, which is also what draws its lower edge: a curve where one
         * fill meets the other, with no stroke along it. Filled like the body
         * it stopped being an ellipse at all, and hidden behind the body its
         * lower edge became the body's square top — a straight line across a
         * round vessel.
         *
         * Only the bottom border is dropped, so the drawn outline runs from
         * one side of the card round the top to the other and joins the body's
         * own sides.
         */
        <Box
          position="absolute"
          top="0"
          left="0"
          right="0"
          h={`${CYLINDER_CAP}px`}
          borderRadius="50%"
          bg={surface.bg}
          backgroundImage={
            gone ? undefined : `linear-gradient(${surface.headerBg}, ${surface.headerBg})`
          }
          borderWidth={borderW}
          borderBottomWidth="0"
          borderStyle={gone ? 'dashed' : 'solid'}
          borderColor={borderColor}
          pointerEvents="none"
          zIndex={1}
        />
      ) : null}
      <Box
        /* Lowered with the layout: the title row and the tools shelf are the
           only rows a card always has, so the floor sits just above them and
           content decides the rest. */
        minH={hasDescription ? '128px' : '92px'}
        h="auto"
        maxH={hasDescription ? '244px' : '132px'}
        /* A cylinder's floor is one shallow arc across the whole width, so the
           horizontal radius is half the card: the two corner arcs meet in the
           middle with no straight run between them. At a fixed radius they did
           not meet, and 190px of flat bottom read as a rounded rectangle. */
        borderRadius={
          cylinder
            ? `0 0 50% 50% / 0 0 ${CYLINDER_CAP}px ${CYLINDER_CAP}px`
            : CANVAS_NODE_RADIUS
        }
        position="relative"
        overflow="hidden"
        display="flex"
        flexDirection="column"
        bg={surface.bg}
        borderWidth={borderW}
        borderStyle={gone ? 'dashed' : 'solid'}
        borderTopWidth={cylinder ? '0' : borderW}
        borderColor={borderColor}
        boxShadow={gone ? 'none' : cylinder ? surface.shadow : undefined}
        transition="border-color 0.15s ease"
        _hover={gone ? undefined : { borderColor: surface.borderHover }}
        // A whisper of the accent across the whole face keeps colour coding
        // readable at low zoom, where a 1px border disappears. Skipped for a
        // ghost — it is not "this element, tinted", it is the absence of one.
        backgroundImage={gone ? undefined : 'linear-gradient(var(--node-tint), var(--node-tint))'}
      >
        {children}
      </Box>
    </Box>
  );
}

const DIFF_TAG_LABEL: Record<DiffStatus, string> = {
  added: 'version_diff_tag_added',
  changed: 'version_diff_tag_changed',
  gone: 'version_diff_tag_gone',
};

/** The small pill naming what happened to this element in a version comparison. */
export function DiffTag({ status }: { status: DiffStatus }) {
  const { mode } = useColorMode();
  const { t } = useTranslation();
  const color = DIFF_COLORS[mode][status];
  const wash = DIFF_COLORS[mode][status === 'added' ? 'addedWash' : status === 'changed' ? 'changedWash' : 'gone'];
  return (
    <Badge
      alignSelf="flex-start"
      fontFamily="mono"
      fontSize="9px"
      fontWeight="700"
      letterSpacing="0.04em"
      textTransform="uppercase"
      px="6px"
      py="1px"
      borderRadius="full"
      color={color}
      bg={status === 'gone' ? 'transparent' : wash}
      borderWidth={status === 'gone' ? '1px' : undefined}
      borderStyle={status === 'gone' ? 'solid' : undefined}
      borderColor={status === 'gone' ? color : undefined}
    >
      {t(DIFF_TAG_LABEL[status])}
    </Badge>
  );
}

export function StyledCardContent({ children, ...rest }: BoxProps & { children?: ReactNode }) {
  const { chrome } = useColorMode();
  return (
    <Box
      p="12px"
      pb="10px"
      color={chrome.nodeText}
      overflow="hidden"
      flex="1"
      display="flex"
      flexDirection="column"
      {...rest}
    >
      {children}
    </Box>
  );
}

/** Top strip of a card: drill-down on the left, tools on the right. */
export function HeaderContainer({ children, ...rest }: BoxProps & { children?: ReactNode }) {
  return (
    <Box
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      gap="6px"
      minH="22px"
      {...rest}
    >
      {children}
    </Box>
  );
}

/** Icon + name — the line that identifies the element at a glance. */
export function TitleContainer({ children, ...rest }: BoxProps & { children?: ReactNode }) {
  return (
    <Box
      display="flex"
      alignItems="center"
      gap="10px"
      minW={0}
      {...rest}
    >
      {children}
    </Box>
  );
}

/** Technology logo, lit from behind with the element accent. */
export function NodeIcon({ children }: { children: ReactNode }) {
  return (
    <Box
      position="relative"
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
      flexShrink={0}
      w="38px"
      h="38px"
      _before={{
        content: '""',
        position: 'absolute',
        inset: '-2px',
        borderRadius: 'full',
        background: 'radial-gradient(circle, var(--node-chip-bg) 0%, transparent 70%)',
      }}
    >
      {children}
    </Box>
  );
}

/**
 * C4 person glyph. It is a separate tile above the card, not a badge on it —
 * that is how the notation reads: the actor is a head over a box, and the
 * connection arrives at the head.
 */
export function PersonGlyph() {
  const { chrome } = useColorMode();
  return (
    <Box
      display="flex"
      justifyContent="center"
      mb={`${PERSON_GLYPH_GAP}px`}
      pointerEvents="none"
      aria-hidden
    >
      <Box
        w={`${PERSON_GLYPH_SIZE}px`}
        h={`${PERSON_GLYPH_SIZE}px`}
        borderRadius="16px"
        display="flex"
        alignItems="center"
        justifyContent="center"
        bg="var(--node-panel)"
        backgroundImage="linear-gradient(var(--node-tint), var(--node-tint))"
        borderWidth="1px"
        borderStyle="solid"
        borderColor="var(--node-accent)"
        color="var(--node-accent)"
        boxShadow={chrome.shadowSm}
      >
        <User size={30} />
      </Box>
    </Box>
  );
}

/** `PostgreSQL` — the technology, sitting under the name it qualifies. */
export function NodeMeta({ children, ...rest }: BoxProps & { children?: ReactNode }) {
  const { chrome } = useColorMode();
  return (
    <Text
      textAlign="left"
      fontSize="11px"
      color={chrome.nodeTextMuted}
      overflow="hidden"
      textOverflow="ellipsis"
      whiteSpace="nowrap"
      {...rest}
    >
      {children}
    </Text>
  );
}

/** Magnifier that opens the level below — the canvas's drill-down affordance. */
export const DrillDownButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function DrillDownButton(props, ref) {
    return (
      <ActionIconButton ref={ref} {...props}>
        <ZoomIn size={14} />
      </ActionIconButton>
    );
  }
);

/** Locate the original card — clone cards never drill, they jump. */
export const JumpToOriginalButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function JumpToOriginalButton(props, ref) {
    return (
      <ActionIconButton ref={ref} {...props}>
        <LocateFixed size={14} />
      </ActionIconButton>
    );
  }
);

export function BlockTitle({ children, ...rest }: BoxProps & { children?: ReactNode }) {
  const { chrome } = useColorMode();
  return (
    <Box fontWeight="bold" color={chrome.nodeText} overflow="hidden" minW={0} {...rest}>
      {children}
    </Box>
  );
}

export function BlockTitleText({ children, ...rest }: { children?: ReactNode } & Record<string, unknown>) {
  return (
    <Text
      as="span"
      fontSize="15px"
      fontWeight="600"
      lineHeight="1.25"
      textAlign="left"
      overflow="hidden"
      display="-webkit-box"
      css={{
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        wordBreak: 'break-word',
      }}
      color="inherit"
      {...rest}
    >
      {children}
    </Text>
  );
}

/**
 * The tools shelf. It sits under the content rather than over the name, so the
 * band that survives zooming out — logo and name — stays free of chrome that
 * is unreadable at that size anyway.
 */
export function NodeToolbar({ children, ...rest }: BoxProps & { children?: ReactNode }) {
  const { chrome } = useColorMode();
  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="flex-end"
      mt="8px"
      pt="6px"
      borderTopWidth="1px"
      borderColor={chrome.nodeInsetBorder}
      minH="22px"
      {...rest}
    >
      {children}
    </Box>
  );
}

/**
 * The artefact badges. Every one of them renders nothing when it has nothing to
 * count, so an element with no contracts, docs, diagrams or flows leaves this
 * genuinely empty — and an empty shelf reads as a missing feature rather than
 * as an answer. `:empty` catches exactly that case and says so in words.
 */
export function ActionsContainer({
  children,
  emptyLabel,
  ...rest
}: BoxProps & { children?: ReactNode; emptyLabel?: string }) {
  const { chrome } = useColorMode();
  return (
    <Box
      display="flex"
      alignItems="center"
      gap="4px"
      flexShrink={0}
      minW={0}
      fontSize="11px"
      color={chrome.nodeTextMuted}
      data-empty-label={emptyLabel}
      css={emptyLabel ? { '&:empty::after': { content: 'attr(data-empty-label)' } } : undefined}
      {...rest}
    >
      {children}
    </Box>
  );
}

export type ActionIconButtonProps = IconButtonProps;

/**
 * Every tool on a card — magnifier, docs, sequences, flows, link, edit — is the
 * same flat ghost button: muted glyph at rest, the node's own accent on hover.
 * Colour on a card belongs to the element, not to its toolbar.
 */
export const ActionIconButton = forwardRef<HTMLButtonElement, ActionIconButtonProps>(
  function ActionIconButton({ children, ...props }, ref) {
    const { chrome } = useColorMode();
    return (
      <IconButton
        ref={ref}
        variant="ghost"
        size="xs"
        minW="22px"
        w="22px"
        h="22px"
        minH="22px"
        p="4px"
        borderRadius="7px"
        borderWidth="0"
        color={chrome.nodeTextMuted}
        bg="transparent"
        boxShadow="none"
        transition="background-color 0.12s ease, color 0.12s ease"
        _hover={{ bg: 'var(--node-chip-bg)', color: 'var(--node-accent)' }}
        _focusVisible={{ outline: 'none', bg: 'var(--node-chip-bg)' }}
        _active={{ bg: 'var(--node-chip-bg)' }}
        {...props}
      >
        {children}
      </IconButton>
    );
  }
);

export function DescriptionText({ children, ...rest }: { children?: ReactNode } & Record<string, unknown>) {
  const { chrome } = useColorMode();
  return (
    <Text
      mt="9px"
      textAlign="left"
      color={chrome.nodeTextMuted}
      overflow="hidden"
      textOverflow="ellipsis"
      display="-webkit-box"
      lineHeight="1.45em"
      maxH="4.35em"
      fontSize="12.5px"
      css={{
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical',
        wordBreak: 'break-word',
      }}
      {...rest}
    >
      {children}
    </Text>
  );
}

export function PathText({ children, ...rest }: { children?: ReactNode } & Record<string, unknown>) {
  const { chrome } = useColorMode();
  return (
    <Text
      mt="auto"
      pt="4px"
      color={chrome.nodeText}
      fontSize="10px"
      textAlign="right"
      fontStyle="italic"
      overflow="hidden"
      textOverflow="ellipsis"
      whiteSpace="nowrap"
      {...rest}
    >
      {children}
    </Text>
  );
}
