import type { Node } from '@xyflow/react';
import type { GhostElement } from '@/state/diffOverlay';
import { stableDataKey } from '@utils/reuseGraphItems';

/**
 * A removed element rendered on the comparison board — not in the live model,
 * so it must never reach an edit dialog, a delete, or a drag: there is nothing
 * on the other end of its id. `draggable`/`selectable`/`connectable` already
 * say no to React Flow's own gestures; this is the belt for the handlers that
 * bypass those flags (click/double-click/context-menu still fire regardless).
 */
export function isGhostNode(node: Node): boolean {
  return Boolean((node.data as { ghost?: boolean } | undefined)?.ghost);
}

/**
 * A ghost's `data` only has to satisfy what the block components actually
 * read (BaseBlock's fields plus each level's parent ids) — there is no live
 * element behind it to ask for anything else. `codeType` is the one field the
 * comparison does not carry (the differ never recorded it), so a removed code
 * element loses its class/function/interface chip; everything else renders.
 */
export function buildGhostNode(g: GhostElement): Node {
  return {
    id: `ghost:${g.id}`,
    type: g.level,
    position: g.position,
    draggable: false,
    selectable: false,
    connectable: false,
    focusable: false,
    data: {
      id: g.id,
      name: g.name,
      type: g.level,
      position: g.position,
      technology: g.technology,
      external: g.external,
      kind: g.kind,
      connections: [],
      systemId: g.systemId,
      containerId: g.containerId,
      componentId: g.componentId,
      diffStatus: 'gone',
      ghost: true,
      onEdit: () => {},
    },
  };
}

function dataEqual(a: unknown, b: unknown): boolean {
  return a === b || stableDataKey(a) === stableDataKey(b);
}

/**
 * Whether two node lists carry the same picture, so a rebuild that changes
 * nothing visible can keep the list React Flow already has — which is what
 * keeps a card from jumping mid-drag.
 *
 * Compares the data whole, for the reason `nodeVisualKey` does: a list of the
 * fields worth checking is wrong again the day any element gains one, and it
 * fails by drawing something stale.
 */
export function nodesLayoutEqual(a: Node[], b: Node[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const na = a[i];
    const nb = b[i];
    if (na.id !== nb.id || na.type !== nb.type) return false;
    if (na.position.x !== nb.position.x || na.position.y !== nb.position.y) return false;
    if (!dataEqual(na.data, nb.data)) return false;
  }
  return true;
}
