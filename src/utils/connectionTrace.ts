import type {
  ComponentBlock,
  ConnectionData,
  ConnectionInfo,
  FlatC4Model,
} from '@archivisio/c4-modelizer-sdk';
import type { ConnectionExtras } from '@/types/c4Extensions';
import type { Edge, Node } from '@xyflow/react';

export type TraceConnection = ConnectionInfo & ConnectionExtras;

export type ConnectionTraceState = {
  sourceContainerId: string;
  targetContainerId: string;
  systemId: string;
  highlightedIds: string[];
  /** Original container-level edge endpoints */
  sourceId: string;
  targetId: string;
  /** Container whose internals are shown for this trace */
  focusContainerId: string;
};

type ComponentLike = Pick<
  ComponentBlock,
  'id' | 'containerId' | 'position' | 'technology' | 'connections' | 'name'
>;

function connectionExtras(conn: ConnectionData | ConnectionInfo | null | undefined): ConnectionExtras {
  if (!conn) return {};
  const extras = conn as ConnectionExtras;
  const related = extras.relatedComponentIds;
  return {
    relatedComponentIds: Array.isArray(related) ? related : undefined,
    pathType: extras.pathType,
    bidirectional: extras.bidirectional,
    channelRole: extras.channelRole,
  };
}

/** Lookup full connection payload from the flat model (edge.data is incomplete). */
export function findContainerConnection(
  model: FlatC4Model,
  sourceId: string,
  targetId: string
): (ConnectionData & ConnectionExtras) | null {
  const source = model.containers.find((c) => c.id === sourceId);
  const conn = source?.connections?.find((c) => c.targetId === targetId);
  return conn ? { ...conn, ...connectionExtras(conn) } : null;
}

