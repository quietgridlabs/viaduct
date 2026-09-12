import {
  getTechnologyById,
  isDatabaseTechnology,
  isPersonTechnology,
} from '@data/technologies';
import { useCloneOriginLabel } from '@/hooks/useCloneOriginLabel';
import { BaseBlock } from '@archivisio/c4-modelizer-sdk';
import { ColorStyle } from '@theme/theme';
import {
  getNodeSurface,
  handleStyle,
  neutralAccentColor,
  readableAccent,
  resolveNodeAccent,
  withAlpha,
} from '@theme/canvasSurfaces';
import { useCanvasPrefs } from '@/state/canvasPrefs';
import { DIFF_COLORS, type DiffStatus } from '@theme/diffColors';
import { getElementTags, isExternalEntity, isPersonEntity } from '@/types/c4Extensions';
import { useColorMode } from '@contexts/ColorModeContext';
import { Box } from '@chakra-ui/react';
import { Handle, Position, useNodeConnections, useNodeId } from '@xyflow/react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import TechnologyIcon from '../../TechnologyIcon';
import NodeTagsRow from '../NodeTagsRow';
import UrlLinkBadge from '../UrlLinkBadge';
import {
  ActionsContainer,
  DrillDownButton,
  JumpToOriginalButton,
  BlockContainer,
  BlockTitle,
  BlockTitleText,
  DescriptionText,
  NodeToolbar,
  NodeIcon,
  NodeMeta,
  NodeTooltip,
  PathText,
  PersonGlyph,
  DiffTag,
  StyledCard,
  StyledCardContent,
  TitleContainer,
  CYLINDER_CAP,
  PERSON_GLYPH_BLOCK,
} from '../C4BlockStyled';

export type HandlePositions = {
  source: Position | Position[];
  target: Position | Position[];
};

export interface C4BlockProps {
  item: BaseBlock;
  selected?: boolean;
  onEdit: () => void;
  colors: ColorStyle;
  handlePositions?: HandlePositions;
  children?: React.ReactNode;
  traceHighlight?: boolean;
  traceDimmed?: boolean;
  /** Sits at one end of the currently selected connection. */
  linkedHighlight?: boolean;
  /** Set while comparing two versions. */
  diffStatus?: DiffStatus;
  /**
   * Not this card's own change — it sits at the end of one. Draws the diff
   * colour at a fraction of its strength, so a new connection is findable
   * without its two endpoints claiming to be new work themselves.
   */
  diffTouch?: DiffStatus;
  traceContainerLabel?: string;
  /** Extra header actions rendered before the edit button. */
  actionsBeforeEdit?: React.ReactNode;
  /** Level name shown in the meta line, e.g. "Service". */
  kindLabel?: string;
  /** Opens the level below; renders the magnifier when provided. */
  onDrillDown?: () => void;
  /** Clone card: jump to the original instead of local drill. */
  onJumpToOriginal?: () => void;
  /** Skip the artifacts toolbar (compare panes, thumbnails). */
  hideArtifacts?: boolean;
}

const createHandleStyle = (
  accent: string,
  mode: 'light' | 'dark',
  isSource = false,
  position?: Position,
  verticalOffset = 0,
  slot?: number
): React.CSSProperties =>
  handleStyle(accent, mode, {
    source: isSource,
    offsetY: verticalOffset,
    side: position === Position.Left || position === Position.Right,
    slot,
  }) as React.CSSProperties;

type HandleSlot = { id: string; testId: string; slot: number };

/**
 * Where a connection can land on one side of a card.
 *
 * One point per side meant every line in the diagram converged on the same
 * dot, so a card with four neighbours grew a fan. The long edges take three
 * points and the short ones two, which lets an edge leave from the end it is
 * heading for. A person is a small card under a glyph, and three dots along
 * its top would sit wider apart than the figure itself, so it keeps one.
 *
 * The slot nearest where the single point used to be keeps that point's id —
 * the middle one where there is a middle, the first otherwise — because
 * connections are saved against handle ids and an edge whose handle is missing
 * is silently not drawn. The rest are new ids, hence the suffix rather than a
 * renumbering.
 */
