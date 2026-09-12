import type { Edge, Node } from '@xyflow/react';

/*
 * A payload that will not serialise is treated as changed every time, so the
 * counter guarantees its key never matches the one before it.
 */
let unserialisable = 0;

export function stableDataKey(data: unknown): string {
  if (data === undefined) return '';
  try {
    /* Functions drop out, which is what we want: `onEdit` is a fresh closure
       every render and means nothing to the picture. */
    return JSON.stringify(data) ?? '';
  } catch {
    return `\u0000unserialisable:${++unserialisable}`;
  }
}

/**
 * What a node looks like, as a string.
 *
 * The whole data object, not a list of the interesting fields. It used to be
 * such a list, and anything missing from it was invisible here: an endpoint's
 * method, a channel's protocol, a schema, a URL. Since a node whose key has
 * not changed keeps its old object, saving a new method handed React Flow the
 * previous card and the canvas went on drawing the old verb until something
 * forced a full rebuild — leaving the level and coming back, or a reload. A
 * list like that is wrong again the day any element gains a field, and it
 * fails by quietly showing something stale, which is the worst way to fail.
 */
function nodeVisualKey(node: Node): string {
  return [
    node.id,
    node.type,
    node.position.x,
    node.position.y,
    stableDataKey(node.data),
  ].join('\x1f');
}

function edgeVisualKey(edge: Edge): string {
  const d = edge.data as Record<string, unknown> | undefined;
  const style = edge.style as Record<string, unknown> | undefined;
  return [
    edge.id,
    edge.source,
    edge.target,
    edge.type,
    edge.label,
    d?.pathType,
    d?.traceHighlight ? 1 : 0,
    d?.traceDimmed ? 1 : 0,
    d?.flowMotion || '',
    d?.bidirectional ? 1 : 0,
    d?.technology ?? d?.technologyId,
    JSON.stringify(d?.foreignKey ?? null),
    style?.opacity,
    style?.strokeWidth,
  ].join('\x1f');
}

function reuseById<T extends { id: string }>(
  prev: T[] | undefined,
  next: T[],
  keyOf: (item: T) => string
): T[] {
  if (!prev || prev.length === 0) return next;
  if (prev === next) return prev;
  const prevById = new Map(prev.map((item) => [item.id, item] as const));
  const prevKeys = new Map(prev.map((item) => [item.id, keyOf(item)] as const));
  let changed = prev.length !== next.length;
  const out = next.map((item, i) => {
    const old = prevById.get(item.id);
    if (old && prevKeys.get(item.id) === keyOf(item)) {
      if (old !== prev[i]) changed = true;
      return old;
    }
    changed = true;
    return item;
  });
  if (!changed) return prev;
  return out;
}

/** Keep React Flow node object identity when visual fields did not change. */
export function reuseRfNodes(prev: Node[] | undefined, next: Node[]): Node[] {
  return reuseById(prev, next, nodeVisualKey);
}

/** Keep React Flow edge object identity when visual fields did not change. */
export function reuseRfEdges(prev: Edge[] | undefined, next: Edge[]): Edge[] {
  return reuseById(prev, next, edgeVisualKey);
}
