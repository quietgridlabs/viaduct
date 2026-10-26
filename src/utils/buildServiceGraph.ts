/**
 * The whole project as one graph of services.
 *
 * The C4 canvas shows one level at a time, which is the right way to read a
 * model and the wrong way to answer "what talks to what". This flattens the
 * levels that stand for a deployable thing — systems and containers — into a
 * single picture: one orb per service, one line per connection somebody
 * actually drew.
 *
 * Components and code are left out on purpose. They are the inside of a
 * service, not a service, and folding them in turns the graph into the same
 * wall of boxes the level view already is.
 *
 * People (kind `person`, or technology `users`) are left out for the same
 * reason: they are actors around the system, not a service that talks to
 * another service. Edges that only reached them simply disappear with them.
 *
 * Clones are folded into their original: a second card for one element is the
 * point of a level diagram, and a lie in a graph of what talks to what. Their
 * connections are re-aimed at the original so the picture shows one service
 * with everything that reaches it.
 *
 * Positions are computed here rather than read off the blocks. A block's
 * stored position belongs to its own level's canvas, where systems and
 * containers are laid out independently and would land on top of each other.
 */
import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';
import type { Edge, Node } from '@xyflow/react';
import { isPersonTechnology } from '@data/technologies';
import { isPersonEntity } from '@/types/c4Extensions';
import type { BlockLike } from './neighborhoodHighlight';
import { isRemoteCloneBlock } from './cloneSource';
import { layoutServiceGraph, type GraphPosition } from './layoutServiceGraph';

/** Actors around the model — people — are not services in this picture. */
function isActor(item: { kind?: string; technology?: string }): boolean {
  return isPersonEntity(item) || isPersonTechnology(item.technology);
}

/** Diameter of the circle. The label sits under it, outside this box. */
export const SERVICE_ORB_SIZE = 64;

/** The sides an edge can leave from, as ServiceOrbNode names its handles. */
export const ORB_HANDLE_SIDES = ['top', 'right', 'bottom', 'left'] as const;

/**
 * Which side of each circle a line should use.
 *
 * The tree can fan left, right or down, so a neighbour can sit in any
 * direction. Picking the two sides that face each other keeps the line
 * straight; with a fixed left-to-right pair, a service directly above its
 * neighbour got an edge that left rightwards, curved back over itself and
 * arrived from the left.
 */
function sidesFor(
  from: GraphPosition,
  to: GraphPosition
): { sourceHandle: string; targetHandle: string } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourceHandle: 's-right', targetHandle: 't-left' }
      : { sourceHandle: 's-left', targetHandle: 't-right' };
  }
  return dy >= 0
    ? { sourceHandle: 's-bottom', targetHandle: 't-top' }
    : { sourceHandle: 's-top', targetHandle: 't-bottom' };
}

export type ServiceOrbLevel = 'system' | 'container';

export type ServiceOrbData = {
  name: string;
  technology?: string;
  level: ServiceOrbLevel;
  /** The owning system, shown under a container so two "api"s stay apart. */
  parentName?: string;
  /** The system to draw a frame round this one with, if it is in one. */
  group?: string;
  /* Written onto the node while "Highlight connections" is on — see the
     service-graph pass in EditorCanvasGraph. */
  traceHighlight?: boolean;
  traceDimmed?: boolean;
  [key: string]: unknown;
};

export type ServiceGraph = {
  nodes: Node[];
  edges: Edge[];
  /** Services drawn. Zero means the model has no systems or containers yet. */
  count: number;
  /**
   * The same services as a connection pool, for `resolveNeighborhoodIn`.
   *
   * "Highlight connections" asks which elements are one hop from this one, and
   * the answer depends on which elements are on screen. The level view asks
   * that of its own level; here the pool spans two, so the graph hands out the
   * pool it drew rather than letting the caller guess at it.
   */
  services: BlockLike[];
};

