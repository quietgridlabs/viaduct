/**
 * Layout for the service graph, by way of ELK.
 *
 * What the model is, exactly: two relations over one set of vertices. Calls
 * are a digraph; containment — a system holding its containers — is a rooted
 * forest, and a call may join vertices at different depths of it. That pair is
 * a *compound digraph* (Sugiyama & Misue, 1991), and it is not the same thing
 * as a clustered graph, where the clusters are only boxes and carry no edges
 * of their own. Here a system both contains containers and makes calls.
 *
 * Laying it out means layered drawing that respects containment, which is
 * exactly what ELK's `layered` does with `hierarchyHandling: INCLUDE_CHILDREN`:
 * one set of layers across the whole graph, children ranked inside their
 * parent's box, edges routed through the boundaries.
 *
 * What this replaces is worth naming so it is not rebuilt by accident: a
 * breadth-first spanning tree of the call graph, with every edge outside the
 * tree drawn over it. A tree is easy to place and reads well, but containment
 * plays no part in it, so a system's containers scatter across the canvas and
 * the lines between them cross everything.
 *
 * ELK is asynchronous and about 1.5MB, so it is imported on demand: the graph
 * is behind a button, and a reader who never presses it never fetches it.
 */

export type GraphLayoutNode = {
  id: string;
  /** The system this belongs in, if any. Its absence makes it a root. */
  parentId?: string;
};
export type GraphLayoutLink = { sourceId: string; targetId: string };
export type GraphPosition = { x: number; y: number };

/** A system's box as ELK sized it — what a frame has to cover. */
export type GraphBox = GraphPosition & { width: number; height: number };

export type GraphLayout = {
  /** Absolute, top-left, as React Flow wants them. */
  positions: Map<string, GraphPosition>;
  /** One per system that holds containers. */
  boxes: Map<string, GraphBox>;
};

export const GRAPH_LAYOUT = {
  /** The box one orb draws in, label included. */
  nodeW: 120,
  nodeH: 115,
  /** Between layers, and between neighbours on a layer. */
  layerGap: 90,
  nodeGap: 48,
  /** Air inside a system's box; the top also has its title to clear. */
  padX: 26,
  padTop: 46,
  padBottom: 26,
} as const;

type ElkNode = {
  id: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  children?: ElkNode[];
  layoutOptions?: Record<string, string>;
};

/**
 * Positions for every service, and a box for every system that holds some.
 *
 * Returns absolute top-left coordinates: ELK answers in coordinates relative
 * to each node's parent, which is what React Flow wants only for nodes that
 * are really nested in it. These are not — a system's frame is drawn behind
 * its services rather than owning them — so the offsets are added up here.
 */
export async function layoutServiceGraph(
  nodes: GraphLayoutNode[],
  links: GraphLayoutLink[],
  opts: Partial<typeof GRAPH_LAYOUT> = {}
): Promise<GraphLayout> {
  const cfg = { ...GRAPH_LAYOUT, ...opts };
  const empty: GraphLayout = { positions: new Map(), boxes: new Map() };
  if (!nodes.length) return empty;

  const ids = new Set(nodes.map((n) => n.id));
  const childrenOf = new Map<string, GraphLayoutNode[]>();
  const roots: GraphLayoutNode[] = [];
  for (const node of nodes) {
    /* A parent that is not itself drawn is no parent: the node stands alone
       rather than disappearing into a box that does not exist. */
    const parentId = node.parentId && ids.has(node.parentId) ? node.parentId : undefined;
    if (!parentId || parentId === node.id) roots.push(node);
    else {
      const list = childrenOf.get(parentId);
      if (list) list.push(node);
      else childrenOf.set(parentId, [node]);
    }
  }

  const toElk = (node: GraphLayoutNode): ElkNode => {
    const children = childrenOf.get(node.id);
    if (!children?.length) {
      return { id: node.id, width: cfg.nodeW, height: cfg.nodeH };
    }
    return {
      id: node.id,
      /*
       * A system is a box with its own orb inside it, beside its containers.
       * ELK sizes the box from what it holds; the padding is the air the
       * frame draws in, title included.
       */
      layoutOptions: {
        'elk.padding': `[top=${cfg.padTop},left=${cfg.padX},bottom=${cfg.padBottom},right=${cfg.padX}]`,
      },
      children: [
        { id: selfId(node.id), width: cfg.nodeW, height: cfg.nodeH },
        ...children.map(toElk),
      ],
    };
  };

  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      /* The whole point: one layering across the graph, with children ranked
         inside their parent rather than laid out in ignorance of it. */
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.layered.spacing.nodeNodeBetweenLayers': String(cfg.layerGap),
      'elk.spacing.nodeNode': String(cfg.nodeGap),
      /* Components that touch nothing else still have to go somewhere. */
      'elk.separateConnectedComponents': 'true',
      'elk.spacing.componentComponent': String(cfg.layerGap),
    },
    children: roots.map(toElk),
    edges: links
      .filter((link) => ids.has(link.sourceId) && ids.has(link.targetId))
      .map((link, i) => ({
        id: `e${i}`,
        sources: [elkIdFor(link.sourceId, childrenOf)],
        targets: [elkIdFor(link.targetId, childrenOf)],
      })),
  };

  const { default: ELK } = await import('elkjs/lib/elk.bundled.js');
  const laid = (await new ELK().layout(graph)) as ElkNode;

  const positions = new Map<string, GraphPosition>();
  const boxes = new Map<string, GraphBox>();

  const walk = (node: ElkNode, offsetX: number, offsetY: number) => {
    const x = offsetX + (node.x ?? 0);
    const y = offsetY + (node.y ?? 0);
    if (node.children?.length) {
      boxes.set(node.id, {
        x,
        y,
        width: node.width ?? 0,
        height: node.height ?? 0,
      });
      for (const child of node.children) walk(child, x, y);
      return;
    }
    /* A system's own orb was given a separate id inside its box, so that the
       box could hold it beside its containers; put it back under the real one. */
    positions.set(realId(node.id), { x, y });
  };
  for (const child of laid.children ?? []) walk(child, 0, 0);

  return { positions, boxes };
}

/*
 * A system is two things at once here: the box its containers sit in, and a
 * service with calls of its own. ELK needs those to be two nodes — a parent
 * cannot also be a leaf — so the orb gets a derived id inside the box, and the
 * edges aimed at the system are aimed at it.
 */
const SELF_SUFFIX = '::self';
const selfId = (id: string) => `${id}${SELF_SUFFIX}`;
const realId = (id: string) =>
  id.endsWith(SELF_SUFFIX) ? id.slice(0, -SELF_SUFFIX.length) : id;

function elkIdFor(id: string, childrenOf: Map<string, GraphLayoutNode[]>): string {
  return childrenOf.has(id) ? selfId(id) : id;
}
