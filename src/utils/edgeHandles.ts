/**
 * Which side of a card a connection should leave from and arrive at.
 *
 * Handle ids match the arrays every C4 block passes to `C4Block`:
 *   source [Right, Bottom, Left, Top] → right-0, bottom-1, left-2, top-3
 *   target [Left, Top, Bottom, Right] → left-0, top-1, bottom-2, right-3
 *
 * A side also offers further points under `-sN` ids, but a person card has one
 * point per side and those ids do not exist on it — and an edge whose handle
 * id is missing is silently not drawn. So the plain four are what the side
 * pickers hand out, and only `routeArrangedEdges`, which is told which cards
 * are people, reaches for the rest.
 */

export type EdgeHandles = { sourceHandle: string; targetHandle: string };

const RIGHTWARD: EdgeHandles = {
  sourceHandle: 'source-right-0',
  targetHandle: 'target-left-0',
};
const LEFTWARD: EdgeHandles = {
  sourceHandle: 'source-left-2',
  targetHandle: 'target-right-3',
};
const DOWNWARD: EdgeHandles = {
  sourceHandle: 'source-bottom-1',
  targetHandle: 'target-top-1',
};
const UPWARD: EdgeHandles = {
  sourceHandle: 'source-top-3',
  targetHandle: 'target-bottom-2',
};

/**
 * Free placement: take whichever axis the other card is further along.
 * For diagrams whose positions came from a person dragging cards around.
 */
export function pickEdgeHandles(
  from: { x: number; y: number },
  to: { x: number; y: number }
): EdgeHandles {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? RIGHTWARD : LEFTWARD;
  return dy >= 0 ? DOWNWARD : UPWARD;
}

/**
 * Layered placement: the column decides, and only a card in the same column
 * routes vertically.
 *
 * The arranged view puts each rank in its own column and stacks that rank down
 * the page, so "further down than across" is the wrong question to ask of it.
 * A card one column over and four rows down is still the next step in the
 * flow, and sending that edge out of the bottom face makes it sweep back
 * across the card it came from — the long curves that made arranging look
 * worse than the hand-made layout it replaced. Across the columns the line
 * goes sideways however far down it has to reach; within a column, where
 * sideways would mean leaving and re-entering the same column, it goes
 * vertically.
 */
export function pickLayeredEdgeHandles(
  from: { x: number; y: number },
  to: { x: number; y: number }
): EdgeHandles {
  /* The layout gives a rank one exact x, so anything under a pixel apart is
     the same column rather than a near miss. */
  if (Math.abs(to.x - from.x) < 1) return to.y >= from.y ? DOWNWARD : UPWARD;
  return to.x > from.x ? RIGHTWARD : LEFTWARD;
}

// ── spreading several lines along one side ───────────────────────────────────

export type HandleSide = 'right' | 'left' | 'top' | 'bottom';

/** The array index each side sits at in the blocks' `handlePositions`. */
const SIDE_INDEX: Record<'source' | 'target', Record<HandleSide, number>> = {
  source: { right: 0, bottom: 1, left: 2, top: 3 },
  target: { left: 0, top: 1, bottom: 2, right: 3 },
};

const SIDE_OF: Record<string, HandleSide> = {
  'source-right-0': 'right',
  'source-left-2': 'left',
  'source-bottom-1': 'bottom',
  'source-top-3': 'top',
  'target-left-0': 'left',
  'target-right-3': 'right',
  'target-top-1': 'top',
  'target-bottom-2': 'bottom',
};

/**
 * Every attachment point one side offers, in order along that side.
 *
 * Mirrors `handleSlots` in `C4Block` — keep the two in step. A long side takes
 * three points and a short one two, and the slot nearest where the single
 * point used to be keeps the unsuffixed id, which is why the suffixes skip a
 * number rather than running 0,1,2. A person card is drawn under a glyph and
 * has one point per side, so the suffixed ids do not exist on it at all.
 */
export function handleSlotIds(
  role: 'source' | 'target',
  side: HandleSide,
  person: boolean
): string[] {
  const legacy = `${role}-${side}-${SIDE_INDEX[role][side]}`;
  if (person) return [legacy];
  const horizontal = side === 'top' || side === 'bottom';
  const count = horizontal ? 3 : 2;
  const inherits = horizontal ? 1 : 0;
  return Array.from({ length: count }, (_, i) =>
    i === inherits ? legacy : `${legacy}-s${i}`
  );
}

export type RouteNode = { x: number; y: number; person?: boolean };
export type RouteEdge = { sourceId: string; targetId: string };

export function routeKey(sourceId: string, targetId: string): string {
  return `${sourceId}\u0000${targetId}`;
}

/**
 * Spread the lines that share a side across the points that side has.
 *
 * Picking the side is only half of it: five lines leaving one card all named
 * the same handle and converged on a single dot, so the card grew a fan and
 * the labels stacked. Each bundle is ordered by where its far end sits along
 * the side, then dealt across the available points, so the lines keep their
 * order and do not cross each other on the way out.
 *
 * Fewer points than lines is normal — a short side has two — so this thins the
 * fan rather than abolishing it. One line keeps the unsuffixed handle, which
 * is what a hand-drawn diagram uses and what a person card only has.
 */
export function routeArrangedEdges(
  nodes: Map<string, RouteNode>,
  edges: RouteEdge[]
): Map<string, EdgeHandles> {
  type Pending = { key: string; side: HandleSide; cross: number };
  const buckets = new Map<string, Pending[]>();
  const sides = new Map<string, EdgeHandles>();

  for (const { sourceId, targetId } of edges) {
    const from = nodes.get(sourceId);
    const to = nodes.get(targetId);
    if (!from || !to || sourceId === targetId) continue;

    const handles = pickLayeredEdgeHandles(from, to);
    const key = routeKey(sourceId, targetId);
    sides.set(key, handles);

    for (const [role, nodeId, other, handle] of [
      ['source', sourceId, to, handles.sourceHandle],
      ['target', targetId, from, handles.targetHandle],
    ] as const) {
      const side = SIDE_OF[handle];
      /* Along a vertical side the lines are told apart by height, along a
         horizontal one by how far across the far end sits. */
      const cross = side === 'left' || side === 'right' ? other.y : other.x;
      const bucket = `${nodeId}\u0000${role}\u0000${side}`;
      if (!buckets.has(bucket)) buckets.set(bucket, []);
      buckets.get(bucket)!.push({ key, side, cross });
    }
  }

  const routed = new Map<string, EdgeHandles>(sides);

  for (const [bucket, pending] of buckets) {
    const [nodeId, role] = bucket.split('\u0000') as [string, 'source' | 'target'];
    const slots = handleSlotIds(role, pending[0].side, Boolean(nodes.get(nodeId)?.person));
    pending.sort((a, b) => a.cross - b.cross);

    pending.forEach((item, i) => {
      /* One line keeps the plain handle; more than one spreads end to end so
         the outermost lines take the outermost points. */
      const slot =
        pending.length === 1
          ? slots[Math.min(slots.length - 1, slots.length === 3 ? 1 : 0)]
          : slots[Math.round((i * (slots.length - 1)) / (pending.length - 1))];
      const current = routed.get(item.key)!;
      routed.set(
        item.key,
        role === 'source'
          ? { ...current, sourceHandle: slot }
          : { ...current, targetHandle: slot }
      );
    });
  }

  return routed;
}
