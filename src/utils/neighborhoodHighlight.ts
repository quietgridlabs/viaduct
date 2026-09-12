import type { FlatC4Model } from '@archivisio/c4-modelizer-sdk';

export type FlowEdgeMotion = 'forward' | 'reverse';

export type NeighborhoodHighlight = {
  /** Focus node + immediate graph neighbors on the current level. */
  nodeIds: Set<string>;
  /** Edges between the focus and those neighbors (`source->target`). */
  edgeIds: Set<string>;
  /** Travel direction along the C4 edge path (`source->target`). */
  flowMotion?: Map<string, FlowEdgeMotion>;
};

type BlockLike = {
  id: string;
  connections?: { targetId: string; bidirectional?: boolean }[];
};

function blocksForView(model: FlatC4Model): BlockLike[] {
  switch (model.viewLevel) {
    case 'system':
      return model.systems;
    case 'container':
      return model.containers;
    case 'component':
      return model.components;
    case 'code':
      return model.codeElements;
    default:
      return [];
  }
}

/**
 * Highlight the focus node and its immediate neighbors only (1 hop, both
 * directions). Bidirectional edges count both ways. Does not walk further
 * along the chain.
 */
export function resolveNeighborhood(
  model: FlatC4Model,
  nodeId: string
): NeighborhoodHighlight {
  const pool = blocksForView(model);
  const byId = new Map(pool.map((b) => [b.id, b]));
  if (!byId.has(nodeId)) {
    return { nodeIds: new Set(), edgeIds: new Set() };
  }

  const nodeIds = new Set<string>([nodeId]);
  const edgeIds = new Set<string>();

  for (const block of pool) {
    for (const conn of block.connections || []) {
      if (!byId.has(conn.targetId)) continue;
      const a = block.id;
      const b = conn.targetId;
      const touchesFocus = a === nodeId || b === nodeId;
      if (!touchesFocus) continue;

      edgeIds.add(`${a}->${b}`);
      nodeIds.add(a);
      nodeIds.add(b);
    }
  }

  return { nodeIds, edgeIds };
}

export function isNeighborhoodEdge(
  highlight: NeighborhoodHighlight,
  source: string,
  target: string
): boolean {
  return (
    highlight.edgeIds.has(`${source}->${target}`) ||
    highlight.edgeIds.has(`${target}->${source}`)
  );
}

/** Direction to animate along the rendered C4 edge (source → target). */
export function flowMotionForEdge(
  highlight: NeighborhoodHighlight,
  source: string,
  target: string
): FlowEdgeMotion | undefined {
  const motion = highlight.flowMotion;
  if (!motion) return undefined;
  const direct = motion.get(`${source}->${target}`);
  if (direct) return direct;
  const opposite = motion.get(`${target}->${source}`);
  if (opposite === 'forward') return 'reverse';
  if (opposite === 'reverse') return 'forward';
  return undefined;
}