function expandOutgoing(pool: ComponentLike[], seeds: Set<string>): string[] {
  const byId = new Map(pool.map((c) => [c.id, c]));
  /** Outgoing + reverse of bidirectional edges. */
  const adj = new Map<string, string[]>();
  const push = (from: string, to: string) => {
    if (!byId.has(to)) return;
    const list = adj.get(from);
    if (list) list.push(to);
    else adj.set(from, [to]);
  };
  for (const node of pool) {
    for (const link of node.connections || []) {
      push(node.id, link.targetId);
      if ((link as { bidirectional?: boolean }).bidirectional) {
        push(link.targetId, node.id);
      }
    }
  }

  const seen = new Set<string>();
  const queue = [...seeds].filter((id) => byId.has(id));
  for (const id of queue) seen.add(id);
  while (queue.length) {
    const id = queue.shift()!;
    for (const next of adj.get(id) || []) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return [...seen];
}

/**
 * Resolve which components participate in a container-level connection.
 * Only explicit relatedComponentIds count — no tech/bridge heuristics.
 * Seeds expand along outgoing edges (and reverse of bidirectional ones)
 * within the two containers so the downstream chain stays highlighted.
 */
export function resolveRelatedComponentIds(
  model: FlatC4Model,
  sourceContainerId: string,
  targetContainerId: string,
  connection?: ConnectionData | ConnectionInfo | null
): string[] {
  const extras = connectionExtras(connection);
  if (!extras.relatedComponentIds?.length) return [];

  const sourceComps = model.components.filter((c) => c.containerId === sourceContainerId);
  const targetComps = model.components.filter((c) => c.containerId === targetContainerId);
  const pool = [...sourceComps, ...targetComps];
  const poolIds = new Set(pool.map((c) => c.id));

  const seeds = new Set(
    extras.relatedComponentIds.filter((id) => poolIds.has(id))
  );
  if (!seeds.size) return [];
  return expandOutgoing(pool, seeds);
}

/** Explicit relatedComponentIds that belong to a given container (no expansion). */
export function relatedIdsForContainer(
  model: FlatC4Model,
  containerId: string,
  connection?: ConnectionData | ConnectionInfo | null
): string[] {
  const related = connectionExtras(connection).relatedComponentIds;
  if (!related?.length) return [];
  return related.filter((id) => {
    const comp = model.components.find((c) => c.id === id);
    return comp?.containerId === containerId;
  });
}

export function layoutOffsetForTarget(
  sourceComps: ComponentLike[],
  targetComps: ComponentLike[],
  nodeWidth = 320,
  gap = 180
): number {
  if (!sourceComps.length || !targetComps.length) return 0;
  const srcMaxX = Math.max(...sourceComps.map((c) => c.position.x)) + nodeWidth;
  const tgtMinX = Math.min(...targetComps.map((c) => c.position.x));
  const needed = srcMaxX + gap - tgtMinX;
  return needed > 0 ? needed : 0;
}

export type TraceViewBuildArgs = {
  model: FlatC4Model;
  trace: ConnectionTraceState;
  onEditComponent: (id: string) => void;
  getTechnologyColor: (technologyId?: string) => string;
};

export function buildConnectionTraceView({
  model,
  trace,
  onEditComponent,
  getTechnologyColor,
}: TraceViewBuildArgs): { nodes: Node[]; edges: Edge[] } {
  const comps = model.components.filter((c) => c.containerId === trace.focusContainerId);
  const highlighted = new Set(trace.highlightedIds);
  const hasHighlights = highlighted.size > 0;

  const nodes: Node[] = comps.map((c) => {
    const isHit = highlighted.has(c.id);
    return {
      id: c.id,
      type: 'component',
      position: c.position,
      data: {
        ...c,
        onEdit: () => onEditComponent(c.id),
        traceHighlight: hasHighlights && isHit,
        traceDimmed: hasHighlights && !isHit,
      },
    };
  });

  const visibleIds = new Set(nodes.map((n) => n.id));
  const marker = (tech?: string) => ({
    type: 'arrowclosed' as const,
    width: 18,
    height: 18,
    color: getTechnologyColor(tech),
  });

  const edges: Edge[] = [];
  for (const c of comps) {
    for (const d of c.connections || []) {
      if (!visibleIds.has(d.targetId)) continue;
      const bothHit = highlighted.has(c.id) && highlighted.has(d.targetId);
      edges.push({
        id: `${c.id}->${d.targetId}`,
        source: c.id,
        target: d.targetId,
        sourceHandle: d.sourceHandle,
        targetHandle: d.targetHandle,
        label: d.label,
        data: {
          technology: d.technology,
          technologyId: d.technology,
          description: d.description,
          labelPosition: d.labelPosition,
          bidirectional: d.bidirectional,
          pathType: (d as ConnectionExtras).pathType,
          traceHighlight: hasHighlights && bothHit,
          traceDimmed: hasHighlights && !bothHit,
        },
        type: d.technology || d.label ? 'technology' : 'default',
        markerStart: d.bidirectional ? marker(d.technology) : undefined,
        markerEnd: marker(d.technology),
        style: hasHighlights
          ? {
              opacity: bothHit ? 1 : 0.18,
              strokeWidth: bothHit ? 2.5 : 1,
            }
          : undefined,
      });
    }
  }

  return { nodes, edges };
}

export function enrichConnectionInfo(
  model: FlatC4Model,
  base: ConnectionInfo
): TraceConnection {
  const stored = findStoredConnection(model, base.sourceId, base.targetId);
  const baseExtras = base as ConnectionExtras;
  return {
    ...base,
    ...stored,
    id: base.id,
    sourceId: base.sourceId,
    targetId: base.targetId,
    relatedComponentIds:
      stored?.relatedComponentIds ?? baseExtras.relatedComponentIds,
    pathType: stored?.pathType ?? baseExtras.pathType,
    channelRole: stored?.channelRole ?? baseExtras.channelRole,
  };
}

/** Full connection payload from the flat model for the active view level. */
export function findStoredConnection(
  model: FlatC4Model,
  sourceId: string,
  targetId: string
): (ConnectionData & ConnectionExtras) | null {
  const pool =
    model.viewLevel === 'system'
      ? model.systems
      : model.viewLevel === 'container'
        ? model.containers
        : model.viewLevel === 'component'
          ? model.components
          : model.codeElements;
  const source = pool.find((b) => b.id === sourceId);
  const conn = source?.connections?.find((c) => c.targetId === targetId);
  if (!conn) return null;
  const extras = conn as ConnectionExtras;
  return {
    ...conn,
    foreignKey: extras.foreignKey,
    relatedComponentIds: extras.relatedComponentIds,
    pathType: extras.pathType,
    channelRole: extras.channelRole,
  };
}

export function buildTraceFromContainerEdge(
  model: FlatC4Model,
  sourceId: string,
  targetId: string,
  connection: ConnectionData | null,
  focusContainerId: string
): ConnectionTraceState | null {
  const source = model.containers.find((c) => c.id === sourceId);
  const target = model.containers.find((c) => c.id === targetId);
  if (!source || !target) return null;

  if (focusContainerId !== source.id && focusContainerId !== target.id) {
    return null;
  }

  const allHighlighted = resolveRelatedComponentIds(model, source.id, target.id, connection);
  const highlightedIds = allHighlighted.filter((id) => {
    const comp = model.components.find((c) => c.id === id);
    return comp?.containerId === focusContainerId;
  });

  return {
    sourceContainerId: source.id,
    targetContainerId: target.id,
    systemId: source.systemId,
    highlightedIds,
    sourceId,
    targetId,
    focusContainerId,
  };
}
