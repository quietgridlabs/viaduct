/**
 * Layered left-to-right placement for sibling C4 cards.
 *
 * Mirrors `server/src/modules/model/layoutSiblings.js` — keep the two in step.
 * Ranks by longest path from sources, orders each layer to cut crossings, and
 * keeps `group` members contiguous.
 */

/**
 * The box a card is allotted, and the air around it.
 *
 * `nodeW` / `nodeH` are the space reserved per card, not a card's real size —
 * but they were smaller than the cards they stood for, which is why arranged
 * diagrams came out cramped. Measured: a system card is 270 wide and 92 to 160
 * tall, and an ER table 300 by 172, against a reserved box of 280 by 140. The
 * tallest cards were left 36px apart and the tables nearly touched, so the gap
 * that was supposed to separate them was being spent covering the overflow
 * instead. The box now covers the largest card on any level and the gaps are
 * gaps again.
 */
export const LAYOUT = {
  nodeW: 300,
  nodeH: 180,
  gapX: 120,
  gapY: 72,
  groupGapY: 120,
  originX: 80,
  originY: 80,
  baryPasses: 4,
} as const;

export type LayoutElement = { id: string; group?: string | null };
export type LayoutConnection = { sourceId: string; targetId: string };
export type LayoutPosition = { x: number; y: number };

/* Numbers, not `typeof LAYOUT`: that one is `as const`, so inheriting its type
   here would mean an override had to be the exact default it is overriding. */
export type LayoutOptions = Partial<Record<keyof typeof LAYOUT, number>>;
/** The defaults once any overrides are folded in. */
type LayoutConfig = Record<keyof typeof LAYOUT, number>;

export function layoutSiblings(
  elements: LayoutElement[],
  connections: LayoutConnection[],
  opts: LayoutOptions = {}
): Map<string, LayoutPosition> {
  const cfg = { ...LAYOUT, ...opts };
  const ids = elements.map((el) => el.id).filter(Boolean);
  if (!ids.length) return new Map();

  const idSet = new Set(ids);
  const groupOf = new Map(
    elements.map((el) => [el.id, String(el.group || '').trim().toLowerCase() || ''])
  );

  const outs = new Map<string, string[]>(ids.map((id) => [id, []]));
  const ins = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const edge of connections || []) {
    const from = edge?.sourceId;
    const to = edge?.targetId;
    if (!from || !to || from === to) continue;
    if (!idSet.has(from) || !idSet.has(to)) continue;
    outs.get(from)!.push(to);
    ins.get(to)!.push(from);
  }

  const rank = new Map<string, number>();
  const stack = new Set<string>();
  function computeRank(id: string): number {
    if (rank.has(id)) return rank.get(id)!;
    if (stack.has(id)) return 0;
    stack.add(id);
    let best = 0;
    for (const pred of ins.get(id) || []) {
      best = Math.max(best, computeRank(pred) + 1);
    }
    stack.delete(id);
    rank.set(id, best);
    return best;
  }
  for (const id of ids) computeRank(id);

  const layerCount = Math.max(0, ...rank.values()) + 1;
  const layers: string[][] = Array.from({ length: layerCount }, () => []);
  for (const id of ids) layers[rank.get(id)!].push(id);

  const byGroupThenId = (a: string, b: string) => {
    const ga = groupOf.get(a)!;
    const gb = groupOf.get(b)!;
    if (ga !== gb) return ga < gb ? -1 : 1;
    return a < b ? -1 : a > b ? 1 : 0;
  };
  for (const layer of layers) layer.sort(byGroupThenId);

  for (let pass = 0; pass < cfg.baryPasses; pass++) {
    for (let li = 1; li < layers.length; li++) {
      orderByBarycentre(layers[li], layers[li - 1], ins, groupOf);
    }
    for (let li = layers.length - 2; li >= 0; li--) {
      orderByBarycentre(layers[li], layers[li + 1], outs, groupOf);
    }
  }

  if (connectionsAreEmpty(connections, idSet)) {
    return gridByGroup(ids, groupOf, cfg);
  }

  const positions = new Map<string, LayoutPosition>();
  for (let li = 0; li < layers.length; li++) {
    const layer = layers[li];
    let y = cfg.originY;
    let prevGroup: string | null = null;
    for (let i = 0; i < layer.length; i++) {
      const id = layer[i];
      const group = groupOf.get(id)!;
      if (i > 0 && group !== prevGroup) y += cfg.groupGapY - cfg.gapY;
      positions.set(id, {
        x: cfg.originX + li * (cfg.nodeW + cfg.gapX),
        y,
      });
      y += cfg.nodeH + cfg.gapY;
      prevGroup = group;
    }
  }
  return positions;
}

function connectionsAreEmpty(connections: LayoutConnection[], idSet: Set<string>) {
  if (!connections?.length) return true;
  return !connections.some(
    (edge) =>
      edge?.sourceId &&
      edge?.targetId &&
      edge.sourceId !== edge.targetId &&
      idSet.has(edge.sourceId) &&
      idSet.has(edge.targetId)
  );
}

function orderByBarycentre(
  layer: string[],
  neighbourLayer: string[],
  adj: Map<string, string[]>,
  groupOf: Map<string, string>
) {
  const indexOf = new Map(neighbourLayer.map((id, i) => [id, i]));
  const scored = layer.map((id, i) => {
    const neighbours = adj.get(id) || [];
    let sum = 0;
    let n = 0;
    for (const other of neighbours) {
      if (indexOf.has(other)) {
        sum += indexOf.get(other)!;
        n += 1;
      }
    }
    return {
      id,
      group: groupOf.get(id)!,
      bary: n ? sum / n : i,
      i,
    };
  });
  scored.sort((a, b) => {
    if (a.group !== b.group) return a.group < b.group ? -1 : 1;
    if (a.bary !== b.bary) return a.bary - b.bary;
    return a.i - b.i;
  });
  for (let i = 0; i < layer.length; i++) layer[i] = scored[i].id;
}

function gridByGroup(
  ids: string[],
  groupOf: Map<string, string>,
  cfg: LayoutConfig
): Map<string, LayoutPosition> {
  const buckets = new Map<string, string[]>();
  for (const id of ids) {
    const key = groupOf.get(id) || '';
    const list = buckets.get(key);
    if (list) list.push(id);
    else buckets.set(key, [id]);
  }
  const positions = new Map<string, LayoutPosition>();
  let y = cfg.originY;
  for (const [, members] of buckets) {
    members.sort();
    for (let i = 0; i < members.length; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      positions.set(members[i], {
        x: cfg.originX + col * (cfg.nodeW + cfg.gapX),
        y: y + row * (cfg.nodeH + cfg.gapY),
      });
    }
    const rows = Math.ceil(members.length / 3);
    y += rows * (cfg.nodeH + cfg.gapY) + cfg.groupGapY;
  }
  return positions;
}