function handleSlots(
  type: 'source' | 'target',
  position: Position,
  index: number,
  person: boolean
): HandleSlot[] {
  const legacy = `${type}-${position}-${index}`;
  if (person) return [{ id: legacy, testId: legacy, slot: 0.5 }];
  const horizontal = position === Position.Top || position === Position.Bottom;
  const fractions = horizontal ? [0.25, 0.5, 0.75] : [0.34, 0.66];
  const inherits = horizontal ? 1 : 0;
  return fractions.map((slot, i) => {
    const id = i === inherits ? legacy : `${legacy}-s${i}`;
    return { id, testId: id, slot };
  });
}

const C4Block: React.FC<C4BlockProps> = ({
  item,
  selected = false,
  onEdit: _onEdit,
  colors,
  handlePositions = { source: Position.Bottom, target: Position.Top },
  children,
  traceHighlight = false,
  traceDimmed = false,
  linkedHighlight = false,
  diffStatus,
  diffTouch,
  traceContainerLabel,
  actionsBeforeEdit,
  kindLabel,
  onDrillDown,
  onJumpToOriginal,
  hideArtifacts = false,
}) => {
  const { t } = useTranslation();
  const { mode } = useColorMode();
  const { nodeColors } = useCanvasPrefs();
  const { technology, name, description } = item;
  const external = isExternalEntity(item as { external?: boolean });
  /* People read as "someone outside the software", the same role external
     systems play — so they share the neutral accent instead of taking the
     level colour. Computed here because the colourless board needs it too. */
  const externalOrPerson =
    external || isPersonEntity(item as { kind?: string }) || isPersonTechnology(item.technology);
  const tags = getElementTags(item);
  const techData = technology ? getTechnologyById(technology) : undefined;
  const cloneOriginLabel = useCloneOriginLabel(item);
  const isClone = Boolean(item.original);
  const jumpLabel = t('clone_jump_to_original');
  const drillLabel = t('zoom_in');
  const drillAction = !isClone && !onJumpToOriginal ? onDrillDown : undefined;
  const defaultColorStyle = colors;
  /* Technology drives the accent when there is one — pushed into the readable
     band for this theme instead of being swapped for grey. Unless the person
     asked for a colourless board, in which case nothing gets an accent, not
     even the C4 level: the point is a diagram read by shape and text alone. */
  const plainBoard = nodeColors === 'neutral';
  /* A version comparison overrides the accent outright — ahead of both the
     technology colour and the colourless-board neutral. "This changed" has to
     read regardless of what the element is built with or whether colour is on
     at all; the whole point of the diff view is that one signal. */
  const diffAccent = diffStatus ? DIFF_COLORS[mode][diffStatus] : null;
  const accent = diffAccent
    ? diffAccent
    : plainBoard
      ? neutralAccentColor(mode, externalOrPerson)
      : techData
        ? readableAccent(techData.color, mode)
        : colors.border;
  const colorStyles: ColorStyle = diffAccent || (techData && !plainBoard)
    ? {
        ...defaultColorStyle,
        primaryColor: accent,
        border: accent,
        hover: accent,
        background: withAlpha(accent, mode === 'light' ? 0.08 : 0.14),
        gradient: withAlpha(accent, mode === 'light' ? 0.1 : 0.16),
        gradientHover: withAlpha(accent, mode === 'light' ? 0.16 : 0.24),
        glow: `0 0 16px ${withAlpha(accent, mode === 'light' ? 0.18 : 0.28)}`,
      }
    : plainBoard
      ? { ...defaultColorStyle, primaryColor: accent, border: accent, hover: accent }
      : defaultColorStyle;

  /* Shape follows the element's role, the way C4 draws it: a datastore is a
     cylinder, a person gets the actor glyph, everything else stays a card.
     `kind: 'person'` is the explicit choice; the users technology is kept as a
     fallback so models built before the element existed still read right. */
  const person = isPersonEntity(item as { kind?: string }) || isPersonTechnology(technology);
  const shape = person
    ? 'person'
    : isDatabaseTechnology(technology)
      ? 'cylinder'
      : 'card';

  /* The glyph sits outside the card, so the accent variables live on the
     wrapper rather than on the card itself. */
  const plainRole = plainBoard ? (externalOrPerson ? 'external' : 'own') : undefined;
  /* Same override as `accent` above, and for the same reason: the wrapper
     feeds the person glyph and the connection handles, which must not fall
     back to the external-neutral grey and erase the diff colour either. */
  const nodeAccent = diffAccent ?? resolveNodeAccent(accent, mode, externalOrPerson);
  const wrapperSurface = getNodeSurface(nodeAccent, mode, 'idle', plainRole);

  /* Side handles belong on the rectangle, not on the node box: a person card
     carries the glyph above it and a datastore carries the cylinder cap, and
     both would push the dots off-centre. */
  const spaceAboveRectangle =
    shape === 'person'
      ? PERSON_GLYPH_BLOCK
      : shape === 'cylinder'
        ? CYLINDER_CAP / 2
        : 0;
  const sideHandleOffset = spaceAboveRectangle / 2;

  /* The level word is the same on every card of a level and says nothing next
     to twenty siblings; person and external are not, so they stay. */
  const metaLabel = person
    ? t('person_element')
    : external
      ? [t('external'), techData?.name].filter(Boolean).join(' · ')
      : techData?.name || kindLabel;

  /* A ghost has no handles at all. Connecting to an element that no longer
     exists is impossible (`connectable: false` already blocks it), but the
     dots still rendered and invited the attempt — on a dashed, half-faded
     card that reads as a bug rather than as a boundary. */
  const ghost = diffStatus === 'gone';

  /* Handles look like decoration at a small zoom, and dropping them there was
     worth 3 200 DOM elements on a 400-block level — but React Flow positions
     an edge by looking its endpoints' handles up by id, and an edge that fails
     that lookup is not drawn and is never retried. Unmounting them took the
     connections with them. Anything that hides a handle has to keep it in the
     graph; nothing here does that yet, so they always render. */
  const hideHandles = ghost;

  /*
   * Which connection points to show while nothing is happening.
   *
   * All of them, always, meant a resting board was a field of dots — four per
   * card, most of them wired to nothing. A point earns its ink by holding a
   * connection; the rest appear on hover, where the reader is asking to draw
   * one. `useNodeConnections` reads this node's own connections out of React
   * Flow's lookup, so it costs nothing per card.
   *
   * Target points stay hidden even when wired: an arrowhead already lands
   * there, and a dot behind the tip reads as two marks for one connection.
   */
  const nodeId = useNodeId();
  const connections = useNodeConnections();
  const wiring = useMemo(() => {
    const ids = new Set<string>();
    /* An edge saved without a handle id is placed on the node's first handle,
       so that is the one it lights up. */
    let unnamed = false;
    for (const connection of connections) {
      if (connection.source !== nodeId) continue;
      if (connection.sourceHandle) ids.add(connection.sourceHandle);
      else unnamed = true;
    }
    return { ids, unnamed };
  }, [connections, nodeId]);
  const wired = (id: string, index: number) =>
    wiring.ids.has(id) || (index === 0 && wiring.unnamed) ? 'true' : 'false';

  return (
    <>
      {hideHandles ? null : Array.isArray(handlePositions.target) ? (
        handlePositions.target.flatMap((position: Position, index: number) =>
          handleSlots('target', position, index, person).map((point) => (
            <Handle
              key={point.id}
              type="target"
              position={position}
              data-testid={point.testId}
              data-connected="false"
              id={point.id}
              style={createHandleStyle(
                nodeAccent,
                mode,
                false,
                position,
                sideHandleOffset,
                point.slot
              )}
            />
          ))
        )
      ) : (
        <Handle
          type="target"
          position={handlePositions.target}
          data-testid={`target-${handlePositions.target}`}
          data-connected="false"
          id={`target-${handlePositions.target}`}
          style={createHandleStyle(
            nodeAccent,
            mode,
            false,
            handlePositions.target,
            sideHandleOffset
          )}
        />
      )}
      <BlockContainer
        /* Everything the element is made of, faded together: the card and, for
           a person, the glyph above it. A clone's own half-opacity multiplies
           in rather than competing. */
        opacity={(item.original ? 0.5 : 1) * (ghost ? 0.55 : traceDimmed ? 0.22 : 1)}
        filter={traceDimmed ? 'grayscale(0.35) saturate(0.55)' : undefined}
        transition="opacity 0.15s ease"
        position="relative"
        css={{
          '--node-accent': nodeAccent,
          /* The person glyph sits outside the card but has to look like part of
             it — it needs the card's own panel, not the dialog surface. */
          '--node-panel': wrapperSurface.bg,
          '--node-tint': wrapperSurface.tint,
          '--node-chip-bg': wrapperSurface.chipBg,
          '--node-chip-border': wrapperSurface.chipBorder,
        }}
      >
        {shape === 'person' ? <PersonGlyph /> : null}
        <StyledCard
          colorstyles={colorStyles}
          selected={selected}
          neutralAccent={externalOrPerson}
          plainRole={plainRole}
          traceHighlight={traceHighlight}
          linkedHighlight={linkedHighlight}
          diffStatus={diffStatus}
          diffTouch={diffTouch}
          hasDescription={Boolean(description) || tags.length > 0 || Boolean(diffStatus)}
          shape={shape === 'cylinder' ? 'cylinder' : 'card'}
        >
          <StyledCardContent>
            {diffStatus && <DiffTag status={diffStatus} />}
            <TitleContainer>
              {technology && shape !== 'person' && (
                <NodeIcon>
                  <TechnologyIcon
                    item={{ technology, name } as unknown as BaseBlock}
                    size={30}
                  />
                </NodeIcon>
              )}

              {/* Takes the free space so the magnifier is pinned to the card's
                  edge instead of trailing whatever length the name happens to be. */}
              <BlockTitle flex="1" minW={0}>
                <BlockTitleText data-testid="block-title">{name}</BlockTitleText>
                {metaLabel ? <NodeMeta data-testid="block-meta">{metaLabel}</NodeMeta> : null}
              </BlockTitle>

              {onJumpToOriginal ? (
                <NodeTooltip label={jumpLabel}>
                  <JumpToOriginalButton
                    /* Pinned to the top of the row, not centred against it, so
                       its inset from the top edge matches its inset from the
                       right one. */
                    alignSelf="flex-start"
                    onClick={(e) => {
                      e.stopPropagation();
                      onJumpToOriginal();
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    aria-label={jumpLabel}
                    data-testid="block-jump-original-button"
                  />
                </NodeTooltip>
              ) : drillAction ? (
                <NodeTooltip label={drillLabel}>
                  <DrillDownButton
                    alignSelf="flex-start"
                    onClick={(e) => {
                      e.stopPropagation();
                      drillAction();
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    aria-label={drillLabel}
                    data-testid="block-drilldown-button"
                  />
                </NodeTooltip>
              ) : null}
            </TitleContainer>

            {description && <DescriptionText>{description}</DescriptionText>}

            {children}

            <Box mt="auto">
              <NodeTagsRow item={item} />
              {traceContainerLabel && <PathText>{traceContainerLabel}</PathText>}
              {isClone && cloneOriginLabel && <PathText>{cloneOriginLabel}</PathText>}
              {hideArtifacts ? null : (
                <NodeToolbar>
                  <ActionsContainer emptyLabel={t('node_no_artifacts')}>
                    <UrlLinkBadge item={item} ownerName={name} />
                    {actionsBeforeEdit}
                  </ActionsContainer>
                </NodeToolbar>
              )}
            </Box>
          </StyledCardContent>
        </StyledCard>
      </BlockContainer>

      {hideHandles ? null : Array.isArray(handlePositions.source) ? (
        handlePositions.source.flatMap((position: Position, index: number) =>
          handleSlots('source', position, index, person).map((point) => (
            <Handle
              key={point.id}
              type="source"
              position={position}
              data-testid={point.testId}
              data-connected={wired(point.id, index)}
              id={point.id}
              style={createHandleStyle(
                nodeAccent,
                mode,
                true,
                position,
                sideHandleOffset,
                point.slot
              )}
            />
          ))
        )
      ) : (
        <Handle
          type="source"
          position={handlePositions.source}
          id={`source-${handlePositions.source}`}
          data-testid={`source-${handlePositions.source}`}
          data-connected={wired(`source-${handlePositions.source}`, 0)}
          style={createHandleStyle(
            nodeAccent,
            mode,
            true,
            handlePositions.source,
            sideHandleOffset
          )}
        />
      )}
    </>
  );
};

export default C4Block;