type Candidate = {
  id: string;
  name: string;
  technology?: string;
  level: ServiceOrbLevel;
  /** The system it belongs in: itself for a system, the owner for a container. */
  unitId: string;
  parentName?: string;
  /**
   * Set when this is a clone of another element in this model.
   *
   * A clone whose original lives in another project (`original.projectId`) is
   * left out of this: there is nothing here to fold it into, and dropping it
   * would lose the element from the picture altogether.
   */
  originalId?: string;
  connections: { targetId: string; label?: string; bidirectional?: boolean }[];
};

export async function buildServiceGraph(model: FlatC4Model): Promise<ServiceGraph> {
  const systemNameById = new Map<string, string>();
  for (const system of model.systems || []) {
    systemNameById.set(system.id, system.name);
  }

  const candidates: Candidate[] = [
    ...(model.systems || [])
      .filter((system) => !isActor(system))
      .map((system) => ({
        id: system.id,
        name: system.name,
        technology: system.technology,
        level: 'system' as const,
        unitId: system.id,
        originalId: isRemoteCloneBlock(system) ? undefined : system.original?.id,
        connections: system.connections || [],
      })),
    ...(model.containers || [])
      .filter((container) => !isActor(container))
      .map((container) => ({
        id: container.id,
        name: container.name,
        technology: container.technology,
        level: 'container' as const,
        /* A container whose system is missing stands on its own rather than
           disappearing into a frame that is not there. */
        unitId: systemNameById.has(container.systemId) ? container.systemId : container.id,
        parentName: systemNameById.get(container.systemId),
        originalId: isRemoteCloneBlock(container) ? undefined : container.original?.id,
        connections: container.connections || [],
      })),
  ].filter((candidate) => Boolean(candidate.id));

  if (!candidates.length) return { nodes: [], edges: [], count: 0, services: [] };

  const canonical = resolveClones(candidates);
  /* The clones are gone from the picture; what they were connected to is not.
     Everything from here on speaks in canonical ids. */
  const drawn = candidates.filter((candidate) => canonical.get(candidate.id) === candidate.id);
  const present = new Set(drawn.map((candidate) => candidate.id));
  for (const candidate of drawn) {
    candidate.unitId = canonical.get(candidate.unitId) ?? candidate.unitId;
  }

  /* Only connections whose far end is also an orb. A container wired to a
     component has nothing to point at here, and a dangling edge would draw
     from somewhere to nowhere. Every candidate is walked — clones included —
     so what a clone was wired to still shows on the original. Both ends go
     through `canonical`, so two clones of the same pair collapse into one
     line and a clone wired to its own original says nothing at all. */
  const links: { sourceId: string; targetId: string; bidirectional?: boolean }[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const sourceId = canonical.get(candidate.id) ?? candidate.id;
    if (!present.has(sourceId)) continue;
    for (const connection of candidate.connections) {
      const targetId = canonical.get(connection?.targetId) ?? connection?.targetId;
      if (!targetId || targetId === sourceId) continue;
      if (!present.has(targetId)) continue;
      const key = `${sourceId}->${targetId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({
        sourceId,
        targetId,
        bidirectional: connection.bidirectional,
      });
    }
  }

  /* Downward from the busiest service — see layoutServiceGraph for why a
     project map cannot use the level canvas's left-to-right ranking. */
  /* Containment is handed to the layout as the forest it is: a container is
     a child of its system, a system is a root. ELK ranks the children inside
     their parent's box, which is what makes the picture nested instead of
     flat. A container whose system is gone stands on its own. */
  const { positions } = await layoutServiceGraph(
    drawn.map((candidate) => ({
      id: candidate.id,
      parentId: candidate.level === 'container' ? candidate.unitId : undefined,
    })),
    links
  );

  /* Systems with something inside them. The rest stand alone. */
  const framed = new Set(
    drawn.filter((c) => c.unitId !== c.id).map((c) => c.unitId)
  );

  const orbs: Node[] = drawn.map((candidate) => ({
    id: candidate.id,
    type: 'serviceOrb',
    position: positions.get(candidate.id) ?? { x: 0, y: 0 },
    /*
     * An orb is a 64px circle in a box roughly twice that wide, because the
     * name underneath needs room to wrap — so most of the node is air. Caught,
     * that air behaved like the orb: it turned the cursor, lit the node up and
     * could be grabbed to drag it, all before the pointer reached anything
     * drawn. The two visible parts take the pointer back (`pointerEvents` in
     * ServiceOrbNode), and events raised on them still bubble out through here,
     * so React Flow's drag, selection and click work exactly as before.
     *
     * It has to be said here rather than in a stylesheet: React Flow writes
     * `pointer-events: all` inline on the node, and only `node.style` — which
     * it spreads after its own — can override that without `!important`.
     */
    style: { pointerEvents: 'none' },
    data: {
      name: candidate.name,
      technology: candidate.technology,
      level: candidate.level,
      parentName: candidate.level === 'container' ? candidate.parentName : undefined,
      /*
       * The system this belongs in, which is how the canvas comes to draw a
       * frame round it: `buildGroupFrameNodes` buckets nodes by `data.group`
       * and fits a labelled frame to each bucket, and `moveGroupFrame` moves
       * a bucket when its frame is dragged.
       *
       * Letting it do that rather than emitting frames from the boxes ELK
       * computed is what makes them behave like every other group on the
       * canvas: they are refitted from wherever the orbs are now, so dragging
       * a service drags its system's frame with it and dragging the frame
       * takes the services along. A frame built once sits still while
       * everything inside it moves away.
       *
       * Only where there is something to frame — a system on its own is just
       * an orb.
       */
      group: framed.has(candidate.unitId) ? systemNameById.get(candidate.unitId) : undefined,
    } satisfies ServiceOrbData,
  }));

  const origin = { x: 0, y: 0 };
  /* No connection labels on the graph: this view is "what talks to what",
     and mid-edge text turns a dense service map into noise. Level diagrams
     still carry labels; they live on the stored connections, not here. */
  const edges: Edge[] = links.map((link) => ({
    id: `service-graph:${link.sourceId}->${link.targetId}`,
    source: link.sourceId,
    target: link.targetId,
    ...sidesFor(
      positions.get(link.sourceId) ?? origin,
      positions.get(link.targetId) ?? origin
    ),
    animated: false,
  }));

  /* Only the links that survived the filter above: a highlight must light the
     lines that are drawn, not the ones the model happens to hold. */
  const services: BlockLike[] = drawn.map((candidate) => ({
    id: candidate.id,
    connections: links
      .filter((link) => link.sourceId === candidate.id)
      .map((link) => ({ targetId: link.targetId, bidirectional: link.bidirectional })),
  }));

  return { nodes: orbs, edges, count: orbs.length, services };
}

/**
 * Every id folded onto the element it really stands for.
 *
 * A clone is a second card for one element, put on a diagram where that
 * element is also needed. On a level diagram that is the point. In a graph of
 * what talks to what it is a lie: the same service appears three times, each
 * copy holding a share of its connections, and none of them shows what the
 * service actually talks to.
 *
 * So a clone is folded into its original and its connections are re-aimed
 * there, and a clone of a clone follows the chain to the end of it.
 *
 * A chain that loops — a model that should not exist — picks the lowest id in
 * the loop and folds the rest onto that. Simply stopping leaves every member
 * pointing at another member and none at itself, and since what is drawn is
 * what stands for itself, the whole loop would vanish from the picture.
 */
function resolveClones(candidates: Candidate[]): Map<string, string> {
  const originalOf = new Map<string, string>();
  const ids = new Set(candidates.map((candidate) => candidate.id));
  for (const candidate of candidates) {
    /* Only onto an original that is itself in the picture. A clone of a
       component, or of an element in another project, has nothing here to
       fold into and stays as it is. */
    if (candidate.originalId && ids.has(candidate.originalId)) {
      originalOf.set(candidate.id, candidate.originalId);
    }
  }

  const canonical = new Map<string, string>();
  for (const id of ids) {
    let current = id;
    const walked = new Set<string>([id]);
    let looped = false;
    while (originalOf.has(current)) {
      const next = originalOf.get(current)!;
      if (walked.has(next)) {
        looped = true;
        break;
      }
      walked.add(next);
      current = next;
    }
    canonical.set(id, looped ? [...walked].sort()[0] : current);
  }
  return canonical;
}
