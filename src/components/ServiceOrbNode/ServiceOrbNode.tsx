import TechnologyIcon from '@components/TechnologyIcon';
import { SERVICE_ORB_SIZE, type ServiceOrbData } from '@utils/buildServiceGraph';
import { Box, Text, VStack } from '@chakra-ui/react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { BaseBlock } from '@archivisio/c4-modelizer-sdk';

/**
 * One service in the project graph: a circle carrying its technology mark,
 * with the name underneath.
 *
 * The circle is the whole node — no title row, no tools shelf. At this
 * altitude the question is which services exist and what they talk to, and a
 * card's worth of chrome per service answers neither while costing the room
 * that would have shown the next ten.
 *
 * The ring is coloured by level, with the same two tokens the canvas uses, so
 * a system still reads as a system next to a container.
 */
/* Kept in step with `ORB_HANDLE_SIDES` in buildServiceGraph, which names the
   side each edge should use. */
const ORB_SIDES = [
  { id: 'top', position: Position.Top },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
  { id: 'left', position: Position.Left },
] as const;

/* A point, not a dot: React Flow needs the element to measure, nothing more. */
const HANDLE_STYLE = {
  opacity: 0,
  width: 1,
  height: 1,
  border: 'none',
  minWidth: 0,
  minHeight: 0,
} as const;

export default function ServiceOrbNode({ data, selected }: NodeProps) {
  const orb = data as ServiceOrbData;
  const accent = orb.level === 'system' ? 'c4.system' : 'c4.container';
  /* Set while "Highlight connections" is on: one hop is lit, everything else
     steps back. The numbers are C4Block's, so the graph and the level view
     fade a thing to the same degree. */
  const dimmed = Boolean(orb.traceDimmed);
  const lit = Boolean(orb.traceHighlight);

  return (
    /*
     * The hit target is the circle and the name, and nothing else.
     *
     * This box is 120px wide so a long name has room to wrap, while the thing
     * it is a box for is a 64px circle — so roughly half of it is air. Left
     * catchable, that air turned the pointer and lit the node up well before
     * the cursor reached anything drawn, which is what it looked like.
     *
     * So the box itself takes no pointer events and hands them back to its two
     * visible parts. Hover still reaches here either way: hit testing finds
     * the deepest catchable element and then `:hover` applies to it *and every
     * ancestor*, so the group marker below fires from the circle or from the
     * name, and each lights the other.
     */
    <VStack
      /* `className`, not `role`: Chakra v3 compiles `_groupHover` to
         `.group:is(:hover, [data-hover]) &`, so the marker it looks for is the
         class. */
      className="group"
      gap="6px"
      w={`${SERVICE_ORB_SIZE + 56}px`}
      pointerEvents="none"
      opacity={dimmed ? 0.22 : 1}
      filter={dimmed ? 'grayscale(0.35) saturate(0.55)' : undefined}
      transition="opacity 0.15s ease"
    >
      <Box
        position="relative"
        w={`${SERVICE_ORB_SIZE}px`}
        h={`${SERVICE_ORB_SIZE}px`}
        /* The rounded corners are not catchable either: hit testing follows
           `border-radius`, so the target is the disc, not its bounding box. */
        pointerEvents="auto"
        cursor="pointer"
        borderRadius="full"
        display="flex"
        alignItems="center"
        justifyContent="center"
        bg="bg.dialog"
        borderWidth={selected || lit ? '2px' : '1px'}
        borderStyle="solid"
        borderColor={accent}
        boxShadow={selected || lit ? 'panel' : 'raised'}
        /* Pointing at a service is a thing somebody does dozens of times
           reading a graph, so it gets a colour change and a lift, not an
           animation to sit through. Properties named one by one — `transition`
           here would otherwise drop whatever else changes. */
        transition="box-shadow 0.12s ease, background-color 0.12s ease"
        /*
         * The ring that blooms outward on hover. Same figure, timings and
         * easing as a connection point growing under the pointer
         * (`.react-flow__handle::before` in index.css), so the two read as one
         * idea: this thing is reachable.
         *
         * Drawn as a pseudo-element rather than a wider border: a border would
         * move the icon by its own width, and an outline cannot be faded in
         * from the centre.
         */
        _before={{
          content: '""',
          position: 'absolute',
          inset: '-5px',
          borderRadius: 'full',
          borderWidth: '2px',
          borderStyle: 'solid',
          borderColor: accent,
          opacity: 0,
          transform: 'scale(0.88)',
          transition: 'opacity 0.12s ease, transform 0.12s ease',
          pointerEvents: 'none',
        }}
        _groupHover={{
          bg: 'bg.list.hover',
          boxShadow: 'panel',
          _before: { opacity: 0.5, transform: 'scale(1)' },
        }}
        /* The ring still appears — it is the cue — it just stops travelling to
           get there. Killing the transition rather than the transform: the
           hover rule that sets `scale(1)` is four classes deep and outranks
           anything written here, so overriding the transform would lose and
           the ring would travel anyway. With no transition it simply arrives. */
        _motionReduce={{ _before: { transition: 'none' } }}
        data-testid={`service-orb-${orb.level}`}
      >
        {/*
         * A point on each side of the circle, for both ends of an edge.
         *
         * They live on the circle rather than the wrapper around it: the
         * wrapper is 120px wide with the label inside, so a line aimed at its
         * left edge stopped short of the circle and below its middle. And
         * there are four of them because the tree fans in every direction — a
         * neighbour can sit left, right or below, and with only left and right
         * a line to the service directly above had to leave rightwards and
         * come back, which drew an S where a straight line belonged.
         * `buildServiceGraph` picks the pair facing each other.
         *
         * All invisible and unconnectable: the graph is a picture of the
         * model, not a place to wire one up.
         */}
        {ORB_SIDES.map(({ id, position }) => (
          <Handle
            key={`t-${id}`}
            type="target"
            id={`t-${id}`}
            position={position}
            isConnectable={false}
            style={HANDLE_STYLE}
          />
        ))}
        {orb.technology ? (
          <TechnologyIcon
            item={{ technology: orb.technology, name: orb.name } as unknown as BaseBlock}
            size={32}
            showTooltip={false}
          />
        ) : (
          /* No technology set — the initial stands in, so the orb still reads
             as a particular service rather than an empty hole. */
          <Text fontSize="20px" fontWeight="600" color={accent} lineHeight="1">
            {orb.name.trim().charAt(0).toUpperCase() || '?'}
          </Text>
        )}
        {ORB_SIDES.map(({ id, position }) => (
          <Handle
            key={`s-${id}`}
            type="source"
            id={`s-${id}`}
            position={position}
            isConnectable={false}
            style={HANDLE_STYLE}
          />
        ))}
      </Box>
      <VStack gap="0" maxW="100%" pointerEvents="auto" cursor="pointer">
        <Text
          fontSize="xs"
          fontWeight="500"
          color="fg.muted"
          textAlign="center"
          lineClamp={2}
          transition="color 0.12s ease"
          _groupHover={{ color: 'fg.default' }}
          title={orb.name}
        >
          {orb.name}
        </Text>
        {orb.parentName ? (
          <Text fontSize="10px" color="fg.subtle" textAlign="center" lineClamp={1}>
            {orb.parentName}
          </Text>
        ) : null}
      </VStack>
    </VStack>
  );
}
